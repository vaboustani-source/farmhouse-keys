-- Stamped by send-popup-reminder-email so a couple who stopped mid-reservation is only emailed once.
ALTER TABLE public.lb_bookings ADD COLUMN IF NOT EXISTS checkout_reminder_sent_at timestamptz;
