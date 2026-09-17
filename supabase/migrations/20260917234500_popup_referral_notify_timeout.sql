-- pg_net's default 5s timeout is shorter than an edge-function cold start plus a Resend call.
DO $patch$
DECLARE d text; anchor text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'lb_popup_referral_notify_trg';
  anchor := 'body := v_body';
  IF position(anchor in d) = 0 THEN RAISE EXCEPTION 'anchor missing'; END IF;
  IF position('timeout_milliseconds' in d) = 0 THEN
    d := replace(d, anchor, 'body := v_body,
        timeout_milliseconds := 20000');
    EXECUTE d;
  END IF;
END $patch$;
