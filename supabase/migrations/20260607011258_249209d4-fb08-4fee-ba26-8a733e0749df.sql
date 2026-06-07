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
         ) < (EXTRACT(EPOCH FROM now() - interval '1 minute') * 1000)::bigint
       )
     );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

UPDATE public.lb_bookings
   SET stripe_session_id = NULL
 WHERE payment_status = 'pending'
   AND stripe_session_id LIKE 'PENDING_%';