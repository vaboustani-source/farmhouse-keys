
-- ============================================================
-- Bridge: lodging_assignments (Planning Hub) <-> lb_bookings (Lodging App)
-- ============================================================

-- 1) Rename existing sections to canonical names per couple's spec
UPDATE public.lb_room_sections SET section_name='The Hearth Village' WHERE section_name='Hearth Guesthouses';
UPDATE public.lb_room_sections SET section_name='The Grove Guesthouses' WHERE section_name='Grove Guesthouses';
UPDATE public.lb_room_sections SET section_name='The Victoria Cabins' WHERE section_name='Victoria Guesthouses';

-- Update the seed function so future events use canonical names
CREATE OR REPLACE FUNCTION public.lb_seed_event_sections()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_section_id uuid;
  v_section_name text;
  v_sort int;
  v_names text[] := ARRAY['Farmhouse Residence','The Hearth Village','The Grove Guesthouses','The Victoria Cabins'];
  v_addons text[] := ARRAY['Extra Night','Late Checkout','Welcome Amenity Package','Private Fireside Setup'];
  v_addon text;
  v_slug text;
BEGIN
  v_sort := 0;
  FOREACH v_section_name IN ARRAY v_names LOOP
    v_slug := lower(regexp_replace(v_section_name, '\s+', '-', 'g')) || '-' || replace(NEW.id::text, '-', '');
    SELECT s.id INTO v_section_id FROM public.lb_room_sections s
      WHERE s.event_id = NEW.id AND (s.section_name = v_section_name OR s.booking_link_slug = v_slug) LIMIT 1;
    IF v_section_id IS NULL THEN
      INSERT INTO public.lb_room_sections (event_id, section_name, sort_order, booking_link_slug)
        VALUES (NEW.id, v_section_name, v_sort, v_slug) RETURNING id INTO v_section_id;
    END IF;
    FOREACH v_addon IN ARRAY v_addons LOOP
      IF NOT EXISTS (SELECT 1 FROM public.lb_section_addons a
                     WHERE a.event_id=NEW.id AND a.section_id=v_section_id AND a.addon_name=v_addon) THEN
        INSERT INTO public.lb_section_addons (event_id, section_id, addon_name, addon_price, addon_type, is_active)
          VALUES (NEW.id, v_section_id, v_addon, 0, 'per_stay', false);
      END IF;
    END LOOP;
    v_sort := v_sort + 1;
  END LOOP;
  RETURN NEW;
END;
$function$;

-- 2) Add columns to lodging_assignments for stripe writeback & soft-remove
ALTER TABLE public.lodging_assignments
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

-- 3) Sync audit log
CREATE TABLE IF NOT EXISTS public.lb_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  direction text NOT NULL,
  lodging_assignment_id uuid,
  lb_booking_id uuid,
  event_id uuid,
  guest_email text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lb_sync_log TO authenticated;
