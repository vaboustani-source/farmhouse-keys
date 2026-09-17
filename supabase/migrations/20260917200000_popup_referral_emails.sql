-- Referral emails are sent by the send-referral-email edge function, fired from
-- the database with pg_net so the Stripe webhook (the payment path) is untouched.
ALTER TABLE public.lb_bookings
  ADD COLUMN IF NOT EXISTS referral_code_emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS referral_credit_emailed_at timestamptz;

INSERT INTO public.lb_private_config (key, value)
SELECT 'referral_email_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
WHERE NOT EXISTS (SELECT 1 FROM public.lb_private_config WHERE key = 'referral_email_secret');

CREATE OR REPLACE FUNCTION public.lb_popup_referral_notify_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_kind text;
  v_secret text;
BEGIN
  IF NEW.referral_code IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.referral_code IS NULL)
     AND NEW.payment_status IN ('paid', 'deposit_paid') THEN
    v_kind := 'code';
  ELSIF TG_OP = 'UPDATE'
     AND coalesce(NEW.referral_credit_amount, 0) > 0
     AND coalesce(OLD.referral_credit_amount, 0) = 0 THEN
    v_kind := 'credit';
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
        body := jsonb_build_object('booking_id', NEW.id, 'kind', v_kind)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'referral email dispatch failed: %', SQLERRM;
  END;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_lb_bookings_referral_notify ON public.lb_bookings;
CREATE TRIGGER trg_lb_bookings_referral_notify
  AFTER INSERT OR UPDATE ON public.lb_bookings
  FOR EACH ROW EXECUTE FUNCTION public.lb_popup_referral_notify_trg();
