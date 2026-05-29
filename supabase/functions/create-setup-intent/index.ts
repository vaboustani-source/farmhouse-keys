// Public edge function: validates a payment_update_token, creates/reuses a
// Stripe customer for the booking, and returns a SetupIntent clientSecret so
// the guest can save a new card via Stripe Elements.

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { bookingToken } = await req.json();
    if (!bookingToken || typeof bookingToken !== "string") {
      return json({ status: "invalid" }, 200);
    }

    const { data: booking } = await supabase
      .from("lb_bookings")
      .select(
        "id, event_id, section_id, guest_name, guest_email, total_amount, payment_status, payment_schedule, stripe_customer_id, stripe_payment_intent_id, payment_update_token, payment_update_token_expires_at",
      )
      .eq("payment_update_token", bookingToken)
      .maybeSingle();

    if (!booking) return json({ status: "invalid" }, 200);

    if (
      booking.payment_update_token_expires_at &&
      new Date(booking.payment_update_token_expires_at).getTime() < Date.now()
    ) {
      return json({ status: "expired" }, 200);
    }

    const { data: section } = await supabase
      .from("lb_room_sections")
      .select("section_name")
      .eq("id", booking.section_id)
      .single();
    const { data: ev } = await supabase
      .from("lb_events")
      .select("wedding_name, check_in_date, check_out_date")
      .eq("id", booking.event_id)
      .single();

    const total = Number(booking.total_amount || 0);
    const balance = total / 2;
    const chargeDate = ev?.check_in_date
      ? new Date(new Date(ev.check_in_date + "T00:00:00").getTime() - 30 * 86400000)
          .toISOString()
          .slice(0, 10)
      : null;

    const summary = {
      weddingName: ev?.wedding_name ?? "",
      sectionName: section?.section_name ?? "",
      checkInDate: ev?.check_in_date ?? null,
      checkOutDate: ev?.check_out_date ?? null,
      balance,
      chargeDate,
      paymentStatus: booking.payment_status,
      guestName: booking.guest_name,
    };

    if (booking.payment_status === "paid") {
      return json({ status: "paid", booking: summary }, 200);
    }

    // Resolve / create Stripe customer
    let customerId = booking.stripe_customer_id as string | null;
    if (!customerId && booking.stripe_payment_intent_id) {
      try {
        const pi = await stripe.paymentIntents.retrieve(
          booking.stripe_payment_intent_id,
        );
        customerId =
          typeof pi.customer === "string" ? pi.customer : pi.customer?.id ?? null;
      } catch (_) {
        // ignore
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: booking.guest_email,
        name: booking.guest_name,
        metadata: { booking_id: booking.id },
      });
      customerId = customer.id;
    }
    if (customerId !== booking.stripe_customer_id) {
      await supabase
        .from("lb_bookings")
        .update({ stripe_customer_id: customerId })
        .eq("id", booking.id);
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: { booking_id: booking.id },
    });

    return json({
      status: "valid",
      clientSecret: setupIntent.client_secret,
      customerId,
      booking: summary,
    });
  } catch (err) {
    console.error("create-setup-intent error", err);
    return json({ error: (err as Error).message }, 500);
  }
});