GRANT ALL ON public.lb_sync_log TO service_role;
ALTER TABLE public.lb_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read lb_sync_log" ON public.lb_sync_log
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- 4) Helper: map room_type -> section_name
CREATE OR REPLACE FUNCTION public.lb_section_name_for_room_type(_room_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _room_type
    WHEN 'farmhouse'      THEN 'Farmhouse Residence'
    WHEN 'hearth_village' THEN 'The Hearth Village'
    WHEN 'grove'          THEN 'The Grove Guesthouses'
    WHEN 'victoria'       THEN 'The Victoria Cabins'
    ELSE NULL
  END
$$;

-- 5) Trigger: lodging_assignments -> lb_bookings
CREATE OR REPLACE FUNCTION public.sync_lodging_assignment_to_lb_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_section_name text;
  v_section_id uuid;
  v_payment_schedule text;
  v_existing public.lb_bookings%ROWTYPE;
  v_room_type text;
  v_email text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_email := lower(trim(OLD.assigned_guest_email));
    IF v_email IS NULL OR v_email = '' OR OLD.event_id IS NULL THEN RETURN OLD; END IF;
    SELECT * INTO v_existing FROM public.lb_bookings
      WHERE event_id = OLD.event_id AND lower(guest_email) = v_email LIMIT 1;
    IF v_existing.id IS NULL THEN RETURN OLD; END IF;
    IF v_existing.payment_status = 'pending' THEN
      DELETE FROM public.lb_bookings WHERE id = v_existing.id;
      INSERT INTO public.lb_sync_log(action,direction,lodging_assignment_id,lb_booking_id,event_id,guest_email,reason)
        VALUES('delete','hub_to_lb',OLD.id,v_existing.id,OLD.event_id,v_email,'guest removed before payment');
    ELSE
      UPDATE public.lodging_assignments SET removed = true, removed_at = now() WHERE id = OLD.id;
      INSERT INTO public.lb_sync_log(action,direction,lodging_assignment_id,lb_booking_id,event_id,guest_email,reason)
        VALUES('blocked','hub_to_lb',OLD.id,v_existing.id,OLD.event_id,v_email,
          'guest has payment on file ('||v_existing.payment_status||') - soft-removed; admin review required');
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT / UPDATE
  v_email := lower(trim(NEW.assigned_guest_email));
  IF v_email IS NULL OR v_email = '' OR NEW.event_id IS NULL OR NEW.room_id IS NULL THEN
    INSERT INTO public.lb_sync_log(action,direction,lodging_assignment_id,event_id,guest_email,reason)
      VALUES('skipped','hub_to_lb',NEW.id,NEW.event_id,v_email,'missing email/event_id/room_id');
    RETURN NEW;
  END IF;

  SELECT room_type INTO v_room_type FROM public.lodging_rooms WHERE id = NEW.room_id;
  v_section_name := public.lb_section_name_for_room_type(v_room_type);
  IF v_section_name IS NULL THEN
    INSERT INTO public.lb_sync_log(action,direction,lodging_assignment_id,event_id,guest_email,reason)
      VALUES('error','hub_to_lb',NEW.id,NEW.event_id,v_email,'unknown room_type: '||COALESCE(v_room_type,'NULL'));
    RETURN NEW;
  END IF;

  SELECT id, payment_schedule INTO v_section_id, v_payment_schedule
    FROM public.lb_room_sections WHERE event_id = NEW.event_id AND section_name = v_section_name LIMIT 1;
  IF v_section_id IS NULL THEN
    INSERT INTO public.lb_sync_log(action,direction,lodging_assignment_id,event_id,guest_email,reason)
      VALUES('error','hub_to_lb',NEW.id,NEW.event_id,v_email,'no lb_room_sections row for '||v_section_name);
    RETURN NEW;
  END IF;

  SELECT * INTO v_existing FROM public.lb_bookings
    WHERE event_id = NEW.event_id AND lower(guest_email) = v_email LIMIT 1;

  IF v_existing.id IS NULL THEN
    INSERT INTO public.lb_bookings(event_id, section_id, guest_name, guest_email,
      nights_booked, payment_status, payment_schedule, is_primary)
    VALUES (NEW.event_id, v_section_id, COALESCE(NEW.assigned_guest_name,''), v_email,
      (SELECT nights FROM public.lb_room_sections WHERE id = v_section_id),
      'pending', COALESCE(v_payment_schedule,'full'), true)
    RETURNING * INTO v_existing;
    INSERT INTO public.lb_sync_log(action,direction,lodging_assignment_id,lb_booking_id,event_id,guest_email,reason)
      VALUES('insert','hub_to_lb',NEW.id,v_existing.id,NEW.event_id,v_email,'created pending booking');
  ELSE
    IF v_existing.payment_status = 'pending' THEN
      UPDATE public.lb_bookings
        SET guest_name = COALESCE(NEW.assigned_guest_name, guest_name),
            guest_email = v_email,
            section_id = v_section_id
        WHERE id = v_existing.id;
      INSERT INTO public.lb_sync_log(action,direction,lodging_assignment_id,lb_booking_id,event_id,guest_email,reason)
        VALUES('update','hub_to_lb',NEW.id,v_existing.id,NEW.event_id,v_email,'updated pending booking');
    ELSE
      -- paid/deposit_paid/covered: name only, never email
      IF NEW.assigned_guest_name IS DISTINCT FROM v_existing.guest_name THEN
        UPDATE public.lb_bookings SET guest_name = NEW.assigned_guest_name WHERE id = v_existing.id;
      END IF;
      IF lower(trim(NEW.assigned_guest_email)) <> lower(trim(v_existing.guest_email)) THEN
        -- block email change: revert lodging_assignments email
        UPDATE public.lodging_assignments SET assigned_guest_email = v_existing.guest_email WHERE id = NEW.id;
        INSERT INTO public.lb_sync_log(action,direction,lodging_assignment_id,lb_booking_id,event_id,guest_email,reason)
          VALUES('blocked','hub_to_lb',NEW.id,v_existing.id,NEW.event_id,v_email,
            'email change blocked - payment on file ('||v_existing.payment_status||')');
      ELSE
        INSERT INTO public.lb_sync_log(action,direction,lodging_assignment_id,lb_booking_id,event_id,guest_email,reason)
          VALUES('update','hub_to_lb',NEW.id,v_existing.id,NEW.event_id,v_email,'name-only update on paid booking');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.lb_sync_log(action,direction,lodging_assignment_id,event_id,guest_email,reason)
    VALUES('error','hub_to_lb',COALESCE(NEW.id,OLD.id),COALESCE(NEW.event_id,OLD.event_id),v_email,SQLERRM);
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_lodging_assignments_sync ON public.lodging_assignments;
CREATE TRIGGER trg_lodging_assignments_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.lodging_assignments
  FOR EACH ROW EXECUTE FUNCTION public.sync_lodging_assignment_to_lb_booking();

