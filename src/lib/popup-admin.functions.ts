import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log-client";

/* Admin pop-up management runs in the browser under the signed-in admin's
   session — the same RLS-backed pattern as the rest of the wedding admin.
   The previous createServerFn + supabaseAdmin path hung forever on Lovable's
   published hosting, which never provides the service-role key. Pop-up
   columns/tables are newer than the generated Database types — use an
   untyped handle for those queries until types are regenerated. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

async function assertAdmin(): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Forbidden");
  const { data: u } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  if (u?.role !== "admin") throw new Error("Forbidden");
  return userId;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/* ── Default tiers + itinerary for a new pop-up weekend ── */

const DEFAULT_TIERS = [
  {
    section_name: "The Local Itinerary",
    tagline: "Explore Butternut Valley",
    regular_package_price: 1950,
    promo_package_price: 1700,
    total_rooms: 20,
  },
  {
    section_name: "All-Inclusive",
    tagline: "Every meal and moment on the estate, handled",
    regular_package_price: 2750,
    promo_package_price: 2500,
    total_rooms: 10,
  },
  {
    section_name: "Couples Enhancements",
    tagline: "The all-inclusive weekend, elevated",
    regular_package_price: 3950,
    promo_package_price: 3500,
    total_rooms: 10,
  },
];

const T1 = { tier1_included: true, tier2_included: true, tier3_included: true };
const T23 = { tier1_included: false, tier2_included: true, tier3_included: true };
const T3 = { tier1_included: false, tier2_included: false, tier3_included: true };

const DEFAULT_ITINERARY = [
  { day_number: 1, time_label: "4:00 – 5:30 PM", activity: "Check-in", ...T1 },
  { day_number: 1, time_label: null, activity: "In-room aperitivo", ...T3 },
  { day_number: 1, time_label: "6:00 – 6:30 PM", activity: "Free time", ...T1 },
  {
    day_number: 1,
    time_label: "7:00 – 8:30 PM",
    activity: "Candlelit dinner in the Hayloft",
    ...T1,
  },
  { day_number: 1, time_label: "9:00 PM – 12:00 AM", activity: "Bonfire and s'mores", ...T1 },
  {
    day_number: 2,
    time_label: "9:00 AM",
    activity: "Breakfast in bed",
    note: "The Local Itinerary receives a fruit basket and a gift card to 5 Kids",
    ...T23,
  },
  { day_number: 2, time_label: "9:30 – 10:00 AM", activity: "Free time", ...T23 },
  { day_number: 2, time_label: "10:30 – 11:00 AM", activity: "Couples goat yoga", ...T23 },
  { day_number: 2, time_label: "11:30 – 12:00 PM", activity: "Free time", ...T23 },
  { day_number: 2, time_label: null, activity: "In-room snack", ...T3 },
  {
    day_number: 2,
    time_label: "12:30 – 2:00 PM",
    activity: "Lunch and immersive farm activity",
    ...T23,
  },
  { day_number: 2, time_label: "2:30 – 4:30 PM", activity: "Private horse experience", ...T3 },
  { day_number: 2, time_label: "7:30 – 10:30 PM", activity: "Dinner and entertainment", ...T23 },
  {
    day_number: 2,
    time_label: "11:00 PM – 12:00 AM",
    activity: "Bonfire, skillet cookies and ice cream",
    ...T1,
  },
  { day_number: 3, time_label: "9:00 AM", activity: "Breakfast", ...T23 },
  { day_number: 3, time_label: null, activity: "Checkout", ...T1 },
];

const DEFAULT_ADDONS = ["Late Checkout", "Welcome Amenity Package", "Private Fireside Setup"];

