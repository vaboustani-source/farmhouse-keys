DROP POLICY IF EXISTS "Authenticated read lb_events" ON public.lb_events;
DROP POLICY IF EXISTS "Authenticated write lb_events" ON public.lb_events;
DROP POLICY IF EXISTS "Authenticated rw lb_room_sections" ON public.lb_room_sections;
DROP POLICY IF EXISTS "Authenticated rw lb_section_addons" ON public.lb_section_addons;
DROP POLICY IF EXISTS "Authenticated rw lb_bookings" ON public.lb_bookings;

CREATE POLICY "Admins rw lb_events" ON public.lb_events
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins rw lb_room_sections_v2" ON public.lb_room_sections
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins rw lb_section_addons_v2" ON public.lb_section_addons
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins rw lb_bookings_v2" ON public.lb_bookings
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));