-- 6) Trigger: lb_bookings -> lodging_assignments (payment writeback)
CREATE OR REPLACE FUNCTION public.sync_lb_booking_to_lodging_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_email text;
  v_assignment_id uuid;
  v_inv1 boolean := false;
  v_inv2 boolean := false;
  v_invF boolean := false;
  v_pmt_date date := null;
BEGIN
  v_email := lower(trim(NEW.guest_email));
  IF v_email IS NULL OR v_email = '' OR NEW.event_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_assignment_id FROM public.lodging_assignments
    WHERE event_id = NEW.event_id AND lower(trim(assigned_guest_email)) = v_email LIMIT 1;
  IF v_assignment_id IS NULL THEN RETURN NEW; END IF;

  -- Compute invoice flags from payment_status (forward-only, monotonic)
  IF NEW.payment_status IN ('paid','covered') THEN
    v_inv1 := true; v_inv2 := true; v_invF := true;
    v_pmt_date := COALESCE(NEW.final_paid_at::date, NEW.covered_at::date, NEW.deposit_paid_at::date, now()::date);
  ELSIF NEW.payment_status = 'deposit_paid' THEN
    v_inv1 := true;
  END IF;

  UPDATE public.lodging_assignments
    SET payment_status            = NEW.payment_status,
        stripe_session_id         = COALESCE(NEW.stripe_session_id, stripe_session_id),
        stripe_payment_intent_id  = COALESCE(NEW.stripe_payment_intent_id, stripe_payment_intent_id),
        deposit_paid_at           = COALESCE(NEW.deposit_paid_at, deposit_paid_at),
        final_paid_at             = COALESCE(NEW.final_paid_at, final_paid_at),
        invoice_1_sent            = invoice_1_sent OR v_inv1,
        invoice_2_sent            = invoice_2_sent OR v_inv2,
        invoice_final_sent        = invoice_final_sent OR v_invF,
        payment_completed_date    = COALESCE(payment_completed_date, v_pmt_date)
  WHERE id = v_assignment_id;

  INSERT INTO public.lb_sync_log(action,direction,lodging_assignment_id,lb_booking_id,event_id,guest_email,reason)
    VALUES('update','lb_to_hub',v_assignment_id,NEW.id,NEW.event_id,v_email,
      'payment_status='||COALESCE(NEW.payment_status,'NULL'));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.lb_sync_log(action,direction,lb_booking_id,event_id,guest_email,reason)
    VALUES('error','lb_to_hub',NEW.id,NEW.event_id,v_email,SQLERRM);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lb_bookings_writeback ON public.lb_bookings;
CREATE TRIGGER trg_lb_bookings_writeback
  AFTER INSERT OR UPDATE OF payment_status, deposit_paid_at, final_paid_at, covered_at,
                            stripe_session_id, stripe_payment_intent_id
  ON public.lb_bookings
  FOR EACH ROW EXECUTE FUNCTION public.sync_lb_booking_to_lodging_assignment();

-- 7) Backfill: existing lodging_assignments -> lb_bookings (pending only)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.lodging_assignments
           WHERE assigned_guest_email IS NOT NULL AND assigned_guest_email <> '' AND removed = false
  LOOP
    UPDATE public.lodging_assignments SET id = id WHERE id = r.id; -- fire trigger via no-op update
  END LOOP;
END $$;
