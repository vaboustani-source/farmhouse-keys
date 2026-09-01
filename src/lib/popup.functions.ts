import { supabase } from "@/integrations/supabase/client";

/* All pop-up reads/writes go through SECURITY DEFINER RPCs called from the
   browser. Lovable's published hosting never provides the service-role key,
   so the previous createServerFn + supabaseAdmin path hung forever in
   production. The RPCs are newer than the generated Database types — use an
   untyped handle until types are regenerated. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type PopupTier = {
  id: string;
  section_name: string;
  tagline: string | null;
  regular_package_price: number | null;
  promo_package_price: number | null;
  sale_package_price: number | null;
  promo_active: boolean;
  selling_price: number;
  total_rooms: number;
  remaining: number;
  show_scarcity: boolean;
  is_featured: boolean;
  nights: number;
  booking_link_slug: string | null;
  sort_order: number;
  resort_fee_percent: number;
  cot_1night_rate: number;
  cot_2night_rate: number;
};

export type PopupItineraryItem = {
  id: string;
  day_number: number;
  time_label: string | null;
  activity: string;
  note: string | null;
  tier1_included: boolean;
  tier2_included: boolean;
  tier3_included: boolean;
  sort_order: number;
};

export type PopupBookingPhase = "preopen" | "waitlist_only" | "public";

export type PopupEventPayload = {
  event: {
    id: string;
    slug: string;
    title: string;
    hero_intro: string | null;
    status: string;
    check_in_date: string | null;
    check_out_date: string | null;
    check_in_time: string;
    check_out_time: string;
    nights: number;
    phase: PopupBookingPhase;
    waitlist_opens_at: string | null;
    public_opens_at: string | null;
    balance_due_on: string | null;
    split_available: boolean;
    cancel_by_date: string | null;
    sale_active: boolean;
    sale_extended: boolean;
    sale_original_ends_at: string | null;
    sale_ends_at: string | null;
  } | null;
  tiers: PopupTier[];
  itinerary: PopupItineraryItem[];
};

export async function getPopupEvent({
  data,
}: {
  data: { slug: string };
}): Promise<PopupEventPayload> {
  const { data: payload, error } = await sb.rpc("get_popup_event", {
    p_slug: data.slug,
  });
  if (error) throw error;
  return (payload as PopupEventPayload | null) ?? { event: null, tiers: [], itinerary: [] };
}

export type PopupBookingResult =
  | {
      ok: true;
      booking: {
        id: string;
        guest_name: string;
        guest_email: string;
        section_id: string;
        base_amount: number;
        rate_type: "waitlist" | "sale" | "regular";
      };
    }
  | {
      ok: false;
      reason:
        | "sold_out"
        | "already_booked"
        | "not_available"
        | "not_open"
        | "waitlist_only"
        | "invalid";
    };

export async function createPopupBookingFn({
  data,
}: {
  data: {
    eventSlug: string;
    sectionId: string;
    guestName: string;
    guest2Name?: string;
    guestEmail: string;
    guestPhone: string;
    addressLine1: string;
    addressCity: string;
    addressState: string;
    addressZip: string;
  };
}): Promise<PopupBookingResult> {
  const { data: result, error } = await sb.rpc("create_popup_booking", {
    p_event_slug: data.eventSlug,
    p_section_id: data.sectionId,
    p_guest_name: data.guestName,
    p_guest_email: data.guestEmail,
    p_guest_phone: data.guestPhone,
    p_guest2_name: data.guest2Name ?? null,
    p_address_line1: data.addressLine1,
    p_address_line2: null,
    p_address_city: data.addressCity,
    p_address_state: data.addressState,
    p_address_zip: data.addressZip,
  });
  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("sold_out")) return { ok: false, reason: "sold_out" };
    if (msg.includes("already_booked")) return { ok: false, reason: "already_booked" };
    if (msg.includes("waitlist_only")) return { ok: false, reason: "waitlist_only" };
    if (msg.includes("not_open")) return { ok: false, reason: "not_open" };
    if (msg.includes("not_available")) return { ok: false, reason: "not_available" };
    console.error("create_popup_booking failed", error);
    return { ok: false, reason: "invalid" };
  }

  // The RPC stamps the applicable rate on the booking (waitlist vs sale vs
  // regular, decided server-side) and logs to lb_activity_log itself.
  const r = result as {
    booking_id: string;
    base_amount: number;
    rate_type: "waitlist" | "sale" | "regular";
  };
  const displayName = data.guest2Name?.trim()
    ? `${data.guestName.trim()} & ${data.guest2Name.trim()}`
    : data.guestName.trim();
  return {
    ok: true,
    booking: {
      id: r.booking_id,
      guest_name: displayName,
      guest_email: data.guestEmail,
      section_id: data.sectionId,
      base_amount: Number(r.base_amount),
      rate_type: r.rate_type,
    },
  };
}

/** True when this email is on the event's waitlist (waitlist rate applies). */
export async function checkPopupWaitlist({
  data,
}: {
  data: { eventSlug: string; email: string };
}): Promise<{ onWaitlist: boolean }> {
  const { data: result, error } = await sb.rpc("check_popup_waitlist", {
    p_event_slug: data.eventSlug,
    p_email: data.email,
  });
  if (error) {
    console.error("check_popup_waitlist failed", error);
    return { onWaitlist: false };
  }
  return { onWaitlist: !!(result as { on_waitlist?: boolean } | null)?.on_waitlist };
}

/** Records the guest's payment choice (full vs 50/50) before checkout opens. */
export async function setPopupPaymentChoice({
  data,
}: {
  data: { bookingId: string; schedule: "full" | "deposit_50_balance_50" };
}): Promise<{ ok: boolean }> {
  const { error } = await sb.rpc("set_popup_payment_choice", {
    p_booking_id: data.bookingId,
    p_schedule: data.schedule,
  });
  if (error) {
    console.error("set_popup_payment_choice failed", error);
    return { ok: false };
  }
  return { ok: true };
}
