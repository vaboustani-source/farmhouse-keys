-- ============================================================
-- Pop-Up Hotel Weekends — additive schema for public tier-based
-- weekend packages sold alongside wedding lodging blocks.
-- Tiers are modeled as lb_room_sections rows on a popup-type
-- event, so the entire existing checkout/webhook/email pipeline
-- is reused unchanged.
-- ============================================================

-- 1) Event type + landing copy
ALTER TABLE public.lb_events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'wedding',
  ADD COLUMN IF NOT EXISTS hero_intro text;

-- 2) Tier metadata on sections (package pricing + promo state).
--    guest_nightly_rate stays the single source of truth for what
--    Stripe charges (package price / nights); these columns drive
--    the public display and the promo strikethrough.
ALTER TABLE public.lb_room_sections
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS regular_package_price numeric,
  ADD COLUMN IF NOT EXISTS promo_package_price numeric,
  ADD COLUMN IF NOT EXISTS promo_active boolean NOT NULL DEFAULT false;

-- 3) Self-serve bookings hold a room for a limited window while
--    the guest completes Stripe checkout.
ALTER TABLE public.lb_bookings
  ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz;

-- 4) Itinerary matrix (day / time / activity / which tiers include it)
CREATE TABLE IF NOT EXISTS public.lb_itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.lb_events(id) ON DELETE CASCADE,
  day_number int NOT NULL DEFAULT 1,
  time_label text,
  activity text NOT NULL,
  note text,
  tier1_included boolean NOT NULL DEFAULT true,
  tier2_included boolean NOT NULL DEFAULT true,
  tier3_included boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lb_itinerary_event
  ON public.lb_itinerary_items(event_id, day_number, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lb_itinerary_items TO authenticated;
GRANT ALL ON public.lb_itinerary_items TO service_role;
ALTER TABLE public.lb_itinerary_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage itinerary" ON public.lb_itinerary_items;
CREATE POLICY "Admins manage itinerary" ON public.lb_itinerary_items
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 5) Wedding blocks auto-seed 4 building sections on event insert.
--    Popup events define their own tier sections instead — skip.
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
  IF NEW.event_type = 'popup' THEN
    RETURN NEW;
  END IF;
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

-- 6) Atomic self-serve booking creation for popup events.
--    Advisory lock per section makes the capacity check + insert
--    race-proof. Called only via service role from server functions.
CREATE OR REPLACE FUNCTION public.create_popup_booking(
  p_event_slug text,
  p_section_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event record;
  v_section record;
  v_taken int;
  v_existing record;
  v_booking_id uuid;
  v_email text;
BEGIN
  v_email := lower(trim(p_guest_email));
  IF v_email IS NULL OR v_email = '' OR trim(coalesce(p_guest_name, '')) = '' THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  SELECT id, status INTO v_event
  FROM public.lb_events
  WHERE slug = p_event_slug AND event_type = 'popup';
  IF v_event.id IS NULL OR v_event.status <> 'active' THEN
    RAISE EXCEPTION 'not_available';
  END IF;

  SELECT id, event_id, total_rooms, nights INTO v_section
  FROM public.lb_room_sections
  WHERE id = p_section_id AND event_id = v_event.id AND is_active = true;
  IF v_section.id IS NULL THEN
    RAISE EXCEPTION 'not_available';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_section.id::text));

  -- One reservation per email per popup weekend.
  SELECT id, section_id, payment_status INTO v_existing
  FROM public.lb_bookings
  WHERE event_id = v_event.id
    AND lower(guest_email) = v_email
    AND removed IS NOT TRUE
  ORDER BY booked_at DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL
     AND v_existing.payment_status IN ('paid', 'deposit_paid', 'covered') THEN
    RAISE EXCEPTION 'already_booked';
  END IF;

  SELECT count(*) INTO v_taken
  FROM public.lb_bookings
  WHERE section_id = p_section_id
    AND removed IS NOT TRUE
    AND id IS DISTINCT FROM v_existing.id
    AND (
      payment_status IN ('paid', 'deposit_paid', 'covered')
      OR (payment_status = 'pending' AND hold_expires_at > now())
    );
  IF v_taken >= v_section.total_rooms THEN
    RAISE EXCEPTION 'sold_out';
  END IF;

  IF v_existing.id IS NOT NULL AND v_existing.payment_status = 'pending' THEN
    UPDATE public.lb_bookings
      SET guest_name = trim(p_guest_name),
          guest_phone = nullif(trim(coalesce(p_guest_phone, '')), ''),
          section_id = p_section_id,
          nights_booked = coalesce(v_section.nights, 2),
          hold_expires_at = now() + interval '45 minutes',
          stripe_session_id = NULL
      WHERE id = v_existing.id;
    RETURN v_existing.id;
  END IF;

  INSERT INTO public.lb_bookings (
    event_id, section_id, guest_name, guest_email, guest_phone,
    nights_booked, payment_status, payment_schedule, is_primary,
    hold_expires_at
  ) VALUES (
    v_event.id, p_section_id, trim(p_guest_name), v_email,
    nullif(trim(coalesce(p_guest_phone, '')), ''),
    coalesce(v_section.nights, 2), 'pending', 'full', true,
    now() + interval '45 minutes'
  ) RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_popup_booking(text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_popup_booking(text, uuid, text, text, text) TO service_role;
