// Admin-triggered additional charge: charges a saved Stripe payment method
// (from the booking's original PaymentIntent) off-session for cot upgrades,
// add-ons added after payment, manual charges (damage deposits, fees), etc.
//
// Auth: requires Bearer <SUPABASE_ANON_KEY> (admin UI calls this).

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Resend } from "https://esm.sh/resend@4.0.1";
import { logActivity } from "../_shared/activity-log.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_EMAIL =
  Deno.env.get("BRANDON_NOTIFICATION_EMAIL") ?? Deno.env.get("ADMIN_EMAIL") ?? "";
const FROM = "Gilbertsville Farmhouse <noreply@stay.gilbertsvillefarmhouse.com>";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

// ── Inlined email template (mirrors src/lib/email-templates.ts) ──
function additionalChargeEmail(p: {
  guestFirstName: string;
  weddingName: string;
  amount: number;
  description: string;
  notes?: string;
}): { subject: string; html: string } {
  const subject = "Additional charge from Gilbertsville Farmhouse";
  const amountStr = fmtMoney(p.amount);
  const notesRow = p.notes
    ? `<tr><td style="padding:10px 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;width:40%;vertical-align:top;">Notes</td><td style="padding:10px 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:14px;color:#1A1A1A;font-weight:400;vertical-align:top;">${p.notes}</td></tr>`
    : "";
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Gilbertsville Farmhouse</title></head>
<body style="margin:0;padding:0;background-color:#F5F0EB;font-family:'Jost',Helvetica,Arial,sans-serif;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F0EB;"><tr><td align="center" style="padding:40px 16px 24px;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;">
<tr><td align="center" style="padding-bottom:32px;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#2C3E2D;border-radius:4px 4px 0 0;"><tr><td align="center" style="padding:36px 40px 28px;">
<p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#C9A84C;font-weight:500;">GILBERTSVILLE FARMHOUSE</p>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:14px 0 0;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" width="40" style="border-top:1px solid #C9A84C;"><tr><td style="font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table>
</td></tr></table></td></tr>
<tr><td style="background-color:#FFFFFF;border-radius:0 0 4px 4px;padding:48px 48px 40px;border:1px solid #E8E2D9;border-top:none;">
<span style="display:inline-block;padding:4px 12px;background-color:#C9A84C;border-radius:2px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#1A1A1A;font-weight:500;">Charge processed</span>
<div style="margin-top:24px;">
<h1 style="margin:0 0 8px;font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;font-weight:400;color:#1A1A1A;line-height:1.2;">A charge has been applied.</h1>
<p style="margin:0 0 32px;font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:400;color:#6B6B6B;font-style:italic;">${p.weddingName}</p>
</div>
<p style="margin:0 0 20px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3A3A3A;font-weight:300;">${p.guestFirstName}, a charge has been processed on the card on file for your stay.</p>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0;"><tr><td style="border-top:1px solid #E8E2D9;font-size:0;line-height:0;">&nbsp;</td></tr></table>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;">
<tr><td style="padding:10px 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;width:40%;vertical-align:top;">Amount</td><td style="padding:10px 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:14px;color:#1A1A1A;font-weight:400;vertical-align:top;">${amountStr}</td></tr>
<tr><td style="padding:10px 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;width:40%;vertical-align:top;">Description</td><td style="padding:10px 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:14px;color:#1A1A1A;font-weight:400;vertical-align:top;">${p.description}</td></tr>
<tr><td style="padding:10px 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;width:40%;vertical-align:top;">Applied to</td><td style="padding:10px 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:14px;color:#1A1A1A;font-weight:400;vertical-align:top;">Card on file</td></tr>
${notesRow}
</table>
<p style="margin:0 0 20px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3A3A3A;font-weight:300;">If you have any questions about this charge, please reach out to your planning team.</p>
</td></tr>
<tr><td align="center" style="padding:32px 40px 48px;"><p style="margin:0 0 8px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:11px;color:#9A9188;letter-spacing:1px;text-transform:uppercase;">South New Berlin, NY · Otsego County</p>
<p style="margin:0;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:11px;color:#B8AFA6;"><a href="https://gilbertsvillefarmhouse.com" style="color:#9A9188;text-decoration:none;">gilbertsvillefarmhouse.com</a></p></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (!SUPABASE_ANON_KEY || auth !== `Bearer ${SUPABASE_ANON_KEY}`) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  let body: {
    bookingId?: string;
    amountCents?: number;
    description?: string;
    notes?: string;
    chargedBy?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  const { bookingId, amountCents, description, notes, chargedBy } = body;
  if (!bookingId || !amountCents || amountCents <= 0 || !description) {
    return new Response(
      JSON.stringify({ ok: false, error: "bookingId, amountCents (>0), and description are required" }),
      { status: 400, headers: { ...CORS, "content-type": "application/json" } },
    );
  }

  const { data: booking, error: bErr } = await supabase
    .from("lb_bookings")
    .select("id, event_id, guest_email, guest_name, stripe_payment_intent_id")
    .eq("id", bookingId)
    .single();

  if (bErr || !booking) {
    return new Response(JSON.stringify({ ok: false, error: "Booking not found" }), {
      status: 404,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  if (!booking.stripe_payment_intent_id) {
    return new Response(
      JSON.stringify({ ok: false, error: "No payment method on file for this booking" }),
      { status: 400, headers: { ...CORS, "content-type": "application/json" } },
    );
  }

  const { data: ev } = await supabase
    .from("lb_events")
    .select("wedding_name")
    .eq("id", booking.event_id)
    .single();

  const mode = (body as { mode?: string }).mode === "refund" ? "refund" : "charge";

  if (mode === "refund") {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: amountCents,
        reason: "requested_by_customer",
        metadata: { booking_id: booking.id, refund_type: "addon_removal" },
      });
      const amountDollars = amountCents / 100;
      await supabase.from("lb_additional_charges").insert({
        booking_id: booking.id,
        event_id: booking.event_id,
        amount: -amountDollars,
        description: `Refund: ${description}`,
        notes: notes ?? null,
        stripe_payment_intent_id: refund.id,
        status: "succeeded",
        charged_by: chargedBy ?? null,
      });
      await logActivity({
        eventId: booking.event_id,
        bookingId: booking.id,
        actor: "admin",
        actorName: chargedBy ?? null,
        action: "refund.partial",
        label: `Partial refund — ${booking.guest_name}`,
        metadata: { amount: amountDollars, reason: description, stripe_refund_id: refund.id },
      });
      return new Response(JSON.stringify({ ok: true, refundId: refund.id }), {
        status: 200,
        headers: { ...CORS, "content-type": "application/json" },
      });
    } catch (err) {
      const message = (err as Error).message || "Refund failed";
      console.error("charge-additional refund failed", booking.id, err);
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: 400,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }
  }

  try {
    const originalPi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
    const customerId =
      typeof originalPi.customer === "string" ? originalPi.customer : originalPi.customer?.id;
    const paymentMethodId =
      typeof originalPi.payment_method === "string"
        ? originalPi.payment_method
        : originalPi.payment_method?.id;
    if (!customerId || !paymentMethodId) {
      throw new Error("Missing customer or payment_method on original PI");
    }

    const newPi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description,
      metadata: { booking_id: booking.id, charge_type: "additional" },
    });

    if (newPi.status !== "succeeded") {
      throw new Error(`PaymentIntent status: ${newPi.status}`);
    }

    const amountDollars = amountCents / 100;
    const { data: charge } = await supabase
      .from("lb_additional_charges")
      .insert({
        booking_id: booking.id,
        event_id: booking.event_id,
        amount: amountDollars,
        description,
        notes: notes ?? null,
        stripe_payment_intent_id: newPi.id,
        status: "succeeded",
        charged_by: chargedBy ?? null,
      })
      .select("id")
      .single();

    await logActivity({
      eventId: booking.event_id,
      bookingId: booking.id,
      actor: "admin",
      actorName: chargedBy ?? null,
      action: "charge.additional_applied",
      label: `Additional charge — ${booking.guest_name}: ${description}`,
      metadata: { amount: amountDollars, stripe_payment_intent_id: newPi.id, notes: notes ?? null },
    });

    // Guest email
    try {
      const tpl = additionalChargeEmail({
        guestFirstName: (booking.guest_name || "there").split(" ")[0],
        weddingName: ev?.wedding_name ?? "your wedding stay",
        amount: amountDollars,
        description,
        notes,
      });
      await resend.emails.send({
        from: FROM,
        to: booking.guest_email,
        subject: tpl.subject,
        html: tpl.html,
      });
    } catch (err) {
      console.error("guest email failed", err);
    }

    // Admin email
    if (ADMIN_EMAIL) {
      try {
        await resend.emails.send({
          from: FROM,
          to: ADMIN_EMAIL,
          subject: `Additional charge: ${fmtMoney(amountDollars)} — ${booking.guest_name}`,
          html: `<p>Additional charge processed.</p><p><strong>${booking.guest_name}</strong> (${booking.guest_email})</p><p>Amount: <strong>${fmtMoney(amountDollars)}</strong></p><p>Description: ${description}</p>${notes ? `<p>Notes: ${notes}</p>` : ""}<p>Stripe PI: <code>${newPi.id}</code></p>`,
        });
      } catch (err) {
        console.error("admin email failed", err);
      }
    }

    return new Response(JSON.stringify({ ok: true, chargeId: charge?.id, paymentIntentId: newPi.id }), {
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (err) {
    const message = (err as Error).message || "Charge failed";
    console.error("charge-additional failed", booking.id, err);
    try {
      await supabase.from("lb_sync_log").insert({
        event_id: booking.event_id,
        lb_booking_id: booking.id,
        guest_email: booking.guest_email,
        action: "additional_charge_failed",
        direction: "outbound",
        reason: `${description}: ${message}`,
      });
    } catch (_) {
      // ignore
    }
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});