ALTER TABLE public.lb_bookings
ADD COLUMN IF NOT EXISTS removed boolean NOT NULL DEFAULT false;

ALTER TABLE public.lb_bookings
ADD COLUMN IF NOT EXISTS removed_at timestamptz;