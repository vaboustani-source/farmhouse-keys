-- One-page pop-up checkout: the room is held as soon as the guest's details
-- are complete and the payment form mounts on the same page, so details can
-- still change after the hold exists. Only the email matters to Stripe, so
-- name/phone/address edits update the pending hold in place without minting
-- a new checkout session; an email change re-holds under the new email and
-- releases the old hold so it stops counting against capacity.
-- (Applied to gf-planning-hub via Supabase MCP on 2026-09-15.)

CREATE OR REPLACE FUNCTION public.update_popup_booking_details(
  p_booking_id uuid,
  p_guest_name text,
  p_guest2_name text DEFAULT NULL,
  p_guest_phone text DEFAULT NULL,
  p_address_line1 text DEFAULT NULL,
  p_address_city text DEFAULT NULL,
  p_address_state text DEFAULT NULL,
  p_address_zip text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v record;
  v_display_name text;
BEGIN
  IF trim(coalesce(p_guest_name, '')) = ''
     OR trim(coalesce(p_guest_phone, '')) = ''
     OR trim(coalesce(p_address_line1, '')) = ''
     OR trim(coalesce(p_address_city, '')) = ''
     OR trim(coalesce(p_address_state, '')) = ''
     OR trim(coalesce(p_address_zip, '')) = '' THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  SELECT b.id, b.payment_status INTO v
  FROM public.lb_bookings b
  JOIN public.lb_events e ON e.id = b.event_id AND e.event_type = 'popup'
  WHERE b.id = p_booking_id AND b.removed IS NOT TRUE;
  IF v.id IS NULL OR v.payment_status <> 'pending' THEN
    RAISE EXCEPTION 'not_available';
  END IF;

  v_display_name := trim(p_guest_name);
  IF trim(coalesce(p_guest2_name, '')) <> '' THEN
    v_display_name := v_display_name || ' & ' || trim(p_guest2_name);
  END IF;

  UPDATE public.lb_bookings
     SET guest_name = v_display_name,
         guest2_name = nullif(trim(coalesce(p_guest2_name, '')), ''),
         guest_phone = trim(p_guest_phone),
         address_line1 = trim(p_address_line1),
         address_city = trim(p_address_city),
         address_state = trim(p_address_state),
         address_zip = trim(p_address_zip),
         address_country = 'US'
   WHERE id = p_booking_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_popup_hold(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.lb_bookings b
     SET hold_expires_at = now(),
         stripe_session_id = NULL
    FROM public.lb_events e
   WHERE e.id = b.event_id
     AND e.event_type = 'popup'
     AND b.id = p_booking_id
     AND b.payment_status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_popup_booking_details(uuid, text, text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_popup_hold(uuid) TO anon, authenticated;
