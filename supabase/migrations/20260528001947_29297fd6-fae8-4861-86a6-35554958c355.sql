
CREATE OR REPLACE FUNCTION public.sync_guest_invitation_to_lb_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
  v_event_id uuid;
  v_section_id uuid;
  v_payment_schedule text;
  v_nights int;
  v_existing public.lb_bookings%ROWTYPE;
  v_section_hint text;
BEGIN
  ------------------------------------------------------------------
  -- DELETE
  ------------------------------------------------------------------
  IF TG_OP = 'DELETE' THEN
    v_email := lower(trim(OLD.guest_email));
    IF v_email IS NULL OR v_email = '' OR OLD.event_id IS NULL THEN
      RETURN OLD;
    END IF;

    SELECT id INTO v_event_id FROM public.lb_events WHERE id = OLD.event_id LIMIT 1;
    IF v_event_id IS NULL THEN
      RETURN OLD;
    END IF;

    SELECT * INTO v_existing FROM public.lb_bookings
      WHERE event_id = v_event_id AND lower(guest_email) = v_email
      LIMIT 1;

    IF v_existing.id IS NULL THEN
      RETURN OLD;
    END IF;

    IF v_existing.payment_status = 'pending' THEN
      DELETE FROM public.lb_bookings WHERE id = v_existing.id;
      INSERT INTO public.lb_sync_log(action, direction, lb_booking_id, event_id, guest_email, reason)
        VALUES ('delete', 'guest_invitations_to_lb', v_existing.id, v_event_id, v_email,
                'guest_invitations row deleted - pending booking removed');
    ELSIF v_existing.payment_status IN ('deposit_paid', 'paid', 'covered') THEN
      UPDATE public.lb_bookings
        SET removed = true, removed_at = now()
        WHERE id = v_existing.id;
      INSERT INTO public.lb_sync_log(action, direction, lb_booking_id, event_id, guest_email, reason)
        VALUES ('blocked', 'guest_invitations_to_lb', v_existing.id, v_event_id, v_email,
                'soft-removed - payment on file (' || v_existing.payment_status || ')');
    ELSE
      INSERT INTO public.lb_sync_log(action, direction, lb_booking_id, event_id, guest_email, reason)
        VALUES ('blocked', 'guest_invitations_to_lb', v_existing.id, v_event_id, v_email,
                'no-op - unexpected payment_status ' || COALESCE(v_existing.payment_status, 'NULL'));
    END IF;

    RETURN OLD;
  END IF;

  ------------------------------------------------------------------
  -- INSERT or UPDATE
  ------------------------------------------------------------------
  v_email := lower(trim(NEW.guest_email));
  IF v_email IS NULL OR v_email = '' OR NEW.event_id IS NULL THEN
    INSERT INTO public.lb_sync_log(action, direction, event_id, guest_email, reason)
      VALUES ('skipped', 'guest_invitations_to_lb', NEW.event_id, v_email,
              'missing event_id or email');
    RETURN NEW;
  END IF;

  SELECT id INTO v_event_id FROM public.lb_events WHERE id = NEW.event_id LIMIT 1;
  IF v_event_id IS NULL THEN
    INSERT INTO public.lb_sync_log(action, direction, event_id, guest_email, reason)
      VALUES ('error', 'guest_invitations_to_lb', NEW.event_id, v_email,
              'no lb_events row for event_id');
    RETURN NEW;
  END IF;

  -- Resolve section: prefer the uuid on guest_invitations; else ILIKE-match invite_group
  v_section_id := NULL;
  IF NEW.section_id IS NOT NULL THEN
    SELECT id, payment_schedule, nights
      INTO v_section_id, v_payment_schedule, v_nights
    FROM public.lb_room_sections
    WHERE id = NEW.section_id AND event_id = v_event_id
    LIMIT 1;
  END IF;

  IF v_section_id IS NULL THEN
    v_section_hint := lower(COALESCE(NEW.invite_group, ''));
    SELECT id, payment_schedule, nights
      INTO v_section_id, v_payment_schedule, v_nights
    FROM public.lb_room_sections
    WHERE event_id = v_event_id
      AND is_active = true
      AND (
        (v_section_hint LIKE '%farmhouse%' AND section_name ILIKE '%farmhouse%') OR
        (v_section_hint LIKE '%hearth%'    AND section_name ILIKE '%hearth%')    OR
        (v_section_hint LIKE '%grove%'     AND section_name ILIKE '%grove%')     OR
        (v_section_hint LIKE '%victoria%'  AND section_name ILIKE '%victoria%')
      )
    ORDER BY sort_order
    LIMIT 1;
  END IF;

  IF v_section_id IS NULL THEN
    INSERT INTO public.lb_sync_log(action, direction, event_id, guest_email, reason)
      VALUES ('error', 'guest_invitations_to_lb', v_event_id, v_email,
              'could not resolve lb_room_sections (section_id=' || COALESCE(NEW.section_id::text, 'NULL') ||
              ', invite_group=' || COALESCE(NEW.invite_group, 'NULL') || ')');
    RETURN NEW;
  END IF;

  SELECT * INTO v_existing FROM public.lb_bookings
    WHERE event_id = v_event_id AND lower(guest_email) = v_email
    LIMIT 1;

  IF v_existing.id IS NULL THEN
    INSERT INTO public.lb_bookings (
      event_id, section_id, guest_name, guest_email,
      nights_booked, payment_status, payment_schedule, is_primary
    ) VALUES (
      v_event_id, v_section_id,
      COALESCE(NEW.guest_name, ''), v_email,
      COALESCE(v_nights, 2),
      'pending',
      COALESCE(v_payment_schedule, 'full'),
      true
    )
    RETURNING * INTO v_existing;

    INSERT INTO public.lb_sync_log(action, direction, lb_booking_id, event_id, guest_email, reason)
      VALUES ('insert', 'guest_invitations_to_lb', v_existing.id, v_event_id, v_email,
              'created pending booking');
    RETURN NEW;
  END IF;

  -- Existing booking: gate by payment_status
  IF v_existing.payment_status = 'pending' THEN
    UPDATE public.lb_bookings
      SET guest_name = COALESCE(NEW.guest_name, guest_name),
          guest_email = v_email,
          section_id = v_section_id
      WHERE id = v_existing.id;
    INSERT INTO public.lb_sync_log(action, direction, lb_booking_id, event_id, guest_email, reason)
      VALUES ('update', 'guest_invitations_to_lb', v_existing.id, v_event_id, v_email,
              'updated pending booking');
  ELSIF v_existing.payment_status IN ('deposit_paid', 'paid', 'covered') THEN
    IF NEW.guest_name IS DISTINCT FROM v_existing.guest_name THEN
      UPDATE public.lb_bookings
        SET guest_name = NEW.guest_name
        WHERE id = v_existing.id;
      INSERT INTO public.lb_sync_log(action, direction, lb_booking_id, event_id, guest_email, reason)
        VALUES ('update', 'guest_invitations_to_lb', v_existing.id, v_event_id, v_email,
                'name-only update on paid booking');
    END IF;
    IF v_email <> lower(trim(v_existing.guest_email)) THEN
      INSERT INTO public.lb_sync_log(action, direction, lb_booking_id, event_id, guest_email, reason)
        VALUES ('blocked', 'guest_invitations_to_lb', v_existing.id, v_event_id, v_email,
                'email change blocked - payment on file (' || v_existing.payment_status || ')');
    END IF;
  ELSE
    INSERT INTO public.lb_sync_log(action, direction, lb_booking_id, event_id, guest_email, reason)
      VALUES ('blocked', 'guest_invitations_to_lb', v_existing.id, v_event_id, v_email,
              'no-op - unexpected payment_status ' || COALESCE(v_existing.payment_status, 'NULL'));
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Never block the Planning Hub save
  BEGIN
    INSERT INTO public.lb_sync_log(action, direction, event_id, guest_email, reason)
      VALUES ('error', 'guest_invitations_to_lb',
              COALESCE(NEW.event_id, OLD.event_id),
              COALESCE(lower(trim(NEW.guest_email)), lower(trim(OLD.guest_email))),
              SQLERRM);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_guest_invitations_to_lb_bookings ON public.guest_invitations;

CREATE TRIGGER trg_guest_invitations_to_lb_bookings
AFTER INSERT OR UPDATE OR DELETE ON public.guest_invitations
FOR EACH ROW
EXECUTE FUNCTION public.sync_guest_invitation_to_lb_booking();