export async function createPopupEvent({
  data,
}: {
  data: {
    title: string;
    checkInDate: string;
    checkOutDate: string;
    heroIntro?: string;
  };
}) {
  await assertAdmin();

  const nights = Math.max(
    1,
    Math.round(
      (new Date(data.checkOutDate + "T00:00:00").getTime() -
        new Date(data.checkInDate + "T00:00:00").getTime()) /
        86400000,
    ),
  );

  // Unique slug
  const base = slugify(data.title) || "popup-weekend";
  let slug = base;
  for (let i = 2; i <= 20; i++) {
    const { data: clash } = await sb.from("lb_events").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = `${base}-${i}`;
  }

  const { data: ev, error: evErr } = await sb
    .from("lb_events")
    .insert({
      event_type: "popup",
      wedding_name: data.title,
      couple_names: data.title,
      hero_intro: data.heroIntro ?? null,
      slug,
      status: "draft",
      check_in_date: data.checkInDate,
      check_out_date: data.checkOutDate,
      nights,
    })
    .select("id, slug")
    .single();
  if (evErr || !ev) {
    console.error("createPopupEvent insert failed", evErr);
    throw new Error("Could not create the pop-up weekend");
  }

  const idHash = String(ev.id).replace(/-/g, "");
  for (let i = 0; i < DEFAULT_TIERS.length; i++) {
    const t = DEFAULT_TIERS[i];
    const selling = t.promo_package_price ?? t.regular_package_price;
    const nightly = Math.round((selling / nights) * 100) / 100;
    const { data: section, error: sErr } = await sb
      .from("lb_room_sections")
      .insert({
        event_id: ev.id,
        section_name: t.section_name,
        tagline: t.tagline,
        regular_package_price: t.regular_package_price,
        promo_package_price: t.promo_package_price,
        promo_active: true,
        total_rooms: t.total_rooms,
        sort_order: i,
        nights,
        is_active: true,
        payment_schedule: "full",
        // guest_nightly_rate is a generated column:
        // GREATEST(internal_nightly_rate - couple_contribution, 0)
        price_per_night: nightly,
        internal_nightly_rate: nightly,
        couple_contribution: 0,
        resort_fee_percent: 0,
        processing_fee_percent: 0,
        tax_percent: 8,
        booking_link_slug: `${slugify(t.section_name)}-${idHash}`,
      })
      .select("id")
      .single();
    if (sErr || !section) {
      console.error("popup tier insert failed", sErr);
      throw new Error("Could not create tiers");
    }
    for (const addon of DEFAULT_ADDONS) {
      await sb.from("lb_section_addons").insert({
        event_id: ev.id,
        section_id: section.id,
        addon_name: addon,
        addon_price: 0,
        addon_type: "per_stay",
        is_active: false,
      });
    }
  }

  const rows = DEFAULT_ITINERARY.map((it, idx) => ({
    event_id: ev.id,
    sort_order: idx,
    note: null,
    ...it,
  }));
  const { error: itErr } = await sb.from("lb_itinerary_items").insert(rows);
  if (itErr) console.error("itinerary seed failed", itErr);

  await logActivity({
    eventId: ev.id,
    actor: "admin",
    action: "event.popup_created",
    label: `Pop-up weekend created — ${data.title}`,
    metadata: { slug: ev.slug },
  });

  return { eventId: ev.id as string, slug: ev.slug as string };
}

export async function updatePopupTier({
  data,
}: {
  data: {
    sectionId: string;
    sectionName?: string;
    tagline?: string | null;
    regularPackagePrice?: number;
    promoPackagePrice?: number | null;
    promoActive?: boolean;
    totalRooms?: number;
    displayStockStart?: number | null;
    isActive?: boolean;
  };
}) {
  await assertAdmin();

  const { data: current } = await sb
    .from("lb_room_sections")
    .select(
      "id, event_id, nights, regular_package_price, promo_package_price, promo_active, section_name",
    )
    .eq("id", data.sectionId)
    .single();
  if (!current) throw new Error("Tier not found");

  const patch: Record<string, unknown> = {};
  if (data.sectionName !== undefined) patch.section_name = data.sectionName;
  if (data.tagline !== undefined) patch.tagline = data.tagline;
  if (data.regularPackagePrice !== undefined)
    patch.regular_package_price = data.regularPackagePrice;
  if (data.promoPackagePrice !== undefined) patch.promo_package_price = data.promoPackagePrice;
  if (data.promoActive !== undefined) patch.promo_active = data.promoActive;
  if (data.totalRooms !== undefined) patch.total_rooms = data.totalRooms;
  if (data.displayStockStart !== undefined) patch.display_stock_start = data.displayStockStart;
  if (data.isActive !== undefined) patch.is_active = data.isActive;

  // Keep the charged price in lockstep with the displayed package price.
  const regular = data.regularPackagePrice ?? Number(current.regular_package_price ?? 0);
  const promo =
    data.promoPackagePrice !== undefined
      ? data.promoPackagePrice
      : current.promo_package_price == null
        ? null
        : Number(current.promo_package_price);
  const promoActive = data.promoActive ?? !!current.promo_active;
  const selling = promoActive && promo != null ? promo : regular;
  const nights = Number(current.nights) || 2;
  const nightly = Math.round((selling / nights) * 100) / 100;
  // guest_nightly_rate is generated from internal_nightly_rate — never set directly.
  patch.internal_nightly_rate = nightly;
  patch.price_per_night = nightly;

  const { error } = await sb.from("lb_room_sections").update(patch).eq("id", data.sectionId);
  if (error) {
    console.error("updatePopupTier failed", error);
    throw new Error("Could not save tier");
  }

  await logActivity({
    eventId: current.event_id,
    actor: "admin",
    action: "pricing.popup_tier_updated",
    label: `Tier updated — ${data.sectionName ?? current.section_name}`,
    metadata: { selling_price: selling, promo_active: promoActive },
  });

  return { ok: true, sellingPrice: selling };
}

