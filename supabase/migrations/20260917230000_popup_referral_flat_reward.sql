-- Victoria's final rules (9/17/26):
--   * The Quartet: two couples booking together get 10% off each stay.
--   * Every booked couple has a code. For EVERY couple that books with it, $50
--     comes off the referrer's remaining balance (stackable, capped at the balance).
--   * The invited couple gets 10% off the regular price (never stacked on another rate).
ALTER TABLE public.lb_events
  ADD COLUMN IF NOT EXISTS referral_reward_amount numeric,
  ADD COLUMN IF NOT EXISTS referral_friend_percent numeric;

UPDATE public.lb_events
   SET group_offer_percent = 10,
       referral_reward_amount = 50,
       referral_friend_percent = 10
 WHERE slug = 'couples-retreat' AND event_type = 'popup';

CREATE OR REPLACE FUNCTION public.lb_popup_referral_code_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF NEW.referral_code IS NULL
     AND NEW.payment_status IN ('paid', 'deposit_paid')
     AND EXISTS (SELECT 1 FROM lb_events e
                 WHERE e.id = NEW.event_id AND e.event_type = 'popup'
                   AND (e.referral_reward_amount IS NOT NULL OR e.referral_friend_percent IS NOT NULL)) THEN
    NEW.referral_code := lb_generate_referral_code(NEW.guest_name);
  END IF;
  RETURN NEW;
END $fn$;

-- $X per invited couple (a two-room booking is two couples), added to any
-- earlier credit and capped at what the referrer still owes.
CREATE OR REPLACE FUNCTION public.lb_popup_referral_credit_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_reward numeric;
  v_ref record;
  v_add numeric;
  v_balance numeric;
  v_new numeric;
