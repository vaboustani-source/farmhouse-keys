-- Activity log table
CREATE TABLE public.lb_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NULL REFERENCES public.lb_events(id) ON DELETE CASCADE,
  booking_id uuid NULL REFERENCES public.lb_bookings(id) ON DELETE SET NULL,
  actor text NOT NULL CHECK (actor IN ('admin','guest','system','stripe')),
  actor_name text NULL,
  action text NOT NULL,
  label text NOT NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Grants (read for authenticated; service_role full; no anon)
GRANT SELECT ON public.lb_activity_log TO authenticated;
GRANT ALL ON public.lb_activity_log TO service_role;

-- RLS
ALTER TABLE public.lb_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all activity"
  ON public.lb_activity_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Event members read activity for their events"
  ON public.lb_activity_log
  FOR SELECT
  TO authenticated
  USING (event_id IS NOT NULL AND public.is_event_member(event_id, auth.uid()));

-- Indexes
CREATE INDEX idx_lb_activity_log_event_id ON public.lb_activity_log(event_id);
CREATE INDEX idx_lb_activity_log_created_at ON public.lb_activity_log(created_at DESC);
CREATE INDEX idx_lb_activity_log_actor ON public.lb_activity_log(actor);
CREATE INDEX idx_lb_activity_log_event_created ON public.lb_activity_log(event_id, created_at DESC);

-- Realtime
ALTER TABLE public.lb_activity_log REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lb_activity_log;