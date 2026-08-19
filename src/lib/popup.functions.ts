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
  promo_active: boolean;
  selling_price: number;
  total_rooms: number;
  remaining: number;
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
      };
    }
  | { ok: false; reason: "sold_out" | "already_booked" | "not_available" | "invalid" };

export async function createPopupBookingFn({
  data,
}: {
  data: {
    eventSlug: string;
    sectionId: string;
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
  };
}): Promise<PopupBookingResult> {
  const { data: bookingId, error } = await sb.rpc("create_popup_booking", {
    p_event_slug: data.eventSlug,
    p_section_id: data.sectionId,
    p_guest_name: data.guestName,
    p_guest_email: data.guestEmail,
    p_guest_phone: data.guestPhone ?? null,
  });
  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("sold_out")) return { ok: false, reason: "sold_out" };
    if (msg.includes("already_booked")) return { ok: false, reason: "already_booked" };
    if (msg.includes("not_available")) return { ok: false, reason: "not_available" };
    console.error("create_popup_booking failed", error);
    return { ok: false, reason: "invalid" };
  }

  // The RPC logs the reservation to lb_activity_log itself (guests cannot
  // insert there directly) and returns only the booking id.
  return {
    ok: true,
    booking: {
      id: String(bookingId),
      guest_name: data.guestName,
      guest_email: data.guestEmail,
      section_id: data.sectionId,
    },
  };
}
