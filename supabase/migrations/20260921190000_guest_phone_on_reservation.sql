-- Guests give their mobile on the wedding reservation page; the Guest Chat Line labels
-- incoming texts by matching that number back to the reservation.
-- (Full definitions applied 2026-09-21 via the Supabase MCP as migration
--  `guest_phone_on_reservation_and_name_lookup`: set_guest_booking_phone(uuid,text,text),
--  guest_line_lookup(text), trigger dc_guest_phones_fill on dc_guest_phones.)
SELECT 1;
