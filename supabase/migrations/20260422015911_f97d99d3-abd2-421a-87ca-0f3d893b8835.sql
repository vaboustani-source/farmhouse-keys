-- Guest invitations: invite-only gate for the lodging booking app.
-- Same email can't be invited twice to the same event.
-- Each invite is bound to one room section (required).

CREATE TABLE public.guest_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.lb_events(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.lb_room_sections(id) ON DELETE RESTRICT,
  guest_email text NOT NULL,
  guest_name text NOT NULL,
  invite_group text NOT NULL DEFAULT 'Guests',
  room_allocation integer NOT NULL DEFAULT 1 CHECK (room_allocation BETWEEN 1 AND 5),
  rooms_booked integer NOT NULL DEFAULT 0 CHECK (rooms_booked >= 0),
  secondary_booking_for text,
  invited_by_couple_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_invitations_email_lowercase CHECK (guest_email = lower(guest_email)),
  CONSTRAINT guest_invitations_unique_per_event UNIQUE (event_id, guest_email)
);

-- Normalize email on write (defensive — UI also lowercases/trims)
CREATE OR REPLACE FUNCTION public.guest_invitations_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.guest_email := lower(trim(NEW.guest_email));
  NEW.guest_name := trim(NEW.guest_name);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guest_invitations_normalize
  BEFORE INSERT OR UPDATE ON public.guest_invitations
  FOR EACH ROW EXECUTE FUNCTION public.guest_invitations_normalize();

CREATE INDEX idx_guest_invitations_event ON public.guest_invitations(event_id);
CREATE INDEX idx_guest_invitations_section ON public.guest_invitations(section_id);
CREATE INDEX idx_guest_invitations_email ON public.guest_invitations(guest_email);

ALTER TABLE public.guest_invitations ENABLE ROW LEVEL SECURITY;

-- Admins (Brandon) have full control via the Lodging Manager.
CREATE POLICY "Admins manage guest_invitations"
  ON public.guest_invitations
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Couples (event_users members) manage invites for their own event via Planning Hub.
CREATE POLICY "Event members manage guest_invitations"
  ON public.guest_invitations
  FOR ALL
  USING (public.is_event_member(event_id, auth.uid()))
  WITH CHECK (public.is_event_member(event_id, auth.uid()));

-- NOTE: Public booking-side reads (email verification) will go through a
-- SECURITY DEFINER edge function, not direct table access. No anon SELECT policy.
