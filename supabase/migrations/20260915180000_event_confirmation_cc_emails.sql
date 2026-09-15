-- Per-event staff CC list for guest reservation confirmation emails
-- (deposit / paid-in-full emails sent by the stripe-webhook edge function).
alter table public.lb_events
  add column if not exists confirmation_cc_emails text[] not null default '{}';

comment on column public.lb_events.confirmation_cc_emails is
  'Staff addresses CC''d on every guest reservation confirmation email for this event.';

-- The Couples Weekend: Event Coordinator compiles the guest list from the confirmations.
update public.lb_events
  set confirmation_cc_emails = array['events@gilbertsvillefarmhouse.com']
  where slug = 'couples-retreat' and event_type = 'popup';
