
-- Allow anon to read booking confirmation by session id, plus needed lookup tables.
GRANT SELECT ON public.lb_bookings TO anon;
GRANT SELECT ON public.lb_room_sections TO anon;
GRANT SELECT ON public.lb_events TO anon;

DROP POLICY IF EXISTS "Allow anon read by session id" ON public.lb_bookings;
CREATE POLICY "Allow anon read by session id"
  ON public.lb_bookings
  FOR SELECT
  TO anon
  USING (stripe_session_id IS NOT NULL);

DROP POLICY IF EXISTS "Allow anon read sections" ON public.lb_room_sections;
CREATE POLICY "Allow anon read sections"
  ON public.lb_room_sections
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon read events" ON public.lb_events;
CREATE POLICY "Allow anon read events"
  ON public.lb_events
  FOR SELECT
  TO anon
  USING (true);
