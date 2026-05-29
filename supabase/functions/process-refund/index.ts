// Process a Stripe refund for an lb_booking, update booking + lodging
// state, and notify guest and admin. Inline branded HTML mirrors
// baseTemplate() in src/lib/email-templates.ts (the edge runtime can't
// import from src/).

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Resend } from "https://esm.sh/resend@4.0.1";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_EMAIL =
  Deno.env.get("BRANDON_NOTIFICATION_EMAIL") ?? Deno.env.get("ADMIN_EMAIL") ?? "";
const FROM = "Gilbertsville Farmhouse <noreply@gilbertsvillefarmhouse.com>";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";
const firstName = (full: string) => (full || "").trim().split(/\s+/)[0] || "there";

function baseTemplate(content: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#F5F0EB;font-family:'Jost',Helvetica,Arial,sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F0EB;">
    <tr><td align="center" style="padding:40px 16px 24px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;">
        <tr><td align="center" style="padding-bottom:32px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#2C3E2D;border-radius:4px 4px 0 0;">
            <tr><td align="center" style="padding:36px 40px 28px;">
              <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#C9A84C;font-weight:500;">GILBERTSVILLE FARMHOUSE</p>
              <table role="presentation" align="center" width="40" style="margin-top:14px;border-top:1px solid #C9A84C;"><tr><td style="font-size:0;line-height:0;">&nbsp;</td></tr></table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#FFFFFF;border-radius:0 0 4px 4px;padding:48px 48px 40px;border:1px solid #E8E2D9;border-top:none;">${content}</td></tr>
        <tr><td align="center" style="padding:32px 40px 48px;">
          <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#9A9188;">GILBERTSVILLE FARMHOUSE</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function guestRefundHtml(opts: {
  guestName: string;
  weddingName: string;
  sectionName: string;
  checkIn: string;
  amount: number;
  within45: boolean;
}): string {
  const policy = opts.within45
    ? `<p style="margin:0 0 8px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9A9188;">CANCELLATION POLICY</p>
       <p style="margin:0 0 20px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#9A9188;font-weight:300;">Cancellation is possible up to 45 days prior to the first check-in date of your stay. After that time, the reservation is fully non-refundable.</p>`
    : "";
  return baseTemplate(`
    <span style="display:inline-block;padding:4px 12px;background-color:#2C3E2D;border-radius:2px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;font-weight:500;">Refund processed</span>
    <div style="margin-top:24px;">
      <h1 style="margin:0 0 8px;font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;font-weight:400;color:#1A1A1A;line-height:1.2;">Your refund is on the way.</h1>
      <p style="margin:0 0 32px;font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:400;color:#6B6B6B;font-style:italic;">${opts.weddingName}</p>
    </div>
    <p style="margin:0 0 20px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3A3A3A;font-weight:300;">Hi ${firstName(opts.guestName)},</p>
    <p style="margin:0 0 20px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3A3A3A;font-weight:300;">A refund of <strong>${fmtMoney(opts.amount)}</strong> has been processed for your reservation at <strong>${opts.weddingName}</strong>.</p>
    <p style="margin:0 0 20px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3A3A3A;font-weight:300;">Please allow 5–10 business days for the refund to appear on your statement.</p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0;"><tr><td style="border-top:1px solid #E8E2D9;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;">
      <tr><td style="padding:10px 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;width:40%;">Lodging</td><td style="padding:10px 0;font-size:14px;color:#1A1A1A;">${opts.sectionName}</td></tr>
      <tr><td style="padding:10px 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;">Original arrival</td><td style="padding:10px 0;font-size:14px;color:#1A1A1A;">${opts.checkIn}</td></tr>
      <tr><td style="padding:10px 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;">Refund amount</td><td style="padding:10px 0;font-size:14px;color:#1A1A1A;">${fmtMoney(opts.amount)}</td></tr>
    </table>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0;"><tr><td style="border-top:1px solid #C9A84C;font-size:0;line-height:0;opacity:0.4;">&nbsp;</td></tr></table>
    ${policy}
    <p style="margin:0 0 20px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3A3A3A;font-weight:300;">If you have questions, reach out to your planning team.</p>
  `);
}

function adminRefundHtml(opts: {
  guestName: string;
  guestEmail: string;
  weddingName: string;
  sectionName: string;
  amount: number;
  reason: string;
  notes: string;
  processedBy: string;
  timestamp: string;
}): string {
  return baseTemplate(`
    <span style="display:inline-block;padding:4px 12px;background-color:#FDF3F0;border-radius:2px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#C0392B;font-weight:500;">Refund processed</span>
    <div style="margin-top:24px;">
      <h1 style="margin:0 0 8px;font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:400;color:#1A1A1A;">Refund processed</h1>
      <p style="margin:0 0 32px;font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;color:#6B6B6B;font-style:italic;">${opts.weddingName}</p>
    </div>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;">
      <tr><td style="padding:10px 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;width:40%;">Guest</td><td style="padding:10px 0;font-size:14px;color:#1A1A1A;">${opts.guestName}</td></tr>
      <tr><td style="padding:10px 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;">Email</td><td style="padding:10px 0;font-size:14px;color:#1A1A1A;">${opts.guestEmail}</td></tr>
      <tr><td style="padding:10px 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;">Section</td><td style="padding:10px 0;font-size:14px;color:#1A1A1A;">${opts.sectionName}</td></tr>
      <tr><td style="padding:10px 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;">Amount</td><td style="padding:10px 0;font-size:14px;color:#1A1A1A;">${fmtMoney(opts.amount)}</td></tr>
      <tr><td style="padding:10px 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;">Reason</td><td style="padding:10px 0;font-size:14px;color:#1A1A1A;">${opts.reason}</td></tr>
      ${opts.notes ? `<tr><td style="padding:10px 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;">Notes</td><td style="padding:10px 0;font-size:14px;color:#1A1A1A;">${opts.notes}</td></tr>` : ""}
      <tr><td style="padding:10px 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;">Processed by</td><td style="padding:10px 0;font-size:14px;color:#1A1A1A;">${opts.processedBy}</td></tr>
      <tr><td style="padding:10px 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;">At</td><td style="padding:10px 0;font-size:14px;color:#1A1A1A;">${opts.timestamp}</td></tr>
    </table>
  `);
}

