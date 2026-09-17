-- Pop-up weekends: (1) a two-room group offer ("The Quartet": reserve two rooms
-- together, 15% off both) and (2) guest referral codes (a friend books with the
-- code -> the referring couple gets 15% off their remaining balance).
--
-- A group booking is ONE lb_bookings row with room_count = 2 and a stamped
-- base_amount covering both rooms, so checkout, deposits, balance collection
-- and refunds keep working unchanged. Capacity now counts rooms, not rows.

ALTER TABLE public.lb_events
  ADD COLUMN IF NOT EXISTS group_offer_name text,
  ADD COLUMN IF NOT EXISTS group_offer_percent numeric,
  ADD COLUMN IF NOT EXISTS group_offer_rooms int NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS referral_percent numeric;

ALTER TABLE public.lb_bookings
  ADD COLUMN IF NOT EXISTS room_count int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS room2_guest1_name text,
  ADD COLUMN IF NOT EXISTS room2_guest2_name text,
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by_booking_id uuid REFERENCES public.lb_bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_credit_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_credit_percent numeric,
  ADD COLUMN IF NOT EXISTS referral_credit_from_booking_id uuid,
  ADD COLUMN IF NOT EXISTS referral_credited_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.lb_bookings ADD CONSTRAINT lb_bookings_room_count_check CHECK (room_count BETWEEN 1 AND 4);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS lb_bookings_referral_code_key
  ON public.lb_bookings (upper(referral_code)) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS lb_bookings_referred_by_idx
  ON public.lb_bookings (referred_by_booking_id) WHERE referred_by_booking_id IS NOT NULL;

/* ───────────── referral codes ───────────── */

CREATE OR REPLACE FUNCTION public.lb_generate_referral_code(p_name text)
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path TO 'public' AS $fn$
DECLARE
  v_prefix text;
  v_code text;
  v_alpha constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  n int := 0;
BEGIN
  v_prefix := upper(left(regexp_replace(split_part(trim(coalesce(p_name, '')), ' ', 1), '[^A-Za-z]', '', 'g'), 8));
  IF v_prefix = '' THEN v_prefix := 'GFH'; END IF;
  LOOP
    v_code := v_prefix || '-';
    FOR i IN 1..4 LOOP
      v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM lb_bookings WHERE upper(referral_code) = v_code);
    n := n + 1;
    IF n > 25 THEN RAISE EXCEPTION 'referral_code_generation_failed'; END IF;
  END LOOP;
  RETURN v_code;
END $fn$;
REVOKE ALL ON FUNCTION public.lb_generate_referral_code(text) FROM PUBLIC, anon, authenticated;

-- Every paid pop-up booking gets a code the moment its first payment lands.
CREATE OR REPLACE FUNCTION public.lb_popup_referral_code_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF NEW.referral_code IS NULL
     AND NEW.payment_status IN ('paid', 'deposit_paid')
     AND EXISTS (SELECT 1 FROM lb_events e
                 WHERE e.id = NEW.event_id AND e.event_type = 'popup' AND e.referral_percent IS NOT NULL) THEN
    NEW.referral_code := lb_generate_referral_code(NEW.guest_name);
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_lb_bookings_referral_code ON public.lb_bookings;
CREATE TRIGGER trg_lb_bookings_referral_code
  BEFORE INSERT OR UPDATE OF payment_status ON public.lb_bookings
  FOR EACH ROW EXECUTE FUNCTION public.lb_popup_referral_code_trg();

-- When a referred friend's first payment lands, credit the referring couple:
-- referral_percent off their REMAINING balance (50% of total on the split plan).
-- One credit per couple. A couple already paid in full has no balance to
-- discount — that is logged for staff instead of silently dropped.
CREATE OR REPLACE FUNCTION public.lb_popup_referral_credit_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_pct numeric;
  v_ref record;
  v_credit numeric;
