DROP FUNCTION IF EXISTS public.lookup_guest_booking(text, text, text);

CREATE OR REPLACE FUNCTION public.lookup_guest_booking(p_email text, p_event_slug text, p_section_slug text)
 RETURNS TABLE(
   booking_id uuid, event_id uuid, section_id uuid, guest_name text, guest_email text,
   payment_status text, payment_schedule text,
   deposit_paid_at timestamp with time zone, final_paid_at timestamp with time zone,
   covered_at timestamp with time zone,
   total_amount numeric, base_amount numeric, addon_amount numeric, resort_fee numeric, tax_amount numeric,
   addons_selected jsonb, is_primary boolean, cot_requested boolean, cot_fee numeric,
   wedding_name text, couple_names text, wedding_date date,
   check_in_date date, check_out_date date,
   section_name text, guest_nightly_rate numeric, resort_fee_percent numeric,
   nights integer, booking_link_slug text,
   cot_1night_rate numeric, cot_2night_rate numeric,
   refund_amount numeric, refunded_at timestamp with time zone, refund_reason text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    b.id, b.event_id, b.section_id, b.guest_name, b.guest_email,
    b.payment_status,
    COALESCE(s.payment_schedule, b.payment_schedule) AS payment_schedule,
    b.deposit_paid_at, b.final_paid_at,
    b.covered_at, b.total_amount, b.base_amount, b.addon_amount, b.resort_fee,
    b.tax_amount, b.addons_selected, b.is_primary,
    b.cot_requested, b.cot_fee,
    e.wedding_name, e.couple_names, e.wedding_date, e.check_in_date, e.check_out_date,
    s.section_name, s.guest_nightly_rate, s.resort_fee_percent, s.nights, s.booking_link_slug,
    s.cot_1night_rate, s.cot_2night_rate,
    b.refund_amount, b.refunded_at, b.refund_reason
  FROM public.lb_bookings b
  JOIN public.lb_events e ON e.id = b.event_id
  JOIN public.lb_room_sections s ON s.id = b.section_id
  WHERE lower(b.guest_email) = lower(p_email)
    AND e.slug = p_event_slug
    AND s.booking_link_slug = p_section_slug
    AND s.is_active = true
  LIMIT 1
$function$;

GRANT EXECUTE ON FUNCTION public.lookup_guest_booking(text, text, text) TO anon, authenticated;