// Refunds require owner approval.
//
//   POST {action:"request", bookingId, refundType, amount, reason, notes}
//     Staff (logged in) file a request. Approvers get an email with signed
//     Approve / Decline links; the requester gets a confirmation.
//   GET  ?rid=&t=&a=approve|decline
//     Renders a confirmation page (no side effects, safe for link prefetch).
//   POST {action:"decide", rid, t?, decision, note?}   (JSON or form)
//     Validates the one-time token (or a logged-in approver) and, on approve,
//     runs the Stripe refund, updates the booking, and emails everyone.
//
// Anything else is refused. Money never moves without an approved request.
// Inline branded HTML mirrors baseTemplate() in src/lib/email-templates.ts.

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Resend } from "https://esm.sh/resend@4.0.1";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_EMAIL =
  Deno.env.get("BRANDON_NOTIFICATION_EMAIL") ?? Deno.env.get("ADMIN_EMAIL") ?? "";
const FROM = "Gilbertsville Farmhouse <noreply@stay.gilbertsvillefarmhouse.com>";
const APP_BASE_URL = "https://stay.gilbertsvillefarmhouse.com";
const FN_URL = `${SUPABASE_URL}/functions/v1/process-refund`;
const TOKEN_DAYS = 14;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};
const JSON_H = { ...CORS, "content-type": "application/json" };
const HTML_H = { ...CORS, "content-type": "text/html; charset=utf-8" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: JSON_H });
const html = (body: string, status = 200) => new Response(body, { status, headers: HTML_H });

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
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function logActivity(input: {
  eventId?: string | null;
  bookingId?: string | null;
  actor: "admin" | "guest" | "system" | "stripe";
  actorName?: string | null;
  action: string;
  label: string;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await supabase.from("lb_activity_log").insert({
      event_id: input.eventId ?? null,
      booking_id: input.bookingId ?? null,
      actor: input.actor,
      actor_name: input.actorName ?? null,
      action: input.action,
      label: input.label,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    console.error("logActivity failed", err);
  }
}

async function approverEmails(): Promise<string[]> {
  const { data } = await supabase
    .from("lb_private_config")
    .select("value")
    .eq("key", "refund_approver_emails")
    .maybeSingle();
  const raw = data?.value ?? Deno.env.get("REFUND_APPROVER_EMAILS") ?? "";
  const list = raw.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
  return list.length ? list : ADMIN_EMAIL ? [ADMIN_EMAIL.toLowerCase()] : [];
}

type Caller = { id: string | null; email: string | null; isStaff: boolean; isApprover: boolean };
async function identifyCaller(req: Request, approvers: string[]): Promise<Caller> {
  const out: Caller = { id: null, email: null, isStaff: false, isApprover: false };
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return out;
  const jwt = authHeader.slice(7);
  try {
    const { data } = await supabase.auth.getUser(jwt);
    const u = data?.user;
    if (!u?.id) return out;
    out.id = u.id;
    out.email = (u.email ?? "").toLowerCase() || null;
    out.isApprover = !!out.email && approvers.includes(out.email);
    const [{ data: row }, { data: eu }] = await Promise.all([
      supabase.from("users").select("role").eq("id", u.id).maybeSingle(),
      supabase.from("event_users").select("role_in_event").eq("user_id", u.id),
    ]);
    const staffEventRoles = new Set(["admin", "owner", "event_director", "planner"]);
    out.isStaff =
      row?.role === "admin" ||
      row?.role === "event_director" ||
      (eu ?? []).some((r: { role_in_event: string }) => staffEventRoles.has(r.role_in_event));
  } catch (_) {
    // unauthenticated
  }
  return out;
}

/* ───────────── email + page templates ───────────── */

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
const P = (t: string) =>
  `<p style="margin:0 0 20px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3A3A3A;font-weight:300;">${t}</p>`;
const ROW = (k: string, v: string) =>
  `<tr><td style="padding:10px 0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;width:40%;vertical-align:top;">${k}</td><td style="padding:10px 0;font-size:14px;color:#1A1A1A;">${v}</td></tr>`;
const TABLE = (rows: string) =>
  `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;">${rows}</table>`;
const BADGE = (t: string, warn = false) =>
  `<span style="display:inline-block;padding:4px 12px;background-color:${warn ? "#FDF3F0" : "#2C3E2D"};border-radius:2px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${warn ? "#C0392B" : "#C9A84C"};font-weight:500;">${t}</span>`;
const H1 = (t: string, sub: string) =>
  `<div style="margin-top:24px;"><h1 style="margin:0 0 8px;font-family:'Cormorant Garamond',Georgia,serif;font-size:30px;font-weight:400;color:#1A1A1A;line-height:1.2;">${t}</h1><p style="margin:0 0 32px;font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;color:#6B6B6B;font-style:italic;">${sub}</p></div>`;
const BTN = (href: string, label: string, danger = false) =>
  `<a href="${href}" style="display:inline-block;padding:14px 28px;margin:0 12px 12px 0;background-color:${danger ? "#FFFFFF" : "#2C3E2D"};color:${danger ? "#C0392B" : "#FFFFFF"};border:1px solid ${danger ? "#C0392B" : "#2C3E2D"};border-radius:3px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;font-weight:500;">${label}</a>`;

type Ctx = {
  request: Record<string, any>;
  booking: Record<string, any>;
  event: Record<string, any> | null;
  section: Record<string, any> | null;
};

function detailRows(c: Ctx): string {
  const r = c.request;
  return (
    ROW("Guest", `${esc(c.booking.guest_name)}<br><span style="color:#6B6B6B;">${esc(c.booking.guest_email)}</span>`) +
    ROW("Wedding", esc(c.event?.wedding_name ?? "")) +
    ROW("Lodging", esc(c.section?.section_name ?? "")) +
    ROW("Arrival", esc(fmtDate(c.event?.check_in_date))) +
    ROW("Paid to date", fmtMoney(paidToDate(c.booking))) +
    ROW("Refund requested", `<strong>${fmtMoney(r.amount_cents / 100)}</strong> · ${esc(r.refund_type)}`) +
    ROW("Reason", esc(r.reason)) +
    (r.notes ? ROW("Notes", esc(r.notes)) : "") +
    ROW("Requested by", `${esc(r.requested_by_name || r.requested_by_email)}<br><span style="color:#6B6B6B;">${esc(r.requested_by_email)}</span>`) +
    ROW("Requested", esc(new Date(r.created_at).toLocaleString("en-US", { timeZone: "America/New_York" }) + " ET"))
  );
}

function paidToDate(b: Record<string, any>): number {
  const total = Number(b.total_amount) || 0;
  if (b.payment_status === "paid" || b.payment_status === "covered") return total;
  if (b.payment_status === "deposit_paid") return total / 2;
  return 0;
}

function approverEmailHtml(c: Ctx, token: string): string {
  const link = (a: string) => `${FN_URL}?rid=${c.request.id}&t=${token}&a=${a}`;
  return baseTemplate(`
    ${BADGE("Refund needs your approval", true)}
    ${H1("A refund is waiting on you.", esc(c.event?.wedding_name ?? ""))}
    ${P(`${esc(c.request.requested_by_name || c.request.requested_by_email)} is asking to refund <strong>${fmtMoney(c.request.amount_cents / 100)}</strong> to ${esc(c.booking.guest_name)}. Nothing has been sent to the guest yet. The money moves only if you approve.`)}
    ${TABLE(detailRows(c))}
    <div style="margin:8px 0 28px;">${BTN(link("approve"), "Review & approve")}${BTN(link("decline"), "Decline", true)}</div>
    ${P(`<span style="font-size:12px;color:#9A9188;">These links are personal to you and expire in ${TOKEN_DAYS} days. Either button opens a confirmation page first, so nothing happens by accident.</span>`)}
  `);
}

function requesterFiledHtml(c: Ctx, approvers: string[]): string {
  return baseTemplate(`
    ${BADGE("Sent for approval")}
    ${H1("Your refund request is with Sharon.", esc(c.event?.wedding_name ?? ""))}
    ${P(`Nothing has been refunded yet and the guest has not been notified. ${esc(approvers.join(", "))} will approve or decline, and you'll get an email either way.`)}
    ${TABLE(detailRows(c))}
  `);
}

function requesterDecidedHtml(c: Ctx, approved: boolean, extra: string): string {
  return baseTemplate(`
    ${BADGE(approved ? "Refund approved & processed" : "Refund declined", !approved)}
    ${H1(approved ? "The refund went through." : "This refund was declined.", esc(c.event?.wedding_name ?? ""))}
    ${P(extra)}
    ${TABLE(detailRows(c) + ROW("Decision by", esc(c.request.decided_by_email ?? "")) + (c.request.decision_notes ? ROW("Note", esc(c.request.decision_notes)) : ""))}
  `);
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
    ${BADGE("Refund processed")}
    ${H1("Your refund is on the way.", esc(opts.weddingName))}
    ${P(`Hi ${esc(firstName(opts.guestName))},`)}
    ${P(`A refund of <strong>${fmtMoney(opts.amount)}</strong> has been processed for your reservation at <strong>${esc(opts.weddingName)}</strong>.`)}
    ${P("Please allow 5–10 business days for the refund to appear on your statement.")}
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0;"><tr><td style="border-top:1px solid #E8E2D9;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    ${TABLE(ROW("Lodging", esc(opts.sectionName)) + ROW("Original arrival", esc(opts.checkIn)) + ROW("Refund amount", fmtMoney(opts.amount)))}
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0;"><tr><td style="border-top:1px solid #C9A84C;font-size:0;line-height:0;opacity:0.4;">&nbsp;</td></tr></table>
    ${policy}
    ${P("If you have questions, reach out to your planning team.")}
  `);
}

function pageShell(title: string, inner: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Gilbertsville Farmhouse</title>
  <style>
    body{margin:0;background:#F5F0EB;font-family:Jost,Helvetica,Arial,sans-serif;color:#1A1A1A}
    .wrap{max-width:560px;margin:40px auto;padding:0 16px}
    .head{background:#2C3E2D;border-radius:4px 4px 0 0;padding:30px 40px;text-align:center;color:#C9A84C;font-family:'Cormorant Garamond',Georgia,serif;font-size:11px;letter-spacing:4px;text-transform:uppercase}
    .card{background:#fff;border:1px solid #E8E2D9;border-top:none;border-radius:0 0 4px 4px;padding:40px}
    h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:400;font-size:30px;margin:0 0 6px}
    .sub{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;color:#6B6B6B;font-size:18px;margin:0 0 24px}
    p{font-size:15px;line-height:1.7;color:#3A3A3A;font-weight:300;margin:0 0 18px}
    table{width:100%;border-collapse:collapse;margin:0 0 24px}
    td{padding:9px 0;font-size:14px;border-bottom:1px solid #F0EBE4;vertical-align:top}
    td:first-child{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;width:40%}
    label{display:block;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;margin:0 0 6px}
    textarea{width:100%;box-sizing:border-box;border:1px solid #E8E2D9;border-radius:3px;padding:10px;font:inherit;font-size:14px;min-height:70px}
    .btn{display:inline-block;padding:14px 28px;margin:16px 12px 0 0;border-radius:3px;font-size:12px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;font-weight:500;border:1px solid #2C3E2D;background:#2C3E2D;color:#fff;cursor:pointer;font-family:inherit}
    .btn.danger{background:#fff;color:#C0392B;border-color:#C0392B}
    .btn.ghost{background:#fff;color:#6B6B6B;border-color:#E8E2D9}
    .badge{display:inline-block;padding:4px 12px;border-radius:2px;font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:500;background:#2C3E2D;color:#C9A84C}
    .badge.warn{background:#FDF3F0;color:#C0392B}
    .muted{font-size:12px;color:#9A9188}
  </style></head><body><div class="wrap"><div class="head">Gilbertsville Farmhouse</div><div class="card">${inner}</div></div></body></html>`;
}

function confirmPage(c: Ctx, token: string, action: "approve" | "decline"): string {
  const approve = action === "approve";
  return pageShell(
    approve ? "Approve refund" : "Decline refund",
    `<span class="badge ${approve ? "" : "warn"}">${approve ? "Approve this refund?" : "Decline this refund?"}</span>
     <h1 style="margin-top:18px">${approve ? "Confirm the refund." : "Confirm the decline."}</h1>
     <p class="sub">${esc(c.event?.wedding_name ?? "")}</p>
     <p>${approve
       ? `Approving sends <strong>${fmtMoney(c.request.amount_cents / 100)}</strong> back to ${esc(c.booking.guest_name)}'s card through Stripe, marks the reservation refunded, and emails the guest and ${esc(c.request.requested_by_name || c.request.requested_by_email)}. This cannot be undone.`
       : `Declining keeps the reservation as it is. ${esc(c.request.requested_by_name || c.request.requested_by_email)} will be told, and the guest hears nothing.`}</p>
     <table>${detailRows(c)}</table>
     <form method="post" action="${FN_URL}">
       <input type="hidden" name="action" value="decide">
       <input type="hidden" name="rid" value="${esc(c.request.id)}">
       <input type="hidden" name="t" value="${esc(token)}">
       <input type="hidden" name="decision" value="${action}">
       <label for="note">Note to ${esc(c.request.requested_by_name || "the requester")} (optional)</label>
       <textarea id="note" name="note" maxlength="500"></textarea>
       <button type="submit" class="btn ${approve ? "" : "danger"}">${approve ? "Yes, refund " + fmtMoney(c.request.amount_cents / 100) : "Yes, decline"}</button>
       <a class="btn ghost" href="${FN_URL}?rid=${esc(c.request.id)}&t=${esc(token)}&a=${approve ? "decline" : "approve"}">${approve ? "Decline instead" : "Approve instead"}</a>
     </form>
     <p class="muted" style="margin-top:20px">Signed in as the refund approver via your email link.</p>`,
  );
}

function resultPage(title: string, badge: string, body: string, warn = false): string {
  return pageShell(title, `<span class="badge ${warn ? "warn" : ""}">${badge}</span><h1 style="margin-top:18px">${title}</h1><p>${body}</p><a class="btn ghost" href="${APP_BASE_URL}">Open the lodging app</a>`);
}

/* ───────────── data helpers ───────────── */

async function loadCtx(requestId: string): Promise<Ctx | null> {
  const { data: request } = await supabase.from("lb_refund_requests").select("*").eq("id", requestId).maybeSingle();
  if (!request) return null;
  const { data: booking } = await supabase.from("lb_bookings").select("*").eq("id", request.booking_id).single();
  if (!booking) return null;
  const [{ data: event }, { data: section }] = await Promise.all([
    supabase.from("lb_events").select("*").eq("id", booking.event_id).maybeSingle(),
    supabase.from("lb_room_sections").select("*").eq("id", booking.section_id).maybeSingle(),
  ]);
  return { request, booking, event: event ?? null, section: section ?? null };
}

async function tokenValid(c: Ctx, token: string | null): Promise<boolean> {
  if (!token || !c.request.approval_token_hash) return false;
  if (c.request.token_expires_at && new Date(c.request.token_expires_at).getTime() < Date.now()) return false;
  return (await sha256hex(token)) === c.request.approval_token_hash;
}

async function sendMail(to: string | string[], subject: string, htmlBody: string) {
  try {
    await resend.emails.send({ from: FROM, to, subject, html: htmlBody });
  } catch (err) {
    console.error("email failed", subject, err);
  }
}

/* ───────────── the refund itself ───────────── */

async function executeRefund(c: Ctx, decidedBy: string): Promise<{ ok: true; amount: number; refundId: string } | { ok: false; error: string }> {
  const { request: r, booking } = c;
  if (!booking.stripe_payment_intent_id) return { ok: false, error: "Booking has no Stripe payment intent on file" };
  let refund;
  try {
    refund = await stripe.refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      amount: r.refund_type === "full" ? undefined : r.amount_cents,
      reason: "requested_by_customer",
      metadata: {
        booking_id: booking.id,
        refund_request_id: r.id,
        refund_type: r.refund_type,
        admin_reason: r.reason,
        approved_by: decidedBy,
        requested_by: r.requested_by_email,
      },
    });
  } catch (err) {
    const msg = (err as Error).message || "Stripe refund failed";
    await supabase.from("lb_sync_log").insert({
      action: "error", direction: "refund", lb_booking_id: booking.id, event_id: booking.event_id,
      guest_email: booking.guest_email, reason: `Stripe refund failed: ${msg}`,
    });
    return { ok: false, error: msg };
  }
  const refundedDollars = (refund.amount ?? r.amount_cents) / 100;

  if (r.refund_type === "deposit") {
    try { await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id); } catch (err) { console.error("PI cancel failed (non-fatal)", err); }
  }

  const now = new Date().toISOString();
  await supabase.from("lb_bookings").update({
    payment_status: "refunded",
    refund_amount: refundedDollars,
    refunded_at: now,
    refund_reason: r.reason,
    refund_notes: r.notes ?? null,
    stripe_refund_id: refund.id,
    refunded_by: decidedBy,
    removed: true,
    removed_at: now,
  }).eq("id", booking.id);

  await supabase.from("lb_sync_log").insert({
    action: "refund", direction: "refund", lb_booking_id: booking.id, event_id: booking.event_id,
    guest_email: booking.guest_email,
    reason: `${r.reason} — ${fmtMoney(refundedDollars)} (${r.refund_type}); requested by ${r.requested_by_email}, approved by ${decidedBy}`,
  });

  const within45 = (() => {
    if (!c.event?.check_in_date) return false;
    const ci = new Date(c.event.check_in_date + "T00:00:00").getTime();
    return ci - Date.now() < 45 * 24 * 60 * 60 * 1000;
  })();
  await sendMail(booking.guest_email, "Your Gilbertsville Farmhouse refund is on the way", guestRefundHtml({
    guestName: booking.guest_name,
    weddingName: c.event?.wedding_name ?? "your reservation",
    sectionName: c.section?.section_name ?? "",
    checkIn: fmtDate(c.event?.check_in_date),
    amount: refundedDollars,
    within45,
  }));

  return { ok: true, amount: refundedDollars, refundId: refund.id };
}

/* ───────────── handlers ───────────── */

async function handleRequest(req: Request, body: Record<string, any>, approvers: string[]) {
  const caller = await identifyCaller(req, approvers);
  if (!caller.id || !caller.isStaff) return json({ error: "Sign in as staff to request a refund." }, 401);

  const { bookingId, refundType, amount, reason, notes } = body;
  if (!bookingId || !["full", "partial", "deposit"].includes(refundType) || !reason || !Number.isFinite(amount) || amount <= 0) {
    return json({ error: "Missing or invalid fields" }, 400);
  }
  if (approvers.length === 0) return json({ error: "No refund approver is configured. Add refund_approver_emails in lb_private_config." }, 500);

  const { data: booking } = await supabase.from("lb_bookings").select("*").eq("id", bookingId).maybeSingle();
  if (!booking) return json({ error: "Booking not found" }, 404);
  if (!["paid", "deposit_paid", "covered"].includes(booking.payment_status)) return json({ error: `Booking is ${booking.payment_status}; nothing to refund.` }, 400);
  if (!booking.stripe_payment_intent_id) return json({ error: "Booking has no Stripe payment intent on file" }, 400);
  const maxCents = Math.round(paidToDate(booking) * 100);
  if (amount > maxCents + 1) return json({ error: `Amount exceeds paid to date (${fmtMoney(maxCents / 100)})` }, 400);

  const { data: open } = await supabase.from("lb_refund_requests").select("id").eq("booking_id", bookingId).eq("status", "pending").maybeSingle();
  if (open) return json({ error: "A refund request is already waiting for approval on this booking." , requestId: open.id }, 409);

  const { data: userRow } = await supabase.from("users").select("first_name, last_name").eq("id", caller.id).maybeSingle();
  const requesterName = [userRow?.first_name, userRow?.last_name].filter(Boolean).join(" ") || null;

  const token = newToken();
  const { data: request, error: insErr } = await supabase.from("lb_refund_requests").insert({
    booking_id: bookingId,
    event_id: booking.event_id,
    requested_by: caller.id,
    requested_by_email: caller.email,
    requested_by_name: requesterName,
    refund_type: refundType,
    amount_cents: Math.round(amount),
    reason,
    notes: notes || null,
    status: "pending",
    approval_token_hash: await sha256hex(token),
    token_expires_at: new Date(Date.now() + TOKEN_DAYS * 86400000).toISOString(),
  }).select("*").single();
  if (insErr || !request) return json({ error: insErr?.message ?? "Could not file request" }, 500);

  const ctx = await loadCtx(request.id);
  if (!ctx) return json({ error: "Could not load request" }, 500);

  await sendMail(approvers, `Refund approval needed — ${booking.guest_name} · ${fmtMoney(amount / 100)} · ${ctx.event?.wedding_name ?? ""}`, approverEmailHtml(ctx, token));
  if (caller.email) await sendMail(caller.email, `Refund request sent for approval — ${booking.guest_name}`, requesterFiledHtml(ctx, approvers));

  await logActivity({
    eventId: booking.event_id, bookingId: booking.id, actor: "admin", actorName: caller.email,
    action: "refund_requested",
    label: `Refund of ${fmtMoney(amount / 100)} requested for ${booking.guest_name}; awaiting approval from ${approvers.join(", ")}`,
    metadata: { request_id: request.id, refund_type: refundType, amount_cents: amount, reason },
  });

  return json({ success: true, requestId: request.id, approvers });
}

async function handleDecide(req: Request, body: Record<string, any>, approvers: string[], wantsHtml: boolean) {
  const rid = body.rid as string | undefined;
  const token = (body.t as string | undefined) ?? null;
  const decision = body.decision as string | undefined;
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;
  if (!rid || !["approve", "decline"].includes(decision ?? "")) {
    return wantsHtml ? html(resultPage("Something is missing", "Invalid link", "This approval link is incomplete.", true), 400) : json({ error: "Missing rid/decision" }, 400);
  }
  const ctx = await loadCtx(rid);
  if (!ctx) return wantsHtml ? html(resultPage("Not found", "Unknown request", "We couldn't find that refund request.", true), 404) : json({ error: "Request not found" }, 404);

  const caller = await identifyCaller(req, approvers);
  const viaToken = await tokenValid(ctx, token);
  if (!viaToken && !caller.isApprover) {
    return wantsHtml
      ? html(resultPage("Link expired", "Not authorized", "This approval link is invalid or has expired. Ask the requester to file the refund again.", true), 403)
      : json({ error: "Not authorized to decide refunds" }, 403);
  }
  const decidedBy = caller.isApprover && caller.email ? caller.email : approvers[0] ?? "approver";

  if (ctx.request.status !== "pending") {
    const s = ctx.request.status;
    return wantsHtml
      ? html(resultPage("Already handled", s, `This request is already ${s}${ctx.request.decided_by_email ? " by " + esc(ctx.request.decided_by_email) : ""}.`, s !== "processed"))
      : json({ error: `Request already ${s}` }, 409);
  }

  const now = new Date().toISOString();
  const approved = decision === "approve";

  if (!approved) {
    await supabase.from("lb_refund_requests").update({ status: "declined", decided_at: now, decided_by_email: decidedBy, decision_notes: note, approval_token_hash: null }).eq("id", rid);
    ctx.request = { ...ctx.request, status: "declined", decided_at: now, decided_by_email: decidedBy, decision_notes: note };
    await sendMail(ctx.request.requested_by_email, `Refund declined — ${ctx.booking.guest_name}`, requesterDecidedHtml(ctx, false, `${esc(decidedBy)} declined the refund for ${esc(ctx.booking.guest_name)}. The reservation is unchanged and the guest was not contacted.`));
    await logActivity({ eventId: ctx.booking.event_id, bookingId: ctx.booking.id, actor: "admin", actorName: decidedBy, action: "refund_declined", label: `Refund request for ${ctx.booking.guest_name} declined by ${decidedBy}${note ? ` — ${note}` : ""}`, metadata: { request_id: rid } });
    return wantsHtml
      ? html(resultPage("Declined", "Refund declined", `${esc(ctx.request.requested_by_name || ctx.request.requested_by_email)} has been told. The guest was not contacted.`, true))
      : json({ success: true, status: "declined" });
  }

  // Approve: claim the request first so a double-click can't refund twice.
  const { data: claimed } = await supabase.from("lb_refund_requests")
    .update({ status: "approved", decided_at: now, decided_by_email: decidedBy, decision_notes: note, approval_token_hash: null })
    .eq("id", rid).eq("status", "pending").select("id").maybeSingle();
  if (!claimed) {
    return wantsHtml ? html(resultPage("Already handled", "In progress", "This request is already being processed.")) : json({ error: "Request already being processed" }, 409);
  }
  ctx.request = { ...ctx.request, status: "approved", decided_at: now, decided_by_email: decidedBy, decision_notes: note };

  const result = await executeRefund(ctx, decidedBy);
  if (!result.ok) {
    await supabase.from("lb_refund_requests").update({ status: "failed", error: result.error }).eq("id", rid);
    await sendMail(ctx.request.requested_by_email, `Refund approved but Stripe failed — ${ctx.booking.guest_name}`, requesterDecidedHtml({ ...ctx, request: { ...ctx.request, status: "failed" } }, true, `${esc(decidedBy)} approved this refund, but Stripe refused it: <strong>${esc(result.error)}</strong>. Process it manually in the Stripe dashboard, then mark the booking refunded from the Adjust panel.`));
    await logActivity({ eventId: ctx.booking.event_id, bookingId: ctx.booking.id, actor: "stripe", actorName: decidedBy, action: "refund_failed", label: `Refund for ${ctx.booking.guest_name} approved by ${decidedBy} but Stripe failed: ${result.error}`, metadata: { request_id: rid } });
    return wantsHtml
      ? html(resultPage("Stripe refused the refund", "Approved, not processed", `You approved it, but Stripe said: ${esc(result.error)}. ${esc(ctx.request.requested_by_email)} has been emailed to process it manually in Stripe.`, true), 502)
      : json({ error: result.error, stripeFailure: true }, 502);
  }

  await supabase.from("lb_refund_requests").update({ status: "processed", processed_at: new Date().toISOString(), stripe_refund_id: result.refundId, refunded_amount: result.amount }).eq("id", rid);
  ctx.request = { ...ctx.request, status: "processed", stripe_refund_id: result.refundId };
  const summary = `${esc(decidedBy)} approved it and ${fmtMoney(result.amount)} has been sent back to ${esc(ctx.booking.guest_name)}'s card. The guest has been emailed. Stripe refund ${esc(result.refundId)}.`;
  const cc = Array.from(new Set([ctx.request.requested_by_email, ...approvers, ADMIN_EMAIL].filter(Boolean).map((e) => e.toLowerCase())));
  await sendMail(cc, `Refund processed — ${ctx.booking.guest_name} · ${fmtMoney(result.amount)}`, requesterDecidedHtml(ctx, true, summary));
  await logActivity({ eventId: ctx.booking.event_id, bookingId: ctx.booking.id, actor: "admin", actorName: decidedBy, action: "refund_processed", label: `Refund of ${fmtMoney(result.amount)} to ${ctx.booking.guest_name} approved by ${decidedBy} (requested by ${ctx.request.requested_by_email})`, metadata: { request_id: rid, stripe_refund_id: result.refundId } });

  return wantsHtml
    ? html(resultPage("Refund processed", "Approved", `${fmtMoney(result.amount)} is on its way back to ${esc(ctx.booking.guest_name)}. The guest and ${esc(ctx.request.requested_by_name || ctx.request.requested_by_email)} have been emailed.`))
    : json({ success: true, status: "processed", refundId: result.refundId, amount: result.amount });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const approvers = await approverEmails();

  if (req.method === "GET") {
    const u = new URL(req.url);
    const rid = u.searchParams.get("rid");
    const t = u.searchParams.get("t");
    const a = u.searchParams.get("a");
    if (!rid || !t || (a !== "approve" && a !== "decline")) {
      return html(resultPage("Nothing to see here", "Refund approvals", "Open this page from the approval email.", true), 400);
    }
    const ctx = await loadCtx(rid);
    if (!ctx) return html(resultPage("Not found", "Unknown request", "We couldn't find that refund request.", true), 404);
    if (!(await tokenValid(ctx, t))) return html(resultPage("Link expired", "Not authorized", "This approval link is invalid or has expired. Ask the requester to file the refund again.", true), 403);
    if (ctx.request.status !== "pending") {
      const s = ctx.request.status;
      return html(resultPage("Already handled", s, `This request is already ${s}${ctx.request.decided_by_email ? " by " + esc(ctx.request.decided_by_email) : ""}.`, s !== "processed"));
    }
    return html(confirmPage(ctx, t, a));
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  let body: Record<string, any> = {};
  let isForm = false;
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      isForm = true;
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) body[k] = typeof v === "string" ? v : "";
    } else {
      body = await req.json();
    }
  } catch {
    return json({ error: "Invalid body" }, 400);
  }

  switch (body.action) {
    case "request":
      return handleRequest(req, body, approvers);
    case "decide":
      return handleDecide(req, body, approvers, isForm);
    default:
      return json({ error: "Refunds require owner approval. File a request from the lodging app; only an approved request can be processed." }, 403);
  }
});