BEGIN
  IF NEW.referred_by_booking_id IS NULL
     OR NEW.payment_status NOT IN ('paid', 'deposit_paid') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.payment_status IN ('paid', 'deposit_paid') THEN
    RETURN NEW;
  END IF;

  SELECT referral_percent INTO v_pct FROM lb_events WHERE id = NEW.event_id AND event_type = 'popup';
  IF v_pct IS NULL OR v_pct <= 0 THEN RETURN NEW; END IF;

  SELECT id, event_id, guest_name, payment_status, total_amount, final_paid_at, referral_credit_amount
  INTO v_ref
  FROM lb_bookings
  WHERE id = NEW.referred_by_booking_id AND removed IS NOT TRUE
  FOR UPDATE;
  IF v_ref.id IS NULL THEN RETURN NEW; END IF;

  IF v_ref.payment_status = 'deposit_paid' AND v_ref.final_paid_at IS NULL
     AND coalesce(v_ref.referral_credit_amount, 0) = 0 THEN
    v_credit := round(coalesce(v_ref.total_amount, 0) / 2 * v_pct / 100, 2);
    UPDATE lb_bookings
       SET referral_credit_amount = v_credit,
           referral_credit_percent = v_pct,
           referral_credit_from_booking_id = NEW.id,
           referral_credited_at = now()
     WHERE id = v_ref.id;
    INSERT INTO lb_activity_log (event_id, booking_id, actor, actor_name, action, label, metadata)
    VALUES (v_ref.event_id, v_ref.id, 'system', 'Referral program', 'referral.credit_applied',
            v_ref.guest_name || ' earned ' || v_pct || '% off their remaining balance — ' || NEW.guest_name || ' booked with their code',
            jsonb_build_object('credit_amount', v_credit, 'percent', v_pct, 'friend_booking_id', NEW.id));
  ELSE
    INSERT INTO lb_activity_log (event_id, booking_id, actor, actor_name, action, label, metadata)
    VALUES (v_ref.event_id, v_ref.id, 'system', 'Referral program', 'referral.earned_no_credit',
            NEW.guest_name || ' booked with ' || v_ref.guest_name || '''s code, but no balance credit was applied ('
              || CASE WHEN coalesce(v_ref.referral_credit_amount, 0) > 0 THEN 'already credited once' ELSE 'no remaining balance' END
              || ') — decide a thank-you by hand',
            jsonb_build_object('friend_booking_id', NEW.id, 'referrer_status', v_ref.payment_status));
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_lb_bookings_referral_credit ON public.lb_bookings;
CREATE TRIGGER trg_lb_bookings_referral_credit
  AFTER INSERT OR UPDATE OF payment_status ON public.lb_bookings
  FOR EACH ROW EXECUTE FUNCTION public.lb_popup_referral_credit_trg();

-- Live check for the booking page: is this a real code for this weekend?
CREATE OR REPLACE FUNCTION public.check_popup_referral(p_event_slug text, p_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
  SELECT coalesce((
    SELECT jsonb_build_object('valid', true, 'first_name', split_part(b.guest_name, ' ', 1))
    FROM lb_bookings b
    JOIN lb_events e ON e.id = b.event_id
    WHERE e.slug = p_event_slug AND e.event_type = 'popup' AND e.referral_percent IS NOT NULL
      AND length(trim(coalesce(p_code, ''))) >= 5
      AND upper(b.referral_code) = upper(trim(p_code))
      AND b.removed IS NOT TRUE
      AND b.payment_status IN ('paid', 'deposit_paid')
    LIMIT 1
  ), jsonb_build_object('valid', false));
$fn$;
GRANT EXECUTE ON FUNCTION public.check_popup_referral(text, text) TO anon, authenticated, service_role;

/* ───────────── create_popup_booking: rooms + referral ───────────── */

DROP FUNCTION IF EXISTS public.create_popup_booking(text, uuid, text, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_popup_booking(
  p_event_slug text, p_section_id uuid, p_guest_name text, p_guest_email text, p_guest_phone text,
  p_guest2_name text DEFAULT NULL, p_address_line1 text DEFAULT NULL, p_address_line2 text DEFAULT NULL,
  p_address_city text DEFAULT NULL, p_address_state text DEFAULT NULL, p_address_zip text DEFAULT NULL,
  p_room_count int DEFAULT 1, p_room2_guest1_name text DEFAULT NULL, p_room2_guest2_name text DEFAULT NULL,
  p_referral_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_event record;
  v_section record;
  v_taken int;
  v_event_taken int;
  v_existing record;
  v_booking_id uuid;
  v_email text;
  v_waitlisted boolean;
  v_rate_type text;
  v_base numeric;
  v_per_room numeric;
  v_regular numeric;
  v_rooms int;
  v_display_name text;
  v_referrer_id uuid;
BEGIN
  v_email := lower(trim(p_guest_email));
  IF v_email IS NULL OR v_email = ''
     OR trim(coalesce(p_guest_name, '')) = ''
     OR trim(coalesce(p_guest_phone, '')) = ''
     OR trim(coalesce(p_address_line1, '')) = ''
     OR trim(coalesce(p_address_city, '')) = ''
     OR trim(coalesce(p_address_state, '')) = ''
     OR trim(coalesce(p_address_zip, '')) = '' THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  SELECT id, status, waitlist_opens_at, public_opens_at, total_capacity, sale_ends_at,
         group_offer_percent, group_offer_rooms, referral_percent
  INTO v_event
  FROM public.lb_events
  WHERE slug = p_event_slug AND event_type = 'popup';
  IF v_event.id IS NULL OR v_event.status <> 'active' THEN
    RAISE EXCEPTION 'not_available';
  END IF;

  -- Rooms: 1, or exactly the group-offer size while that offer is on.
  v_rooms := coalesce(p_room_count, 1);
  IF v_rooms <> 1 THEN
    IF v_event.group_offer_percent IS NULL OR v_rooms <> coalesce(v_event.group_offer_rooms, 2) THEN
      RAISE EXCEPTION 'invalid_input';
    END IF;
    IF trim(coalesce(p_room2_guest1_name, '')) = '' OR trim(coalesce(p_room2_guest2_name, '')) = '' THEN
      RAISE EXCEPTION 'invalid_input';
    END IF;
  END IF;

  v_waitlisted := EXISTS (
    SELECT 1 FROM public.lb_waitlist_members w
    WHERE w.event_id = v_event.id AND lower(w.email) = v_email
  );

  IF v_event.waitlist_opens_at IS NOT NULL AND now() < v_event.waitlist_opens_at THEN
    RAISE EXCEPTION 'not_open';
  END IF;
  IF v_event.public_opens_at IS NOT NULL AND now() < v_event.public_opens_at AND NOT v_waitlisted THEN
    RAISE EXCEPTION 'waitlist_only';
  END IF;

  SELECT id, event_id, total_rooms, nights, regular_package_price, promo_package_price,
         sale_package_price, guest_nightly_rate, promo_active
  INTO v_section
  FROM public.lb_room_sections
  WHERE id = p_section_id AND event_id = v_event.id AND is_active = true;
  IF v_section.id IS NULL THEN
    RAISE EXCEPTION 'not_available';
  END IF;

  -- Three price levels: insider (waitlist/past-couples email match, or
  -- promo_active for an everyone-gets-promo period) > public sale window > regular.
  v_regular := coalesce(v_section.regular_package_price,
                        coalesce(v_section.guest_nightly_rate, 0) * coalesce(v_section.nights, 2));
  IF v_section.promo_package_price IS NOT NULL
     AND (v_waitlisted OR coalesce(v_section.promo_active, false)) THEN
    v_rate_type := 'waitlist';
    v_base := v_section.promo_package_price;
  ELSIF v_section.sale_package_price IS NOT NULL
        AND v_event.sale_ends_at IS NOT NULL AND now() <= v_event.sale_ends_at THEN
    v_rate_type := 'sale';
    v_base := v_section.sale_package_price;
  ELSE
    v_rate_type := 'regular';
    v_base := v_regular;
  END IF;

  -- Group offer: X% off the REGULAR price on every room. It does not stack on
  -- a waitlist/sale rate, but a guest never pays more per room than their own rate.
  IF v_rooms > 1 THEN
    v_per_room := least(v_base, round(v_regular * (1 - v_event.group_offer_percent / 100), 2));
    v_base := v_per_room * v_rooms;
    v_rate_type := 'group';
  ELSE
    v_per_room := v_base;
  END IF;

  v_display_name := trim(p_guest_name);
  IF trim(coalesce(p_guest2_name, '')) <> '' THEN
    v_display_name := v_display_name || ' & ' || trim(p_guest2_name);
  END IF;

  -- Referral: a real code from another paid couple on this weekend. A bad or
  -- self-referring code is ignored rather than blocking the reservation.
  IF v_event.referral_percent IS NOT NULL AND trim(coalesce(p_referral_code, '')) <> '' THEN
    SELECT b.id INTO v_referrer_id
    FROM public.lb_bookings b
    WHERE b.event_id = v_event.id
      AND upper(b.referral_code) = upper(trim(p_referral_code))
      AND b.removed IS NOT TRUE
      AND b.payment_status IN ('paid', 'deposit_paid')
      AND lower(b.guest_email) <> v_email
    LIMIT 1;
  END IF;

  -- Event-level lock: capacity is shared across tiers, so serialize per event.
  PERFORM pg_advisory_xact_lock(hashtext(v_event.id::text));

  SELECT id, section_id, payment_status INTO v_existing
  FROM public.lb_bookings
  WHERE event_id = v_event.id
    AND lower(guest_email) = v_email
    AND removed IS NOT TRUE
  ORDER BY booked_at DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL
     AND v_existing.payment_status IN ('paid', 'deposit_paid', 'covered') THEN
    RAISE EXCEPTION 'already_booked';
  END IF;

  -- Tier gate: the REAL cap only (displayed stock is cosmetic). Counts rooms.
  SELECT coalesce(sum(room_count), 0) INTO v_taken
  FROM public.lb_bookings
  WHERE section_id = p_section_id
    AND removed IS NOT TRUE
    AND id IS DISTINCT FROM v_existing.id
    AND (
      payment_status IN ('paid', 'deposit_paid', 'covered')
      OR (payment_status = 'pending' AND hold_expires_at > now())
    );
  IF v_taken + v_rooms > v_section.total_rooms THEN
    RAISE EXCEPTION 'sold_out';
  END IF;

  -- Estate-wide gate: all tiers draw from one pool of rooms.
  IF v_event.total_capacity IS NOT NULL THEN
    SELECT coalesce(sum(room_count), 0) INTO v_event_taken
    FROM public.lb_bookings
    WHERE event_id = v_event.id
      AND removed IS NOT TRUE
      AND id IS DISTINCT FROM v_existing.id
      AND (
        payment_status IN ('paid', 'deposit_paid', 'covered')
        OR (payment_status = 'pending' AND hold_expires_at > now())
      );
    IF v_event_taken + v_rooms > v_event.total_capacity THEN
      RAISE EXCEPTION 'sold_out';
    END IF;
  END IF;

  IF v_existing.id IS NOT NULL AND v_existing.payment_status = 'pending' THEN
    UPDATE public.lb_bookings
      SET guest_name = v_display_name,
          guest2_name = nullif(trim(coalesce(p_guest2_name, '')), ''),
          guest_phone = nullif(trim(coalesce(p_guest_phone, '')), ''),
          address_line1 = trim(p_address_line1),
          address_line2 = nullif(trim(coalesce(p_address_line2, '')), ''),
          address_city = trim(p_address_city),
          address_state = trim(p_address_state),
          address_zip = trim(p_address_zip),
          address_country = 'US',
          section_id = p_section_id,
          nights_booked = coalesce(v_section.nights, 2),
          hold_expires_at = now() + interval '45 minutes',
          stripe_session_id = NULL,
          rate_type = v_rate_type,
          base_amount = v_base,
          payment_schedule = 'full',
          room_count = v_rooms,
          room2_guest1_name = CASE WHEN v_rooms > 1 THEN trim(p_room2_guest1_name) END,
          room2_guest2_name = CASE WHEN v_rooms > 1 THEN trim(p_room2_guest2_name) END,
          referred_by_booking_id = v_referrer_id
      WHERE id = v_existing.id;
    v_booking_id := v_existing.id;
  ELSE
    INSERT INTO public.lb_bookings (
      event_id, section_id, guest_name, guest2_name, guest_email, guest_phone,
      address_line1, address_line2, address_city, address_state, address_zip, address_country,
      nights_booked, payment_status, payment_schedule, is_primary,
      hold_expires_at, rate_type, base_amount,
      room_count, room2_guest1_name, room2_guest2_name, referred_by_booking_id
    ) VALUES (
      v_event.id, p_section_id, v_display_name,
      nullif(trim(coalesce(p_guest2_name, '')), ''), v_email,
      nullif(trim(coalesce(p_guest_phone, '')), ''),
      trim(p_address_line1), nullif(trim(coalesce(p_address_line2, '')), ''),
      trim(p_address_city), trim(p_address_state), trim(p_address_zip), 'US',
      coalesce(v_section.nights, 2), 'pending', 'full', true,
      now() + interval '45 minutes', v_rate_type, v_base,
      v_rooms,
      CASE WHEN v_rooms > 1 THEN trim(p_room2_guest1_name) END,
      CASE WHEN v_rooms > 1 THEN trim(p_room2_guest2_name) END,
      v_referrer_id
    ) RETURNING id INTO v_booking_id;
  END IF;

  INSERT INTO public.lb_activity_log (event_id, booking_id, actor, actor_name, action, label, metadata)
  VALUES (v_event.id, v_booking_id, 'guest', v_display_name, 'booking.popup_reserved',
          v_display_name || ' started a pop-up reservation'
            || CASE WHEN v_rooms > 1 THEN ' (' || v_rooms || ' rooms)' ELSE '' END,
          jsonb_build_object('section_id', p_section_id, 'rate_type', v_rate_type,
                             'room_count', v_rooms, 'referred_by_booking_id', v_referrer_id));

  RETURN jsonb_build_object(
    'booking_id', v_booking_id,
    'base_amount', v_base,
    'rate_type', v_rate_type,
    'room_count', v_rooms,
    'per_room_amount', v_per_room,
    'referral_applied', v_referrer_id IS NOT NULL
  );
END;
$function$;
GRANT EXECUTE ON FUNCTION public.create_popup_booking(text, uuid, text, text, text, text, text, text, text, text, text, int, text, text, text)
  TO anon, authenticated, service_role;

/* ───────────── update_popup_booking_details: second couple's names ───────────── */

DROP FUNCTION IF EXISTS public.update_popup_booking_details(uuid, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.update_popup_booking_details(
  p_booking_id uuid, p_guest_name text, p_guest2_name text DEFAULT NULL, p_guest_phone text DEFAULT NULL,
  p_address_line1 text DEFAULT NULL, p_address_city text DEFAULT NULL, p_address_state text DEFAULT NULL,
  p_address_zip text DEFAULT NULL, p_room2_guest1_name text DEFAULT NULL, p_room2_guest2_name text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v record;
  v_display_name text;
BEGIN
  IF trim(coalesce(p_guest_name, '')) = ''
     OR trim(coalesce(p_guest_phone, '')) = ''
     OR trim(coalesce(p_address_line1, '')) = ''
     OR trim(coalesce(p_address_city, '')) = ''
     OR trim(coalesce(p_address_state, '')) = ''
     OR trim(coalesce(p_address_zip, '')) = '' THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;

  SELECT b.id, b.payment_status, b.room_count INTO v
  FROM public.lb_bookings b
  JOIN public.lb_events e ON e.id = b.event_id AND e.event_type = 'popup'
  WHERE b.id = p_booking_id AND b.removed IS NOT TRUE;
  IF v.id IS NULL OR v.payment_status <> 'pending' THEN
    RAISE EXCEPTION 'not_available';
  END IF;

  v_display_name := trim(p_guest_name);
  IF trim(coalesce(p_guest2_name, '')) <> '' THEN
    v_display_name := v_display_name || ' & ' || trim(p_guest2_name);
  END IF;

  UPDATE public.lb_bookings
     SET guest_name = v_display_name,
         guest2_name = nullif(trim(coalesce(p_guest2_name, '')), ''),
         guest_phone = trim(p_guest_phone),
         address_line1 = trim(p_address_line1),
         address_city = trim(p_address_city),
         address_state = trim(p_address_state),
         address_zip = trim(p_address_zip),
         address_country = 'US',
         room2_guest1_name = CASE WHEN v.room_count > 1
           THEN coalesce(nullif(trim(coalesce(p_room2_guest1_name, '')), ''), room2_guest1_name) END,
         room2_guest2_name = CASE WHEN v.room_count > 1
           THEN coalesce(nullif(trim(coalesce(p_room2_guest2_name, '')), ''), room2_guest2_name) END
   WHERE id = p_booking_id;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.update_popup_booking_details(uuid, text, text, text, text, text, text, text, text, text)
  TO anon, authenticated, service_role;

/* ───────────── get_popup_event: count rooms, expose the offers ───────────── */

CREATE OR REPLACE FUNCTION public.get_popup_event(p_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_ev record;
  v_tiers jsonb;
  v_itin jsonb;
  v_phase text;
  v_event_remaining int;
  v_sale_active boolean;
  v_sale_extended boolean;
BEGIN
  SELECT id, slug, wedding_name, hero_intro, status, check_in_date, check_out_date,
         coalesce(check_in_time, '16:00') AS check_in_time,
         coalesce(check_out_time, '11:00') AS check_out_time,
         coalesce(nights, 2) AS nights,
         waitlist_opens_at, public_opens_at, balance_due_on, cancel_cutoff_days,
         total_capacity, sale_original_ends_at, sale_ends_at,
         group_offer_name, group_offer_percent, coalesce(group_offer_rooms, 2) AS group_offer_rooms,
         referral_percent
  INTO v_ev
  FROM lb_events
  WHERE slug = p_slug AND event_type = 'popup';

  IF v_ev.id IS NULL THEN
    RETURN jsonb_build_object('event', NULL, 'tiers', '[]'::jsonb, 'itinerary', '[]'::jsonb);
  END IF;

  v_phase := CASE
    WHEN v_ev.public_opens_at IS NULL OR now() >= v_ev.public_opens_at THEN 'public'
    WHEN v_ev.waitlist_opens_at IS NOT NULL AND now() >= v_ev.waitlist_opens_at THEN 'waitlist_only'
    ELSE 'preopen'
  END;

  -- Sale window state, computed server-side so client clocks can't skew it.
  v_sale_active := v_ev.sale_ends_at IS NOT NULL AND now() <= v_ev.sale_ends_at;
  v_sale_extended := v_sale_active
    AND v_ev.sale_original_ends_at IS NOT NULL AND now() > v_ev.sale_original_ends_at;

  IF v_ev.total_capacity IS NOT NULL THEN
    SELECT greatest(0, v_ev.total_capacity - coalesce(sum(b.room_count), 0))::int INTO v_event_remaining
    FROM lb_bookings b
    WHERE b.event_id = v_ev.id
      AND b.removed IS NOT TRUE
      AND (
        b.payment_status IN ('paid', 'deposit_paid', 'covered')
        OR (b.payment_status = 'pending' AND b.hold_expires_at > now())
      );
  ELSE
    v_event_remaining := NULL;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.sort_order), '[]'::jsonb) INTO v_tiers
  FROM (
    SELECT s.id,
           s.section_name,
           s.tagline,
           s.regular_package_price,
           s.promo_package_price,
           s.sale_package_price,
           coalesce(s.promo_active, false) AS promo_active,
           CASE
             WHEN coalesce(s.promo_active, false) AND s.promo_package_price IS NOT NULL
               THEN s.promo_package_price
             WHEN v_sale_active AND s.sale_package_price IS NOT NULL
               THEN s.sale_package_price
             WHEN s.regular_package_price IS NOT NULL
               THEN s.regular_package_price
             ELSE coalesce(s.guest_nightly_rate, 0) * coalesce(s.nights, 2)
           END AS selling_price,
           coalesce(s.total_rooms, 0) AS total_rooms,
           CASE
             WHEN real_rem.n <= 0 THEN 0
             WHEN s.display_stock_start IS NULL THEN real_rem.n
             ELSE greatest(1, least(s.display_stock_start - booked.n, real_rem.n))
           END AS remaining,
           -- The true room count left (never the cosmetic one): gates the two-room offer.
           real_rem.n AS rooms_available,
           (s.display_stock_start IS NOT NULL OR coalesce(s.total_rooms, 0) <= 20) AS show_scarcity,
           coalesce(s.is_featured, false) AS is_featured,
           coalesce(s.nights, 2) AS nights,
           s.booking_link_slug,
           coalesce(s.sort_order, 0) AS sort_order,
           coalesce(s.resort_fee_percent, 0) AS resort_fee_percent,
           coalesce(s.cot_1night_rate, 100) AS cot_1night_rate,
           coalesce(s.cot_2night_rate, 150) AS cot_2night_rate
    FROM lb_room_sections s
    CROSS JOIN LATERAL (
      SELECT coalesce(sum(b.room_count), 0)::int AS n
      FROM lb_bookings b
      WHERE b.section_id = s.id
        AND b.removed IS NOT TRUE
        AND (
          b.payment_status IN ('paid', 'deposit_paid', 'covered')
          OR (b.payment_status = 'pending' AND b.hold_expires_at > now())
        )
    ) booked
    CROSS JOIN LATERAL (
      SELECT least(
        greatest(0, coalesce(s.total_rooms, 0) - booked.n),
        coalesce(v_event_remaining, 999999)
      )::int AS n
    ) real_rem
    WHERE s.event_id = v_ev.id AND s.is_active = true
  ) t;

  SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.day_number, i.sort_order), '[]'::jsonb) INTO v_itin
  FROM (
    SELECT id, day_number, time_label, activity, note,
           tier1_included, tier2_included, tier3_included, sort_order
    FROM lb_itinerary_items
    WHERE event_id = v_ev.id
  ) i;

  RETURN jsonb_build_object(
    'event', jsonb_build_object(
      'id', v_ev.id,
      'slug', v_ev.slug,
      'title', v_ev.wedding_name,
      'hero_intro', v_ev.hero_intro,
      'status', v_ev.status,
      'check_in_date', v_ev.check_in_date,
      'check_out_date', v_ev.check_out_date,
      'check_in_time', v_ev.check_in_time,
      'check_out_time', v_ev.check_out_time,
      'nights', v_ev.nights,
      'phase', v_phase,
      'waitlist_opens_at', v_ev.waitlist_opens_at,
      'public_opens_at', v_ev.public_opens_at,
      'balance_due_on', v_ev.balance_due_on,
      'split_available', (v_ev.balance_due_on IS NOT NULL AND current_date <= v_ev.balance_due_on),
      'cancel_by_date', CASE WHEN v_ev.cancel_cutoff_days IS NOT NULL
        THEN (v_ev.check_in_date - v_ev.cancel_cutoff_days)::text ELSE NULL END,
      'sale_active', v_sale_active,
      'sale_extended', v_sale_extended,
      'sale_original_ends_at', v_ev.sale_original_ends_at,
      'sale_ends_at', v_ev.sale_ends_at,
      'group_offer', CASE WHEN v_ev.group_offer_percent IS NOT NULL AND v_ev.group_offer_percent > 0
        THEN jsonb_build_object(
          'name', coalesce(v_ev.group_offer_name, 'Two-room rate'),
          'percent', v_ev.group_offer_percent,
          'rooms', v_ev.group_offer_rooms)
        ELSE NULL END,
      'referral_percent', v_ev.referral_percent
    ),
    'tiers', v_tiers,
    'itinerary', v_itin
  );
END;
$function$;

/* ───────────── confirmation page + GHL sync payloads ───────────── */

CREATE OR REPLACE FUNCTION public.get_session_confirmation(p_session_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'guest_name', b.guest_name,
    'guest_email', b.guest_email,
    'payment_status', b.payment_status,
    'payment_schedule', b.payment_schedule,
    'rate_type', b.rate_type,
    'total_amount', b.total_amount,
    'base_amount', b.base_amount,
    'addon_amount', b.addon_amount,
    'resort_fee', b.resort_fee,
    'tax_amount', b.tax_amount,
    'addons_selected', b.addons_selected,
    'deposit_paid_at', b.deposit_paid_at,
    'final_paid_at', b.final_paid_at,
    'covered_at', b.covered_at,
    'covered_by_booking_id', b.covered_by_booking_id,
    'is_primary', b.is_primary,
    'section_id', b.section_id,
    'event_id', b.event_id,
    'payment_update_token', b.payment_update_token,
    'room_count', b.room_count,
    'room2_guest1_name', b.room2_guest1_name,
    'room2_guest2_name', b.room2_guest2_name,
    'referral_code', b.referral_code,
    'section', (
      SELECT jsonb_build_object(
        'id', s.id, 'section_name', s.section_name, 'nights', s.nights,
        'guest_nightly_rate', s.guest_nightly_rate,
        'regular_package_price', s.regular_package_price,
        'resort_fee_percent', s.resort_fee_percent
      ) FROM lb_room_sections s WHERE s.id = b.section_id
    ),
    'event', (
      SELECT jsonb_build_object(
        'id', e.id, 'wedding_name', e.wedding_name, 'slug', e.slug,
        'check_in_date', e.check_in_date, 'check_out_date', e.check_out_date,
        'group_offer_name', e.group_offer_name,
        'referral_percent', e.referral_percent
      ) FROM lb_events e WHERE e.id = b.event_id
    ),
    'payer_name', (
      SELECT p.guest_name FROM lb_bookings p WHERE p.id = b.covered_by_booking_id
    )
  )), '[]'::jsonb)
  FROM lb_bookings b
  WHERE length(coalesce(p_session_id, '')) >= 10
    AND b.stripe_session_id = p_session_id;
$function$;

CREATE OR REPLACE FUNCTION public.list_popup_bookings_for_sync(p_secret text, p_event_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT CASE
    WHEN p_secret IS DISTINCT FROM (SELECT value FROM lb_private_config WHERE key = 'waitlist_sync_secret')
    THEN NULL
    ELSE coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'booking_id', b.id,
        'guest_name', b.guest_name,
        'guest2_name', b.guest2_name,
        'guest_email', b.guest_email,
        'guest_phone', b.guest_phone,
        'address_line1', b.address_line1,
        'address_city', b.address_city,
        'address_state', b.address_state,
        'address_zip', b.address_zip,
        'section_name', s.section_name,
        'payment_status', b.payment_status,
        'payment_schedule', b.payment_schedule,
        'rate_type', b.rate_type,
        'total_amount', b.total_amount,
        'booked_at', b.booked_at,
        'room_count', b.room_count,
        'room2_guest1_name', b.room2_guest1_name,
        'room2_guest2_name', b.room2_guest2_name,
        'referral_code', b.referral_code,
        'referred_by_booking_id', b.referred_by_booking_id,
        'referral_credit_amount', b.referral_credit_amount
      ) ORDER BY b.booked_at)
      FROM lb_bookings b
      JOIN lb_events e ON e.id = b.event_id
      JOIN lb_room_sections s ON s.id = b.section_id
      WHERE e.slug = p_event_slug AND e.event_type = 'popup'
        AND b.removed IS NOT TRUE
        AND b.payment_status IN ('paid', 'deposit_paid')
    ), '[]'::jsonb)
  END;
$function$;

/* ───────────── switch both programs on for The Couples Weekend ───────────── */

UPDATE public.lb_events
   SET group_offer_name = 'The Quartet',
       group_offer_percent = 15,
       group_offer_rooms = 2,
       referral_percent = 15
 WHERE slug = 'couples-retreat' AND event_type = 'popup';

-- Couples who already booked get their code now.
UPDATE public.lb_bookings b
   SET referral_code = public.lb_generate_referral_code(b.guest_name)
  FROM public.lb_events e
 WHERE e.id = b.event_id AND e.event_type = 'popup' AND e.referral_percent IS NOT NULL
   AND b.referral_code IS NULL AND b.removed IS NOT TRUE
   AND b.payment_status IN ('paid', 'deposit_paid');
