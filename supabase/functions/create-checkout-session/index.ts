import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-12-18.acacia",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

function getAppBaseUrl(req: Request) {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  return (
    Deno.env.get("APP_BASE_URL") ||
    "https://id-preview--a9cf7512-d53e-4e93-be25-666d375c693f.lovable.app"
  );
}

type CheckoutLineItem = {
  quantity: number;
  price_data: {
    currency: string;
    unit_amount: number;
    tax_behavior?: "exclusive" | "inclusive" | "unspecified";
    product_data: { name: string; tax_code?: string };
  };
};

async function lineItemsForBooking(
  bookingId: string,
  addonIds: string[],
  labelPrefix?: string,
) {
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

  const selected = (addons ?? []).filter(
    (a: any) => a.is_required || addonIds.includes(a.id),
  );

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
        tax_code: "txcd_20030000",
      },
    },
  });

  let addonAmount = 0;
  for (const a of selected as any[]) {
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
  const resortFee =
    (resortFeeBase * Number(section.resort_fee_percent || 0)) / 100;
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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let parsedBookingId: string | null = null;
  try {
    const data = await req.json();
    const {
      bookingId,
      addonIds = [],
      secondaryBookingId = null,
      secondaryAddonIds = [],
      eventSlug,
      sectionSlug,
      cotRequested = false,
    } = data;
    parsedBookingId = bookingId;

    // ── Double-booking guard ─────────────────────────────────────
    const { data: existingBk } = await supabaseAdmin
      .from("lb_bookings")
      .select("payment_status, stripe_session_id")
      .eq("id", bookingId)
      .single();

    if (existingBk?.payment_status === "deposit_paid" || existingBk?.payment_status === "paid") {
      const baseUrl = getAppBaseUrl(req);
      return new Response(
        JSON.stringify({
          already_paid: true,
          redirect_url: `${baseUrl}/book/${eventSlug}/${sectionSlug}/confirmation`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Reuse existing OPEN Stripe session if one exists (real cs_ id)
    if (
      existingBk?.payment_status === "pending" &&
      existingBk?.stripe_session_id &&
      existingBk.stripe_session_id.startsWith("cs_")
    ) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(existingBk.stripe_session_id);
        if (existing.status === "open" && existing.url) {
          return new Response(
            JSON.stringify({ url: existing.url, reused: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        // 'expired' or 'complete' → fall through and create a new session
      } catch (_) {
        // session not retrievable → create a fresh one
      }
    }

    // ── Optimistic session lock: prevents two devices creating two sessions ──
    const { data: lockAcquired, error: lockErr } = await supabaseAdmin.rpc(
      "acquire_stripe_session_lock",
      { p_booking_id: bookingId },
    );
    if (lockErr) {
      console.error("acquire_stripe_session_lock failed", lockErr);
    }
    if (lockAcquired === false) {
      return new Response(
        JSON.stringify({
          locked: true,
          message:
            "Your reservation is already being processed on another device. Complete it there or wait a minute and try again.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const primary = await lineItemsForBooking(bookingId, addonIds);

    let secondary: Awaited<ReturnType<typeof lineItemsForBooking>> | null = null;
    if (secondaryBookingId) {
      const { data: secBk } = await supabaseAdmin
        .from("lb_bookings")
        .select("guest_name")
        .eq("id", secondaryBookingId)
        .single();
      secondary = await lineItemsForBooking(
        secondaryBookingId,
        secondaryAddonIds,
        `For ${secBk?.guest_name ?? "guest"}`,
      );
    }

    let cotFee = 0;
    const cotLineItems: CheckoutLineItem[] = [];
    if (cotRequested) {
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

    const allLineItems = [
      ...primary.lineItems,
      ...cotLineItems,
      ...(secondary?.lineItems ?? []),
    ];

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

    const baseUrl = getAppBaseUrl(req);
    const successUrl = `${baseUrl}/book/${eventSlug}/${sectionSlug}/confirmation?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/book/${eventSlug}/${sectionSlug}?cancelled=true&session_id={CHECKOUT_SESSION_ID}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: appliedAmounts as any,
      customer_email: primary.booking.guest_email,
      automatic_tax: { enabled: true },
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      customer_creation: isSplit ? "always" : undefined,
      payment_intent_data: isSplit
        ? { setup_future_usage: "off_session" }
        : undefined,
      metadata: {
        primary_booking_id: bookingId,
        secondary_booking_id: secondaryBookingId ?? "",
        primary_addon_ids: JSON.stringify(addonIds),
        secondary_addon_ids: JSON.stringify(secondaryAddonIds),
        event_slug: eventSlug,
        section_slug: sectionSlug,
        payment_schedule: isSplit ? "split_50_50" : "full",
        cot_requested: cotRequested ? "1" : "0",
      },
    });

    await supabaseAdmin
      .from("lb_bookings")
      .update({
        stripe_session_id: session.id,
        base_amount: primary.baseAmount,
        addon_amount: primary.addonAmount,
        resort_fee: primary.resortFee,
        total_amount:
          primary.baseAmount +
          primary.addonAmount +
          primary.resortFee +
          cotFee,
        cot_requested: cotRequested,
        cot_fee: cotFee,
        addons_selected: primary.selected.map((a: any) => ({
          id: a.id,
          name: a.addon_name,
          price: Number(a.addon_price),
        })),
      })
      .eq("id", bookingId);

    // For split-schedule bookings, mint a payment-update token now so the
    // failure email & admin tools always have a working self-serve link.
    if (isSplit) {
      const { data: evRow } = await supabaseAdmin
        .from("lb_events")
        .select("check_in_date")
        .eq("id", primary.booking.event_id)
        .single();
      const expiresAt = evRow?.check_in_date
        ? new Date(
            new Date(evRow.check_in_date + "T00:00:00").getTime() -
              1 * 86400000,
          ).toISOString()
        : new Date(Date.now() + 14 * 86400000).toISOString();
      await supabaseAdmin
        .from("lb_bookings")
        .update({
          payment_update_token: crypto.randomUUID(),
          payment_update_token_expires_at: expiresAt,
        })
        .eq("id", bookingId)
        .is("payment_update_token", null);
    }

    if (secondary) {
      await supabaseAdmin
        .from("lb_bookings")
        .update({
          stripe_session_id: session.id,
          base_amount: secondary.baseAmount,
          addon_amount: secondary.addonAmount,
          resort_fee: secondary.resortFee,
          total_amount:
            secondary.baseAmount +
            secondary.addonAmount +
            secondary.resortFee,
          addons_selected: secondary.selected.map((a: any) => ({
            id: a.id,
            name: a.addon_name,
            price: Number(a.addon_price),
          })),
          covered_by_booking_id: bookingId,
        })
        .eq("id", secondaryBookingId);
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout-session error", err);
    // Release any optimistic lock so the guest can retry immediately.
    if (parsedBookingId) {
      try {
        await supabaseAdmin
          .from("lb_bookings")
          .update({ stripe_session_id: null })
          .eq("id", parsedBookingId)
          .like("stripe_session_id", "PENDING_%");
      } catch (_) {}
    }
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});