
-- Add payment update token + Stripe customer/payment method tracking to lb_bookings
ALTER TABLE public.lb_bookings
  ADD COLUMN IF NOT EXISTS payment_update_token uuid,
  ADD COLUMN IF NOT EXISTS payment_update_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text;

CREATE UNIQUE INDEX IF NOT EXISTS lb_bookings_payment_update_token_uidx
  ON public.lb_bookings (payment_update_token)
  WHERE payment_update_token IS NOT NULL;

-- Backfill tokens for existing split-schedule bookings that are still awaiting balance
WITH ev AS (
  SELECT id, check_in_date FROM public.lb_events
)
UPDATE public.lb_bookings b
SET payment_update_token = gen_random_uuid(),
    payment_update_token_expires_at =
      COALESCE(
        (SELECT (ev.check_in_date - INTERVAL '1 day')::timestamptz FROM ev WHERE ev.id = b.event_id),
        now() + INTERVAL '14 days'
      )
FROM ev
WHERE ev.id = b.event_id
  AND b.payment_schedule = 'deposit_50_balance_50'
  AND b.payment_status IN ('deposit_paid','payment_failed','pending')
  AND b.final_paid_at IS NULL
  AND b.removed = false
  AND b.payment_update_token IS NULL;
