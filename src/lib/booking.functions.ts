import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/* ───────────── Email gate lookup ───────────── */

export const lookupBooking = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email().max(255),
      eventSlug: z.string().min(1).max(120),
      sectionSlug: z.string().min(1).max(120),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc("lookup_guest_booking", {
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
  });

export const lookupSecondaryGuest = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email().max(255),
      eventSlug: z.string().min(1).max(120),
      excludeBookingId: z.string().uuid(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc("lookup_secondary_guest", {
      p_email: data.email,
      p_event_slug: data.eventSlug,
    });
    if (error) {
      console.error("lookup_secondary_guest error", error);
      return { booking: null };
    }
    const row = rows?.[0] ?? null;
    if (row && row.booking_id === data.excludeBookingId) return { booking: null, sameAsPrimary: true };
    return { booking: row };
  });

/* ───────────── Add-ons fetch ───────────── */

export const getSectionAddons = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sectionId: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("lb_section_addons")
      .select("id, addon_name, addon_price, addon_type, is_required, sort_order")
      .eq("section_id", data.sectionId)
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    return { addons: rows ?? [] };
  });

/* ───────────── Create Stripe Checkout Session ───────────── */

type CheckoutLineItem = {
  quantity: number;
  price_data: {
    currency: string;
    unit_amount: number;
    tax_behavior?: "exclusive" | "inclusive" | "unspecified";
    product_data: { name: string; tax_code?: string };
  };
};

