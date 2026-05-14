-- 1. lb_events: slug
ALTER TABLE public.lb_events
  ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Backfill slug for existing events from wedding_name
UPDATE public.lb_events
SET slug = lower(regexp_replace(regexp_replace(wedding_name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
WHERE slug IS NULL;

-- 2. lb_room_sections: pricing & schedule fields
ALTER TABLE public.lb_room_sections
  ADD COLUMN IF NOT EXISTS internal_nightly_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS couple_contribution numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_contributions jsonb,
  ADD COLUMN IF NOT EXISTS payment_schedule text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS resort_fee_percent numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS nights integer NOT NULL DEFAULT 2;

-- Backfill internal_nightly_rate from existing price_per_night
UPDATE public.lb_room_sections
SET internal_nightly_rate = price_per_night
WHERE internal_nightly_rate = 0 AND price_per_night > 0;

-- guest_nightly_rate as generated column
ALTER TABLE public.lb_room_sections
  ADD COLUMN IF NOT EXISTS guest_nightly_rate numeric
  GENERATED ALWAYS AS (GREATEST(internal_nightly_rate - couple_contribution, 0)) STORED;

ALTER TABLE public.lb_room_sections
  DROP CONSTRAINT IF EXISTS lb_room_sections_payment_schedule_check;
ALTER TABLE public.lb_room_sections
  ADD CONSTRAINT lb_room_sections_payment_schedule_check
  CHECK (payment_schedule IN ('full', 'split_50_50'));

-- 3. lb_bookings: Stripe + status fields
ALTER TABLE public.lb_bookings
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS covered_by_booking_id uuid REFERENCES public.lb_bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS covered_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_schedule text NOT NULL DEFAULT 'full';

ALTER TABLE public.lb_bookings
  DROP CONSTRAINT IF EXISTS lb_bookings_payment_schedule_check;
ALTER TABLE public.lb_bookings
  ADD CONSTRAINT lb_bookings_payment_schedule_check
  CHECK (payment_schedule IN ('full', 'split_50_50'));

-- Allow expanded payment_status values: pending, deposit_paid, paid, covered, payment_failed, failed
-- (We don't enforce a CHECK constraint to keep it flexible, matches existing app code.)

-- 4. Public lookup function for the guest email gate
-- Returns booking + section + event details, or nothing.
CREATE OR REPLACE FUNCTION public.lookup_guest_booking(
  p_email text,
  p_event_slug text,
  p_section_slug text
)
RETURNS TABLE (
  booking_id uuid,
  event_id uuid,
  section_id uuid,
  guest_name text,
  guest_email text,
  payment_status text,
  payment_schedule text,
  deposit_paid_at timestamptz,
  final_paid_at timestamptz,
  covered_at timestamptz,
  total_amount numeric,
  base_amount numeric,
  addon_amount numeric,
  resort_fee numeric,
  tax_amount numeric,
  addons_selected jsonb,
  is_primary boolean,
  -- event
  wedding_name text,
  couple_names text,
  wedding_date date,
  check_in_date date,
  check_out_date date,
  -- section
  section_name text,
  guest_nightly_rate numeric,
  resort_fee_percent numeric,
  nights integer,
  booking_link_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.event_id,
    b.section_id,
    b.guest_name,
    b.guest_email,
    b.payment_status,
    b.payment_schedule,
    b.deposit_paid_at,
    b.final_paid_at,
    b.covered_at,
    b.total_amount,
    b.base_amount,
    b.addon_amount,
    b.resort_fee,
    b.tax_amount,
    b.addons_selected,
    b.is_primary,
    e.wedding_name,
    e.couple_names,
    e.wedding_date,
    e.check_in_date,
    e.check_out_date,
    s.section_name,
    s.guest_nightly_rate,
    s.resort_fee_percent,
    s.nights,
    s.booking_link_slug
  FROM public.lb_bookings b
  JOIN public.lb_events e ON e.id = b.event_id
  JOIN public.lb_room_sections s ON s.id = b.section_id
  WHERE lower(b.guest_email) = lower(p_email)
    AND e.slug = p_event_slug
    AND s.booking_link_slug = p_section_slug
    AND s.is_active = true
  LIMIT 1
$$;

-- Allow anon and authenticated to call the lookup
GRANT EXECUTE ON FUNCTION public.lookup_guest_booking(text, text, text) TO anon, authenticated;

-- Secondary-guest lookup (any active section in the event)
CREATE OR REPLACE FUNCTION public.lookup_secondary_guest(
  p_email text,
  p_event_slug text
)
RETURNS TABLE (
  booking_id uuid,
  guest_name text,
  payment_status text,
  section_name text,
  guest_nightly_rate numeric,
  resort_fee_percent numeric,
  nights integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.guest_name,
    b.payment_status,
    s.section_name,
    s.guest_nightly_rate,
    s.resort_fee_percent,
    s.nights
  FROM public.lb_bookings b
  JOIN public.lb_events e ON e.id = b.event_id
  JOIN public.lb_room_sections s ON s.id = b.section_id
  WHERE lower(b.guest_email) = lower(p_email)
    AND e.slug = p_event_slug
    AND s.is_active = true
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.lookup_secondary_guest(text, text) TO anon, authenticated;