export type PopupItineraryInput = {
  dayNumber: number;
  timeLabel: string | null;
  activity: string;
  note: string | null;
  tier1: boolean;
  tier2: boolean;
  tier3: boolean;
};

export async function savePopupItinerary({
  data,
}: {
  data: { eventId: string; items: PopupItineraryInput[] };
}) {
  await assertAdmin();

  const { error: delErr } = await sb
    .from("lb_itinerary_items")
    .delete()
    .eq("event_id", data.eventId);
  if (delErr) {
    console.error("itinerary delete failed", delErr);
    throw new Error("Could not save itinerary");
  }
  if (data.items.length > 0) {
    const rows = data.items.map((it, idx) => ({
      event_id: data.eventId,
      day_number: it.dayNumber,
      time_label: it.timeLabel,
      activity: it.activity,
      note: it.note,
      tier1_included: it.tier1,
      tier2_included: it.tier2,
      tier3_included: it.tier3,
      sort_order: idx,
    }));
    const { error: insErr } = await sb.from("lb_itinerary_items").insert(rows);
    if (insErr) {
      console.error("itinerary insert failed", insErr);
      throw new Error("Could not save itinerary");
    }
  }

  await logActivity({
    eventId: data.eventId,
    actor: "admin",
    action: "event.popup_itinerary_updated",
    label: `Itinerary updated (${data.items.length} items)`,
  });

  return { ok: true };
}

export async function updatePopupEventDetails({
  data,
}: {
  data: { eventId: string; title?: string; heroIntro?: string | null };
}) {
  await assertAdmin();
  const patch: Record<string, unknown> = {};
  if (data.title !== undefined) {
    patch.wedding_name = data.title;
    patch.couple_names = data.title;
  }
  if (data.heroIntro !== undefined) patch.hero_intro = data.heroIntro;
  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await sb.from("lb_events").update(patch).eq("id", data.eventId);
  if (error) {
    console.error("updatePopupEventDetails failed", error);
    throw new Error("Could not save");
  }
  return { ok: true };
}

/** Admin homepage panel: all popup events with fill counts. */
export async function listPopupEvents() {
  await assertAdmin();
  const { data: events } = await sb
    .from("lb_events")
    .select("id, slug, wedding_name, status, check_in_date, check_out_date, nights")
    .eq("event_type", "popup")
    .order("check_in_date", { ascending: true });
  if (!events?.length) return { popups: [] };

  const ids = events.map((e: { id: string }) => e.id);
  const [{ data: sections }, { data: bookings }] = await Promise.all([
    sb
      .from("lb_room_sections")
      .select("id, event_id, section_name, total_rooms, is_active, sort_order")
      .in("event_id", ids)
      .order("sort_order"),
    sb
      .from("lb_bookings")
      .select("event_id, section_id, payment_status, hold_expires_at, removed")
      .in("event_id", ids),
  ]);

  const now = Date.now();
  const bySection: Record<string, number> = {};
  for (const b of bookings ?? []) {
    if (b.removed === true) continue;
    const held =
      b.payment_status === "paid" ||
      b.payment_status === "deposit_paid" ||
      b.payment_status === "covered" ||
      (b.payment_status === "pending" &&
        b.hold_expires_at &&
        new Date(b.hold_expires_at).getTime() > now);
    if (held) bySection[b.section_id] = (bySection[b.section_id] ?? 0) + 1;
  }

  return {
    popups: events.map((e: Record<string, unknown>) => ({
      ...e,
      sections: (sections ?? [])
        .filter((s: { event_id: string }) => s.event_id === e.id)
        .map((s: Record<string, unknown>) => ({
          ...s,
          booked: bySection[s.id as string] ?? 0,
        })),
    })),
  };
}