BEGIN
  IF NEW.referred_by_booking_id IS NULL
     OR NEW.payment_status NOT IN ('paid', 'deposit_paid') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.payment_status IN ('paid', 'deposit_paid') THEN
    RETURN NEW;
  END IF;

  SELECT referral_reward_amount INTO v_reward FROM lb_events WHERE id = NEW.event_id AND event_type = 'popup';
  IF v_reward IS NULL OR v_reward <= 0 THEN RETURN NEW; END IF;

  SELECT id, event_id, guest_name, payment_status, total_amount, final_paid_at, referral_credit_amount
  INTO v_ref
  FROM lb_bookings
  WHERE id = NEW.referred_by_booking_id AND removed IS NOT TRUE
  FOR UPDATE;
  IF v_ref.id IS NULL THEN RETURN NEW; END IF;

  v_add := v_reward * greatest(1, coalesce(NEW.room_count, 1));
  v_balance := coalesce(v_ref.total_amount, 0) / 2;
  v_new := least(coalesce(v_ref.referral_credit_amount, 0) + v_add, v_balance);

  IF v_ref.payment_status = 'deposit_paid' AND v_ref.final_paid_at IS NULL
     AND v_new > coalesce(v_ref.referral_credit_amount, 0) THEN
    UPDATE lb_bookings
       SET referral_credit_amount = v_new,
           referral_credit_percent = NULL,
           referral_credit_from_booking_id = NEW.id,
           referral_credited_at = now()
     WHERE id = v_ref.id;
    INSERT INTO lb_activity_log (event_id, booking_id, actor, actor_name, action, label, metadata)
    VALUES (v_ref.event_id, v_ref.id, 'system', 'Referral program', 'referral.credit_applied',
            v_ref.guest_name || ' earned $' || (v_new - coalesce(v_ref.referral_credit_amount, 0))
              || ' off their remaining balance — ' || NEW.guest_name || ' booked with their code',
            jsonb_build_object('credit_added', v_new - coalesce(v_ref.referral_credit_amount, 0),
                               'credit_total', v_new, 'friend_booking_id', NEW.id));
  ELSE
    INSERT INTO lb_activity_log (event_id, booking_id, actor, actor_name, action, label, metadata)
    VALUES (v_ref.event_id, v_ref.id, 'system', 'Referral program', 'referral.earned_no_credit',
            NEW.guest_name || ' booked with ' || v_ref.guest_name
              || '''s code, but there is no remaining balance to take $' || v_add || ' off — decide a thank-you by hand',
            jsonb_build_object('friend_booking_id', NEW.id, 'referrer_status', v_ref.payment_status, 'reward', v_add));
  END IF;
  RETURN NEW;
END $fn$;

-- Tell the referrer every time their credit grows (not just the first time).
CREATE OR REPLACE FUNCTION public.lb_popup_referral_notify_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_body jsonb;
  v_secret text;
BEGIN
  IF NEW.referral_code IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.referral_code IS NULL)
     AND NEW.payment_status IN ('paid', 'deposit_paid') THEN
    v_body := jsonb_build_object('booking_id', NEW.id, 'kind', 'code');
  ELSIF TG_OP = 'UPDATE'
     AND coalesce(NEW.referral_credit_amount, 0) > coalesce(OLD.referral_credit_amount, 0) THEN
    v_body := jsonb_build_object('booking_id', NEW.id, 'kind', 'credit', 'force', true,
      'amount', coalesce(NEW.referral_credit_amount, 0) - coalesce(OLD.referral_credit_amount, 0));
  ELSE
    RETURN NEW;
  END IF;

  -- An email must never be able to fail a payment write.
  BEGIN
    SELECT value INTO v_secret FROM lb_private_config WHERE key = 'referral_email_secret';
    IF v_secret IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://orbzcbnhljpriwuvxsjr.supabase.co/functions/v1/send-referral-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-referral-secret', v_secret),
        body := v_body
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'referral email dispatch failed: %', SQLERRM;
  END;
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION public.check_popup_referral(p_event_slug text, p_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
  SELECT coalesce((
    SELECT jsonb_build_object('valid', true, 'first_name', split_part(b.guest_name, ' ', 1),
                              'friend_percent', e.referral_friend_percent)
    FROM lb_bookings b
    JOIN lb_events e ON e.id = b.event_id
    WHERE e.slug = p_event_slug AND e.event_type = 'popup'
      AND (e.referral_reward_amount IS NOT NULL OR e.referral_friend_percent IS NOT NULL)
      AND length(trim(coalesce(p_code, ''))) >= 5
      AND upper(b.referral_code) = upper(trim(p_code))
      AND b.removed IS NOT TRUE
      AND b.payment_status IN ('paid', 'deposit_paid')
    LIMIT 1
  ), jsonb_build_object('valid', false));
$fn$;

-- The three long RPCs are patched in place (exact-match replace, asserted) rather
-- than restated: only the referral lines change.
DO $patch$
DECLARE
  d text;
  anchor text;
BEGIN
  -- create_popup_booking ------------------------------------------------------
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'create_popup_booking';
  anchor := 'IF v_event.referral_percent IS NOT NULL AND trim(coalesce(p_referral_code';
  IF position(anchor in d) = 0 THEN RAISE EXCEPTION 'patch anchor 1 missing'; END IF;
  d := replace(d, anchor,
    'IF (v_event.referral_reward_amount IS NOT NULL OR v_event.referral_friend_percent IS NOT NULL) AND trim(coalesce(p_referral_code');
  anchor := 'group_offer_percent, group_offer_rooms, referral_percent';
  IF position(anchor in d) = 0 THEN RAISE EXCEPTION 'patch anchor 2 missing'; END IF;
  d := replace(d, anchor, 'group_offer_percent, group_offer_rooms, referral_reward_amount, referral_friend_percent');
  anchor := '  -- Event-level lock: capacity is shared across tiers, so serialize per event.';
  IF position(anchor in d) = 0 THEN RAISE EXCEPTION 'patch anchor 3 missing'; END IF;
  d := replace(d, anchor,
    '  -- An invited couple gets X% off the regular price. Never stacked: the best
  -- single rate wins, and a two-room booking already carries the group rate.
  IF v_referrer_id IS NOT NULL AND v_rooms = 1 AND coalesce(v_event.referral_friend_percent, 0) > 0
     AND round(v_regular * (1 - v_event.referral_friend_percent / 100), 2) < v_base THEN
    v_base := round(v_regular * (1 - v_event.referral_friend_percent / 100), 2);
    v_per_room := v_base;
    v_rate_type := ''referral'';
  END IF;

' || anchor);
  IF position('referral_percent' in d) > 0 THEN RAISE EXCEPTION 'create_popup_booking still references referral_percent'; END IF;
  EXECUTE d;

  -- get_popup_event -----------------------------------------------------------
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_popup_event';
  anchor := '''referral_percent'', v_ev.referral_percent';
  IF position(anchor in d) = 0 THEN RAISE EXCEPTION 'patch anchor 4 missing'; END IF;
  d := replace(d, anchor,
    '''referral'', CASE WHEN v_ev.referral_reward_amount IS NOT NULL OR v_ev.referral_friend_percent IS NOT NULL
        THEN jsonb_build_object(''reward_amount'', v_ev.referral_reward_amount, ''friend_percent'', v_ev.referral_friend_percent)
        ELSE NULL END');
  IF position('referral_percent' in d) = 0 THEN RAISE EXCEPTION 'patch anchor 5 missing'; END IF;
  d := replace(d, 'referral_percent', 'referral_reward_amount, referral_friend_percent');
  EXECUTE d;

  -- get_session_confirmation --------------------------------------------------
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'get_session_confirmation';
  anchor := '''referral_percent'', e.referral_percent';
  IF position(anchor in d) = 0 THEN RAISE EXCEPTION 'patch anchor 6 missing'; END IF;
  d := replace(d, anchor,
    '''referral_reward_amount'', e.referral_reward_amount, ''referral_friend_percent'', e.referral_friend_percent');
  EXECUTE d;
END $patch$;
