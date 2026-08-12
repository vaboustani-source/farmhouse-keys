import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logActivity } from "@/lib/activity-log.server";

/* Popup columns/tables are newer than the generated Database types —
   use an untyped handle for those queries until types are regenerated. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

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

/** Rooms taken = paid/deposit/covered bookings + pending bookings whose
 *  checkout hold has not yet expired. Mirrors create_popup_booking(). */
async function takenBySection(sectionIds: string[]): Promise<Record<string, number>> {
  if (sectionIds.length === 0) return {};
  const { data: rows } = await admin
    .from("lb_bookings")
    .select("section_id, payment_status, hold_expires_at, removed")
    .in("section_id", sectionIds);
  const now = Date.now();
  const counts: Record<string, number> = {};
  for (const b of rows ?? []) {
    if (b.removed === true) continue;
    const held =
      b.payment_status === "paid" ||
      b.payment_status === "deposit_paid" ||
      b.payment_status === "covered" ||
      (b.payment_status === "pending" &&
        b.hold_expires_at &&
        new Date(b.hold_expires_at).getTime() > now);
    if (held) counts[b.section_id] = (counts[b.section_id] ?? 0) + 1;
  }
  return counts;
}

function sellingPrice(t: {
  regular_package_price: number | null;
  promo_package_price: number | null;
  promo_active: boolean;
  guest_nightly_rate: number | null;
  nights: number | null;
}): number {
  const pkg =
    t.promo_active && t.promo_package_price != null
      ? Number(t.promo_package_price)
      : t.regular_package_price != null
        ? Number(t.regular_package_price)
        : null;
  if (pkg != null) return pkg;
  return (Number(t.guest_nightly_rate) || 0) * (Number(t.nights) || 2);
}

export const getPopupEvent = createServerFn({ method: "POST" })
  .inputValidator(z.object({ slug: z.string().min(1).max(160) }).parse)
  .handler(async ({ data }): Promise<PopupEventPayload> => {
    const { data: ev } = await admin
      .from("lb_events")
      .select(
        "id, slug, wedding_name, hero_intro, status, check_in_date, check_out_date, check_in_time, check_out_time, nights",
      )
      .eq("slug", data.slug)
      .eq("event_type", "popup")
      .maybeSingle();
    if (!ev) return { event: null, tiers: [], itinerary: [] };

    const [{ data: sections }, { data: itinerary }] = await Promise.all([
      admin
        .from("lb_room_sections")
        .select(
          "id, section_name, tagline, regular_package_price, promo_package_price, promo_active, guest_nightly_rate, total_rooms, nights, booking_link_slug, sort_order, resort_fee_percent, cot_1night_rate, cot_2night_rate, is_active",
        )
        .eq("event_id", ev.id)
        .eq("is_active", true)
        .order("sort_order"),
      admin
        .from("lb_itinerary_items")
        .select(
          "id, day_number, time_label, activity, note, tier1_included, tier2_included, tier3_included, sort_order",
        )
        .eq("event_id", ev.id)
        .order("day_number")
        .order("sort_order"),
    ]);

    const taken = await takenBySection((sections ?? []).map((s: { id: string }) => s.id));

    return {
      event: {
        id: ev.id,
        slug: ev.slug,
        title: ev.wedding_name,
        hero_intro: ev.hero_intro ?? null,
        status: ev.status,
        check_in_date: ev.check_in_date,
        check_out_date: ev.check_out_date,
        check_in_time: ev.check_in_time ?? "16:00",
        check_out_time: ev.check_out_time ?? "11:00",
        nights: Number(ev.nights) || 2,
      },
      tiers: (sections ?? []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        section_name: s.section_name as string,
        tagline: (s.tagline as string | null) ?? null,
        regular_package_price:
          s.regular_package_price == null ? null : Number(s.regular_package_price),
        promo_package_price: s.promo_package_price == null ? null : Number(s.promo_package_price),
        promo_active: !!s.promo_active,
        selling_price: sellingPrice(s as Parameters<typeof sellingPrice>[0]),
        total_rooms: Number(s.total_rooms) || 0,
        remaining: Math.max(0, (Number(s.total_rooms) || 0) - (taken[s.id as string] ?? 0)),
        nights: Number(s.nights) || 2,
        booking_link_slug: (s.booking_link_slug as string | null) ?? null,
        sort_order: Number(s.sort_order) || 0,
        resort_fee_percent: Number(s.resort_fee_percent) || 0,
        cot_1night_rate: Number(s.cot_1night_rate) || 100,
        cot_2night_rate: Number(s.cot_2night_rate) || 150,
      })),
      itinerary: (itinerary ?? []) as PopupItineraryItem[],
    };
  });

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

export const createPopupBookingFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      eventSlug: z.string().min(1).max(160),
      sectionId: z.string().uuid(),
      guestName: z.string().min(1).max(160),
      guestEmail: z.string().email().max(255),
      guestPhone: z.string().max(40).optional(),
    }).parse,
  )
  .handler(async ({ data }): Promise<PopupBookingResult> => {
    const { data: bookingId, error } = await admin.rpc("create_popup_booking", {
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

    const { data: booking } = await admin
      .from("lb_bookings")
      .select("id, guest_name, guest_email, section_id, event_id")
      .eq("id", bookingId)
      .single();

    if (booking) {
      await logActivity({
        eventId: booking.event_id,
        bookingId: booking.id,
        actor: "guest",
        actorName: booking.guest_name,
        action: "booking.popup_reserved",
        label: `${booking.guest_name} started a pop-up reservation`,
        metadata: { section_id: booking.section_id },
      });
    }

    return {
      ok: true,
      booking: {
        id: booking?.id ?? (bookingId as string),
        guest_name: booking?.guest_name ?? data.guestName,
        guest_email: booking?.guest_email ?? data.guestEmail,
        section_id: booking?.section_id ?? data.sectionId,
      },
    };
  });
