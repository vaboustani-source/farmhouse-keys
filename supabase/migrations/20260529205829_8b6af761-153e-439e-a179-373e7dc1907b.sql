
-- Refund support for lb_bookings
ALTER TABLE public.lb_bookings
  ADD COLUMN IF NOT EXISTS refund_amount numeric,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refund_notes text,
  ADD COLUMN IF NOT EXISTS refunded_by uuid,
  ADD COLUMN IF NOT EXISTS stripe_refund_id text;

-- Update writeback trigger to reset invoice flags when refunded
CREATE OR REPLACE FUNCTION public.sync_lb_booking_to_lodging_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_assignment_id uuid;
  v_inv1 boolean := false;
  v_inv2 boolean := false;
  v_invF boolean := false;
  v_pmt_date date := null;
BEGIN
  v_email := lower(trim(NEW.guest_email));
  IF v_email IS NULL OR v_email = '' OR NEW.event_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_assignment_id FROM public.lodging_assignments
    WHERE event_id = NEW.event_id AND lower(trim(assigned_guest_email)) = v_email LIMIT 1;
  IF v_assignment_id IS NULL THEN RETURN NEW; END IF;

  -- Refund: reset invoice flags + clear completed date
  IF NEW.payment_status = 'refunded' THEN
    UPDATE public.lodging_assignments
      SET payment_status         = 'refunded',
          invoice_1_sent         = false,
          invoice_2_sent         = false,
          invoice_final_sent     = false,
          payment_completed_date = NULL
    WHERE id = v_assignment_id;

    INSERT INTO public.lb_sync_log(action,direction,lodging_assignment_id,lb_booking_id,event_id,guest_email,reason)
      VALUES('refund','lb_to_hub',v_assignment_id,NEW.id,NEW.event_id,v_email,
        'refund processed; invoice flags cleared');
    RETURN NEW;
  END IF;

  IF NEW.payment_status IN ('paid','covered') THEN
    v_inv1 := true; v_inv2 := true; v_invF := true;
    v_pmt_date := COALESCE(NEW.final_paid_at::date, NEW.covered_at::date, NEW.deposit_paid_at::date, now()::date);
  ELSIF NEW.payment_status = 'deposit_paid' THEN
    v_inv1 := true;
  END IF;

  UPDATE public.lodging_assignments
    SET payment_status            = NEW.payment_status,
        stripe_session_id         = COALESCE(NEW.stripe_session_id, stripe_session_id),
        stripe_payment_intent_id  = COALESCE(NEW.stripe_payment_intent_id, stripe_payment_intent_id),
        deposit_paid_at           = COALESCE(NEW.deposit_paid_at, deposit_paid_at),
        final_paid_at             = COALESCE(NEW.final_paid_at, final_paid_at),
        invoice_1_sent            = invoice_1_sent OR v_inv1,
        invoice_2_sent            = invoice_2_sent OR v_inv2,
        invoice_final_sent        = invoice_final_sent OR v_invF,
        payment_completed_date    = COALESCE(payment_completed_date, v_pmt_date)
  WHERE id = v_assignment_id;

  INSERT INTO public.lb_sync_log(action,direction,lodging_assignment_id,lb_booking_id,event_id,guest_email,reason)
    VALUES('update','lb_to_hub',v_assignment_id,NEW.id,NEW.event_id,v_email,
      'payment_status='||COALESCE(NEW.payment_status,'NULL'));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.lb_sync_log(action,direction,lb_booking_id,event_id,guest_email,reason)
    VALUES('error','lb_to_hub',NEW.id,NEW.event_id,v_email,SQLERRM);
  RETURN NEW;
END;
$function$;
