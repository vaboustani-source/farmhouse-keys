-- Add missing pricing columns to lb_room_sections
ALTER TABLE public.lb_room_sections
  ADD COLUMN IF NOT EXISTS processing_fee_percent numeric NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS tax_percent numeric NOT NULL DEFAULT 8;

-- Update defaults on existing columns
ALTER TABLE public.lb_room_sections
  ALTER COLUMN internal_nightly_rate SET DEFAULT 650,
  ALTER COLUMN resort_fee_percent SET DEFAULT 0,
  ALTER COLUMN payment_schedule SET DEFAULT 'deposit_50_balance_50';

-- Replace payment_schedule check constraint to support new value names
DO $$
DECLARE
  c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.lb_room_sections'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%payment_schedule%'
  LOOP
    EXECUTE format('ALTER TABLE public.lb_room_sections DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.lb_room_sections
  ADD CONSTRAINT lb_room_sections_payment_schedule_check
  CHECK (payment_schedule IN ('full_upfront','deposit_50_balance_50','full','split_50_50'));

-- Backfill existing rows so no field is null / off-default
UPDATE public.lb_room_sections
SET
  internal_nightly_rate = COALESCE(NULLIF(internal_nightly_rate, 0), 650),
  resort_fee_percent    = COALESCE(resort_fee_percent, 0),
  processing_fee_percent = COALESCE(processing_fee_percent, 3),
  tax_percent           = COALESCE(tax_percent, 8),
  payment_schedule = CASE
    WHEN payment_schedule IN ('split_50_50','deposit_50_balance_50') THEN 'deposit_50_balance_50'
    WHEN payment_schedule IN ('full','full_upfront') THEN 'deposit_50_balance_50'
    ELSE 'deposit_50_balance_50'
  END;
