-- 1) Partial unique index: one active booking row per (guest_email, event_id, is_primary)
CREATE UNIQUE INDEX IF NOT EXISTS lb_bookings_one_active_per_guest
  ON public.lb_bookings (lower(guest_email), event_id, is_primary)
  WHERE payment_status IN ('pending','deposit_paid','paid','covered')
    AND (removed IS NOT TRUE);

-- 2) Acquire an optimistic Stripe-session lock on a booking.
--    Sets stripe_session_id = 'PENDING_<ms-epoch>' if currently NULL or stale (>5min).
--    Returns true if the lock was acquired, false otherwise.
CREATE OR REPLACE FUNCTION public.acquire_stripe_session_lock(p_booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_updated int;
BEGIN
  v_token := 'PENDING_' || (EXTRACT(EPOCH FROM now()) * 1000)::bigint::text;

  UPDATE public.lb_bookings
     SET stripe_session_id = v_token
   WHERE id = p_booking_id
     AND payment_status = 'pending'
     AND (
       stripe_session_id IS NULL
       OR (
         stripe_session_id LIKE 'PENDING_%'
         AND (
           CASE
             WHEN split_part(stripe_session_id, '_', 2) ~ '^\d+$'
               THEN (split_part(stripe_session_id, '_', 2))::bigint
             ELSE 0
           END
         ) < (EXTRACT(EPOCH FROM now() - interval '5 minutes') * 1000)::bigint
       )
     );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_stripe_session_lock(uuid) TO anon, authenticated, service_role;

-- 3) Cleanup stale PENDING_ session locks (>10 min old) on pending bookings.
CREATE OR REPLACE FUNCTION public.cleanup_stale_session_locks()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cleared int;
BEGIN
  UPDATE public.lb_bookings
     SET stripe_session_id = NULL
   WHERE payment_status = 'pending'
     AND stripe_session_id LIKE 'PENDING_%'
     AND (
       CASE
         WHEN split_part(stripe_session_id, '_', 2) ~ '^\d+$'
           THEN (split_part(stripe_session_id, '_', 2))::bigint
         ELSE 0
       END
     ) < (EXTRACT(EPOCH FROM now() - interval '10 minutes') * 1000)::bigint;

  GET DIAGNOSTICS v_cleared = ROW_COUNT;
  RETURN v_cleared;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_stale_session_locks() TO anon, authenticated, service_role;