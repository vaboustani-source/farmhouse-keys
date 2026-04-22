-- Ensure auto-seed trigger fires when an lb_events row is created
DROP TRIGGER IF EXISTS lb_events_seed_sections ON public.lb_events;
CREATE TRIGGER lb_events_seed_sections
AFTER INSERT ON public.lb_events
FOR EACH ROW
EXECUTE FUNCTION public.lb_seed_event_sections();

-- Open read access on lb_events for any authenticated user (admin app)
DROP POLICY IF EXISTS "Authenticated read lb_events" ON public.lb_events;
CREATE POLICY "Authenticated read lb_events" ON public.lb_events
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated write lb_events" ON public.lb_events;
CREATE POLICY "Authenticated write lb_events" ON public.lb_events
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated rw lb_room_sections" ON public.lb_room_sections;
CREATE POLICY "Authenticated rw lb_room_sections" ON public.lb_room_sections
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated rw lb_section_addons" ON public.lb_section_addons;
CREATE POLICY "Authenticated rw lb_section_addons" ON public.lb_section_addons
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated rw lb_bookings" ON public.lb_bookings;
CREATE POLICY "Authenticated rw lb_bookings" ON public.lb_bookings
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public can read active events / sections / addons (for guest-facing booking links later)
DROP POLICY IF EXISTS "Public read active lb_room_sections" ON public.lb_room_sections;
CREATE POLICY "Public read active lb_room_sections" ON public.lb_room_sections
FOR SELECT USING (is_active = true);