type Body = {
  bookingId: string;
  refundType: "full" | "partial" | "deposit";
  amount: number; // cents
  reason: string;
  notes?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  if (!body.bookingId || !body.refundType || !body.reason || !Number.isFinite(body.amount) || body.amount <= 0) {
    return new Response(JSON.stringify({ error: "Missing or invalid fields" }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }

  // Identify caller (admin) if a user JWT is forwarded
  let processedBy = "admin";
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    try {
      const { data: userData } = await supabase.auth.getUser(authHeader.slice(7));
      if (userData?.user?.email) processedBy = userData.user.email;
    } catch (_) {
      // ignore
    }
  }

  // Fetch booking + event + section
  const { data: booking, error: bErr } = await supabase
    .from("lb_bookings")
    .select("*")
    .eq("id", body.bookingId)
    .single();
  if (bErr || !booking) {
    return new Response(JSON.stringify({ error: "Booking not found" }), {
      status: 404,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
  if (!booking.stripe_payment_intent_id) {
    return new Response(
      JSON.stringify({ error: "Booking has no Stripe payment intent on file" }),
      { status: 400, headers: { ...CORS, "content-type": "application/json" } },
    );
  }

  const [{ data: event }, { data: section }] = await Promise.all([
    supabase.from("lb_events").select("*").eq("id", booking.event_id).single(),
    supabase.from("lb_room_sections").select("*").eq("id", booking.section_id).single(),
  ]);

  // Process refund through Stripe
  let refund;
  try {
    refund = await stripe.refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      amount: body.refundType === "full" ? undefined : body.amount,
      reason: "requested_by_customer",
      metadata: {
        booking_id: booking.id,
        refund_type: body.refundType,
        admin_reason: body.reason,
      },
    });
  } catch (err) {
    const msg = (err as Error).message || "Stripe refund failed";
    await supabase.from("lb_sync_log").insert({
      action: "error",
      direction: "refund",
      lb_booking_id: booking.id,
      event_id: booking.event_id,
      guest_email: booking.guest_email,
      reason: `Stripe refund failed: ${msg}`,
    });
    return new Response(
      JSON.stringify({ error: msg, stripeFailure: true }),
      { status: 502, headers: { ...CORS, "content-type": "application/json" } },
    );
  }

  const refundedDollars = (refund.amount ?? body.amount) / 100;

  // Deposit-only: also cancel the scheduled balance charge
  if (body.refundType === "deposit") {
    try {
      await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id);
    } catch (err) {
      // Already-captured PIs cannot be cancelled — log and continue
      console.error("PI cancel failed (non-fatal)", err);
    }
  }

  // Update booking
  await supabase
    .from("lb_bookings")
    .update({
      payment_status: "refunded",
      refund_amount: refundedDollars,
      refunded_at: new Date().toISOString(),
      refund_reason: body.reason,
      refund_notes: body.notes ?? null,
      stripe_refund_id: refund.id,
      removed: true,
      removed_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  // Log
  await supabase.from("lb_sync_log").insert({
    action: "refund",
    direction: "refund",
    lb_booking_id: booking.id,
    event_id: booking.event_id,
    guest_email: booking.guest_email,
    reason: `${body.reason} — ${fmtMoney(refundedDollars)} (${body.refundType})`,
  });

  // Determine whether check-in is within 45 days for policy reminder text
  const within45 = (() => {
    if (!event?.check_in_date) return false;
    const ci = new Date(event.check_in_date + "T00:00:00").getTime();
    return ci - Date.now() < 45 * 24 * 60 * 60 * 1000;
  })();

  // Guest email
  try {
    await resend.emails.send({
      from: FROM,
      to: booking.guest_email,
      subject: "Your Gilbertsville Farmhouse refund is on the way",
      html: guestRefundHtml({
        guestName: booking.guest_name,
        weddingName: event?.wedding_name ?? "your reservation",
        sectionName: section?.section_name ?? "",
        checkIn: fmtDate(event?.check_in_date),
        amount: refundedDollars,
        within45,
      }),
    });
  } catch (err) {
    console.error("guest refund email failed", err);
  }

  // Admin email
  if (ADMIN_EMAIL) {
    try {
      await resend.emails.send({
        from: FROM,
        to: ADMIN_EMAIL,
        subject: `Refund processed — ${booking.guest_name} · ${event?.wedding_name ?? ""}`,
        html: adminRefundHtml({
          guestName: booking.guest_name,
          guestEmail: booking.guest_email,
          weddingName: event?.wedding_name ?? "",
          sectionName: section?.section_name ?? "",
          amount: refundedDollars,
          reason: body.reason,
          notes: body.notes ?? "",
          processedBy,
          timestamp: new Date().toUTCString(),
        }),
      });
    } catch (err) {
      console.error("admin refund email failed", err);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      refundId: refund.id,
      amount: refundedDollars,
      status: refund.status,
    }),
    { status: 200, headers: { ...CORS, "content-type": "application/json" } },
  );
});