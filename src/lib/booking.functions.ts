import { supabase } from "@/integrations/supabase/client";

/* These all run in the browser. Guest-scoped data comes through SECURITY
   DEFINER RPCs (gated on knowledge of an email + event, a Stripe session id,
   or a booking uuid); public data is read directly under RLS. The previous
   createServerFn + supabaseAdmin path hung forever on Lovable's published
   hosting, which never provides the service-role key. Some RPCs are newer
   than the generated Database types — use an untyped handle for those. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/* ───────────── Email gate lookup ───────────── */

export async function lookupBooking({
  data,
}: {
  data: { email: string; eventSlug: string; sectionSlug: string };
}) {
  const { data: rows, error } = await supabase.rpc("lookup_guest_booking", {
    p_email: data.email,
    p_event_slug: data.eventSlug,
    p_section_slug: data.sectionSlug,
  });
  if (error) {
    console.error("lookup_guest_booking error", error);
    return { booking: null };
  }
  const row = rows?.[0] ?? null;
  return { booking: row };
}

export async function lookupSecondaryGuest({
  data,
}: {
  data: { email: string; eventSlug: string; excludeBookingId: string };
}) {
  const { data: rows, error } = await sb.rpc("lookup_secondary_guest", {
    p_email: data.email,
    p_event_slug: data.eventSlug,
  });
  if (error) {
    console.error("lookup_secondary_guest error", error);
    return { booking: null };
  }
  const row = rows?.[0] ?? null;
  if (row && row.booking_id === data.excludeBookingId)
    return { booking: null, sameAsPrimary: true };
  return { booking: row };
}

/* ───────────── Add-ons fetch ───────────── */

export async function getSectionAddons({ data }: { data: { sectionId: string } }) {
  const { data: rows, error } = await supabase
    .from("lb_section_addons")
    .select("id, addon_name, addon_price, addon_type, is_required, sort_order")
    .eq("section_id", data.sectionId)
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return { addons: rows ?? [] };
}

/* createCheckoutSession lives in src/lib/checkout.ts — it invokes the
   `create-checkout-session` Supabase Edge Function so STRIPE_SECRET_KEY
   stays out of the browser bundle. */

export type ConfirmationBooking = {
  id: string;
  guest_name: string;
  guest_email: string;
  payment_status: string;
  payment_schedule: string | null;
  rate_type: "waitlist" | "regular" | null;
  total_amount: number | null;
  base_amount: number | null;
  addon_amount: number | null;
  resort_fee: number | null;
  tax_amount: number | null;
  addons_selected: unknown;
  deposit_paid_at: string | null;
  final_paid_at: string | null;
  covered_at: string | null;
  covered_by_booking_id: string | null;
  is_primary: boolean | null;
  section_id: string;
  event_id: string;
  payment_update_token: string | null;
  section: {
    id: string;
    section_name: string;
    nights: number | null;
    guest_nightly_rate: number | null;
    regular_package_price: number | null;
    resort_fee_percent: number | null;
  } | null;
  event: {
    id: string;
    wedding_name: string;
    check_in_date: string | null;
    check_out_date: string | null;
  } | null;
  payer_name: string | null;
};

export async function fetchSessionConfirmation({
  data,
}: {
  data: { sessionId: string };
}): Promise<{ bookings: ConfirmationBooking[] }> {
  const { data: payload, error } = await sb.rpc("get_session_confirmation", {
    p_session_id: data.sessionId,
  });
  if (error) throw error;
  return { bookings: (payload as ConfirmationBooking[] | null) ?? [] };
}

/* ───────────── Reservation extras (payment_update_token, payer) ───────────── */

export async function getReservationExtras({
  data,
}: {
  data: { bookingId: string };
}): Promise<{ paymentUpdateToken: string | null; payerName: string | null }> {
  const { data: payload, error } = await sb.rpc("get_reservation_extras", {
    p_booking_id: data.bookingId,
  });
  if (error) {
    console.error("get_reservation_extras error", error);
    return { paymentUpdateToken: null, payerName: null };
  }
  const row = (payload ?? {}) as {
    payment_update_token?: string | null;
    payer_name?: string | null;
  };
  return {
    paymentUpdateToken: row.payment_update_token ?? null,
    payerName: row.payer_name ?? null,
  };
}
