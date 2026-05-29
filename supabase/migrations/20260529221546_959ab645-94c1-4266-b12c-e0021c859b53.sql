
ALTER TABLE public.lb_events
  ADD COLUMN IF NOT EXISTS check_in_time text NOT NULL DEFAULT '3:00 PM',
  ADD COLUMN IF NOT EXISTS check_out_time text NOT NULL DEFAULT '11:00 AM';

ALTER TABLE public.lb_bookings
  ADD COLUMN IF NOT EXISTS checkin_reminder_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkin_reminder_sent_at timestamptz;