const lineItemsForBooking = async (
  bookingId: string,
  addonIds: string[],
  labelPrefix?: string,
) => {
  const { data: booking, error: bErr } = await supabaseAdmin
    .from("lb_bookings")
    .select("id, event_id, section_id, guest_name, guest_email, payment_schedule")
    .eq("id", bookingId)
    .single();
  if (bErr || !booking) throw new Error("Booking not found");

  const { data: section, error: sErr } = await supabaseAdmin
    .from("lb_room_sections")
    .select("id, section_name, guest_nightly_rate, resort_fee_percent, nights")
    .eq("id", booking.section_id)
    .single();
  if (sErr || !section) throw new Error("Section not found");

  const { data: addons } = await supabaseAdmin
    .from("lb_section_addons")
    .select("id, addon_name, addon_price, addon_type, is_required")
    .eq("section_id", section.id)
    .eq("is_active", true);

  const selected = (addons ?? []).filter((a) => a.is_required || addonIds.includes(a.id));

  const nights = Number(section.nights) || 2;
  const nightly = Number(section.guest_nightly_rate) || 0;
  const baseAmount = nightly * nights;

  const lineItems: CheckoutLineItem[] = [];
  const prefix = labelPrefix ? `${labelPrefix} — ` : "";

  lineItems.push({
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: Math.round(baseAmount * 100),
      tax_behavior: "exclusive",
      product_data: {
        name: `${prefix}${section.section_name} lodging · ${nights} night${nights === 1 ? "" : "s"}`,
        tax_code: "txcd_20030000", // Hotel/lodging
      },
    },
  });

  let addonAmount = 0;
  for (const a of selected) {
    const price = Number(a.addon_price) || 0;
    const qty = a.addon_type === "per_night" ? nights : 1;
    addonAmount += price * qty;
    lineItems.push({
      quantity: qty,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(price * 100),
        tax_behavior: "exclusive",
        product_data: {
          name: `${prefix}${a.addon_name}${a.addon_type === "per_night" ? " (per night)" : ""}`,
          tax_code: "txcd_20030000",
        },
      },
    });
  }

  const resortFeeBase = baseAmount + addonAmount;
  const resortFee = (resortFeeBase * Number(section.resort_fee_percent || 0)) / 100;
  if (resortFee > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(resortFee * 100),
        tax_behavior: "exclusive",
        product_data: {
          name: `${prefix}Resort Fee (${section.resort_fee_percent}%)`,
          tax_code: "txcd_20030000",
        },
      },
    });
  }

  return {
    booking,
    section,
    selected,
    nights,
    baseAmount,
    addonAmount,
    resortFee,
    lineItems,
  };
};

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      bookingId: z.string().uuid(),
      addonIds: z.array(z.string().uuid()).max(20).default([]),
      secondaryBookingId: z.string().uuid().nullable().optional(),
      secondaryAddonIds: z.array(z.string().uuid()).max(20).default([]),
      eventSlug: z.string().min(1).max(120),
      sectionSlug: z.string().min(1).max(120),
      cotRequested: z.boolean().default(false),
    }).parse,
  )
  .handler(async ({ data }) => {
    const stripe = getStripe();

    const primary = await lineItemsForBooking(data.bookingId, data.addonIds);

    let secondary: Awaited<ReturnType<typeof lineItemsForBooking>> | null = null;
    if (data.secondaryBookingId) {
      const { data: secBk } = await supabaseAdmin
        .from("lb_bookings")
        .select("guest_name")
        .eq("id", data.secondaryBookingId)
        .single();
      secondary = await lineItemsForBooking(
        data.secondaryBookingId,
        data.secondaryAddonIds,
        `For ${secBk?.guest_name ?? "guest"}`,
      );
    }

    // Cot fee — flat rate based on the primary booking's nights.
    let cotFee = 0;
    const cotLineItems: CheckoutLineItem[] = [];
    if (data.cotRequested) {
      const { data: secRow } = await supabaseAdmin
        .from("lb_room_sections")
        .select("cot_1night_rate, cot_2night_rate")
        .eq("id", primary.booking.section_id)
        .single();
      cotFee =
        primary.nights <= 1
          ? Number(secRow?.cot_1night_rate ?? 100)
          : Number(secRow?.cot_2night_rate ?? 150);
      cotLineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(cotFee * 100),
          tax_behavior: "exclusive",
          product_data: {
            name: `3rd guest / cot setup (${primary.nights} night${primary.nights === 1 ? "" : "s"})`,
            tax_code: "txcd_20030000",
          },
        },
      });
    }

    const allLineItems = [...primary.lineItems, ...cotLineItems, ...(secondary?.lineItems ?? [])];

    // Determine deposit vs full. If schedule is split_50_50 we still charge full at
    // checkout, but webhook will mark deposit_paid + final still owed. The "manual
    // reminder" model: we'll send a reminder email later — guest pays again then.
    // For split, primary booking gets charged 50% now via custom amount.
    // Read section's payment schedule (source of truth) — fall back to booking.
    const { data: scheduleRow } = await supabaseAdmin
      .from("lb_room_sections")
      .select("payment_schedule")
      .eq("id", primary.booking.section_id)
      .single();
    const effectiveSchedule =
      scheduleRow?.payment_schedule ?? primary.booking.payment_schedule;
    let appliedAmounts = allLineItems;
    const isSplit =
      effectiveSchedule === "split_50_50" ||
      effectiveSchedule === "deposit_50_balance_50";
    if (isSplit) {
      // Recompute as 50% deposit single-line items per category.
      const halfFor = (items: CheckoutLineItem[]): CheckoutLineItem[] =>
        items.map((li) => ({
          ...li,
          price_data: {
            ...li.price_data,
            unit_amount: Math.round(li.price_data.unit_amount * 0.5),
            product_data: {
              ...li.price_data.product_data,
              name: `${li.price_data.product_data.name} (50% deposit)`,
            },
          },
        }));
      appliedAmounts = halfFor(allLineItems);
    }

    const baseUrl = getAppBaseUrl();
    const successUrl = `${baseUrl}/book/${data.eventSlug}/${data.sectionSlug}/confirmation?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/book/${data.eventSlug}/${data.sectionSlug}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: appliedAmounts as never,
      customer_email: primary.booking.guest_email,
      automatic_tax: { enabled: true },
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_creation: isSplit ? "always" : undefined,
      payment_intent_data: isSplit
        ? { setup_future_usage: "off_session" }
        : undefined,
      metadata: {
        primary_booking_id: data.bookingId,
        secondary_booking_id: data.secondaryBookingId ?? "",
        primary_addon_ids: JSON.stringify(data.addonIds),
        secondary_addon_ids: JSON.stringify(data.secondaryAddonIds),
        event_slug: data.eventSlug,
        section_slug: data.sectionSlug,
        payment_schedule: isSplit ? "split_50_50" : "full",
        cot_requested: data.cotRequested ? "1" : "0",
      },
    });

    // Pre-populate calc fields on booking(s) so confirmation page can show breakdown
    await supabaseAdmin
      .from("lb_bookings")
      .update({
        stripe_session_id: session.id,
        base_amount: primary.baseAmount,
        addon_amount: primary.addonAmount,
        resort_fee: primary.resortFee,
        total_amount: primary.baseAmount + primary.addonAmount + primary.resortFee + cotFee,
        cot_requested: data.cotRequested,
        cot_fee: cotFee,
        addons_selected: primary.selected.map((a) => ({ id: a.id, name: a.addon_name, price: Number(a.addon_price) })),
      })
      .eq("id", data.bookingId);

    if (secondary) {
      await supabaseAdmin
        .from("lb_bookings")
        .update({
          stripe_session_id: session.id,
          base_amount: secondary.baseAmount,
          addon_amount: secondary.addonAmount,
          resort_fee: secondary.resortFee,
          total_amount: secondary.baseAmount + secondary.addonAmount + secondary.resortFee,
          addons_selected: secondary.selected.map((a) => ({ id: a.id, name: a.addon_name, price: Number(a.addon_price) })),
          covered_by_booking_id: data.bookingId,
        })
        .eq("id", data.secondaryBookingId!);
    }

    return { url: session.url };
  });

export const fetchSessionConfirmation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string().min(1).max(200) }).parse)
  .handler(async ({ data }) => {
    const { data: bookings, error } = await supabaseAdmin
      .from("lb_bookings")
      .select(
        "id, guest_name, guest_email, payment_status, payment_schedule, total_amount, addons_selected, deposit_paid_at, final_paid_at, covered_at, covered_by_booking_id, is_primary, section_id, event_id",
      )
      .eq("stripe_session_id", data.sessionId);
    if (error) throw error;
    if (!bookings || bookings.length === 0) return { bookings: [] };

    const sectionIds = [...new Set(bookings.map((b) => b.section_id))];
    const eventIds = [...new Set(bookings.map((b) => b.event_id))];
    const [sections, events] = await Promise.all([
      supabaseAdmin.from("lb_room_sections").select("id, section_name, nights").in("id", sectionIds),
      supabaseAdmin.from("lb_events").select("id, wedding_name, check_in_date, check_out_date").in("id", eventIds),
    ]);

    return {
      bookings: bookings.map((b) => ({
        ...b,
        section: sections.data?.find((s) => s.id === b.section_id) ?? null,
        event: events.data?.find((e) => e.id === b.event_id) ?? null,
      })),
    };
  });