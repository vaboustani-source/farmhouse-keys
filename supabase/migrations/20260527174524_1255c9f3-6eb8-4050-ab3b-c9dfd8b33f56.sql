ALTER TABLE public.lb_events
  ADD COLUMN IF NOT EXISTS couple_access_token uuid NOT NULL DEFAULT gen_random_uuid();

UPDATE public.lb_events SET couple_access_token = gen_random_uuid()
  WHERE couple_access_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lb_events_couple_access_token_key
  ON public.lb_events (couple_access_token);

ALTER TABLE public.lb_bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.lookup_tracker_by_token(p_token uuid)
RETURNS TABLE (
  event_id uuid,
  wedding_name text,
  couple_names text,
  check_in_date date,
  check_out_date date,
  sections jsonb,
  bookings jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ev AS (
    SELECT * FROM public.lb_events WHERE couple_access_token = p_token LIMIT 1
  ),
  secs AS (
    SELECT s.id, s.section_name, s.sort_order, s.total_rooms
    FROM public.lb_room_sections s
    JOIN ev ON ev.id = s.event_id
    WHERE s.is_active = true
    ORDER BY s.sort_order
  ),
  bks AS (
    SELECT b.id, b.section_id, b.guest_name, b.payment_status,
           b.booked_at, b.deposit_paid_at, b.final_paid_at, b.covered_at,
           b.reminder_sent_at, b.reminder_count
    FROM public.lb_bookings b
    JOIN ev ON ev.id = b.event_id
  )
  SELECT
    ev.id, ev.wedding_name, ev.couple_names,
    ev.check_in_date, ev.check_out_date,
    COALESCE((SELECT jsonb_agg(to_jsonb(secs.*) ORDER BY secs.sort_order) FROM secs), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(bks.*)) FROM bks), '[]'::jsonb)
  FROM ev;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_tracker_by_token(uuid) TO anon, authenticated;