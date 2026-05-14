ALTER TABLE public.lb_bookings
  ADD COLUMN IF NOT EXISTS cot_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cot_fee numeric NOT NULL DEFAULT 0;

ALTER TABLE public.lb_room_sections
  ADD COLUMN IF NOT EXISTS cot_1night_rate numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS cot_2night_rate numeric NOT NULL DEFAULT 150;

UPDATE public.lb_room_sections
  SET cot_1night_rate = COALESCE(cot_1night_rate, 100),
      cot_2night_rate = COALESCE(cot_2night_rate, 150);