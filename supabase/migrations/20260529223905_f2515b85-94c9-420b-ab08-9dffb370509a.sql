CREATE TABLE public.lb_additional_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.lb_bookings(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.lb_events(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  description text NOT NULL,
  notes text,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'succeeded',
  charged_at timestamptz NOT NULL DEFAULT now(),
  charged_by text
);

CREATE INDEX lb_additional_charges_booking_idx ON public.lb_additional_charges (booking_id);
CREATE INDEX lb_additional_charges_event_idx ON public.lb_additional_charges (event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lb_additional_charges TO authenticated;
GRANT ALL ON public.lb_additional_charges TO service_role;

ALTER TABLE public.lb_additional_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage lb_additional_charges"
ON public.lb_additional_charges
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));