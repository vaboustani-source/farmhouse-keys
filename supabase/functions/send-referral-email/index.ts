// Referral program emails for pop-up weekends. Fired by the database (pg_net)
// from trg_lb_bookings_referral_notify — never by the browser:
//   kind "code"   → a couple's first payment landed; send them their personal code.
//   kind "credit" → a friend booked with their code; tell them what came off the balance
//                   (a flat amount per invited couple, sent every time the credit grows).
// Deliberately separate from stripe-webhook so the payment path is untouched.
// Auth: x-referral-secret must match lb_private_config.referral_email_secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);
const FROM = "Gilbertsville Farmhouse <noreply@stay.gilbertsvillefarmhouse.com>";
const SITE = "https://stay.gilbertsvillefarmhouse.com";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 === 0 ? 0 : 2 });
const firstName = (full: string) => (full || "").trim().split(/\s+/)[0] || "there";
const longDate = (d: string | null) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "";
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

// Branding mirrors the reservation page (stay.gilbertsvillefarmhouse.com):
// oxblood ground, raised card, cream type, gold labels, blush call to action.
const SANS = "'Jost',Helvetica,Arial,sans-serif";
const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";

function shell(inner: string): string {
  return `<div style="margin:0;padding:0;background:#1E1313;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1E1313" style="background:#1E1313;">
    <tr><td align="center" style="padding:56px 16px 60px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td align="center" style="padding:0 0 40px;">
          <img src="${SITE}/gf-wordmark-white.png" width="260" alt="Gilbertsville Farmhouse"
            style="display:block;width:260px;max-width:70%;height:auto;border:0;">
          <p style="margin:12px 0 0;font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#B8AFA6;">A private estate</p>
        </td></tr>
        <tr><td bgcolor="#2A1C1C" style="background:#2A1C1C;border:1px solid #4A3737;border-radius:4px;padding:52px 40px 48px;font-family:${SANS};color:#F6F1E8;">
          ${inner}
        </td></tr>
        <tr><td align="center" style="padding:36px 8px 0;font-family:${SANS};font-size:12px;line-height:1.7;color:#B8AFA6;">
          Questions? Write to <a href="mailto:events@gilbertsvillefarmhouse.com" style="color:#B8AFA6;">events@gilbertsvillefarmhouse.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table></div>`;
}
const label = (t: string) =>
  `<p style="margin:0 0 18px;font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#B8956A;">${t}</p>`;
const h1 = (t: string) =>
  `<h1 style="margin:0 0 32px;font-family:${SERIF};font-weight:500;font-size:32px;line-height:1.25;color:#F6F1E8;">${t}</h1>`;
const p = (t: string) =>
  `<p style="margin:0 0 26px;font-family:${SANS};font-size:15px;line-height:1.9;color:#E8E0D4;font-weight:300;">${t}</p>`;
const codeBox = (code: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 40px;">
    <tr><td align="center" bgcolor="#1E1313" style="background:#1E1313;border:1px solid #B8956A;border-radius:4px;padding:34px 16px;">
      <p style="margin:0 0 12px;font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#B8956A;">Your referral code</p>
      <p style="margin:0;font-family:${SERIF};font-size:30px;letter-spacing:3px;color:#F6F1E8;">${code}</p>
    </td></tr></table>`;
const button = (href: string, text: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:14px auto 28px;">
    <tr><td align="center" bgcolor="#F09B9C" style="background:#F09B9C;border-radius:4px;">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#1E1313;text-decoration:none;">${text}</a>
    </td></tr></table>`;
const fine = (t: string) =>
  `<p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.7;color:#B8AFA6;font-weight:300;text-align:center;">${t}</p>`;
const figures = (rows: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 34px;border-top:1px solid #4A3737;">
    ${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:18px 0;border-bottom:1px solid #4A3737;font-family:${SANS};font-size:13px;color:#B8AFA6;">${k}</td>
           <td align="right" style="padding:18px 0;border-bottom:1px solid #4A3737;font-family:${SERIF};font-size:20px;color:#F6F1E8;">${v}</td></tr>`,
      )
      .join("")}
  </table>`;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const { data: cfg } = await supabase
    .from("lb_private_config")
    .select("value")
    .eq("key", "referral_email_secret")
    .maybeSingle();
  const secret = (cfg as { value?: string } | null)?.value ?? "";
  if (!secret || req.headers.get("x-referral-secret") !== secret) return json({ error: "unauthorized" }, 401);

  let body: { booking_id?: string; kind?: string; force?: boolean; amount?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const kind = body.kind === "credit" ? "credit" : "code";
  if (!body.booking_id) return json({ error: "booking_id_required" }, 400);

  const { data: b } = await supabase
    .from("lb_bookings")
    .select(
      "id, event_id, guest_name, guest_email, payment_status, total_amount, final_paid_at, removed, referral_code, referral_credit_amount, referral_credit_percent, referral_credit_from_booking_id, referral_code_emailed_at, referral_credit_emailed_at",
    )
    .eq("id", body.booking_id)
    .maybeSingle();
  if (!b || b.removed === true || !b.referral_code || !b.guest_email) return json({ skipped: "no_booking_or_code" });
  if (!["paid", "deposit_paid"].includes(b.payment_status)) return json({ skipped: "not_paid" });

  const { data: ev } = await supabase
    .from("lb_events")
    .select("slug, wedding_name, event_type, referral_reward_amount, referral_friend_percent, balance_due_on")
    .eq("id", b.event_id)
    .maybeSingle();
  const reward = Number(ev?.referral_reward_amount) || 0;
  const friendPct = Number(ev?.referral_friend_percent) || 0;
  if (!ev || ev.event_type !== "popup" || (reward <= 0 && friendPct <= 0)) return json({ skipped: "program_off" });

  const weekend = esc(ev.wedding_name ?? "the weekend");
  // "The Couples Weekend" -> "the couples weekend", for use mid-sentence.
  const weekendLower = esc(`the ${(ev.wedding_name ?? "weekend").replace(/^the\s+/i, "").toLowerCase()}`);
  const code = esc(b.referral_code);
  const link = `${SITE}/stay/${ev.slug}?ref=${encodeURIComponent(b.referral_code)}`;
  const hasBalance = b.payment_status === "deposit_paid" && !b.final_paid_at;
  const resend = new Resend(Deno.env.get("RESEND_API_KEY") ?? "");

  if (kind === "code") {
    if (b.referral_code_emailed_at && !body.force) return json({ skipped: "already_sent" });
    const html = shell(
      label(weekend) +
        h1(`Bring another couple along`) +
        p(`Hi ${esc(firstName(b.guest_name))},`) +
        p(`Your reservation is set. We are so excited to have you join us for ${weekendLower}. If there is a couple you would like to share the experience with, use the code below.`) +
        codeBox(code) +
        p(
          hasBalance && reward > 0
            ? `<strong style="font-weight:600;color:#F6F1E8;">For every couple who reserves a room with your referral code, you receive ${money(reward)} off the remaining balance of your stay${friendPct > 0 ? `, and they receive ${friendPct}% off their own weekend` : ""}.</strong>`
            : friendPct > 0
              ? `Every couple who reserves a room with your referral code receives ${friendPct}% off their own weekend.`
              : `They enter it as they reserve, so we know you are coming together.`,
        ) +
        (hasBalance && reward > 0
          ? p(`<em>It is applied automatically before your balance is charged${ev.balance_due_on ? ` on ${longDate(ev.balance_due_on)}` : ""}.</em>`)
          : "") +
        button(link, "Your referral link") +
        fine(`They can also enter the code as they reserve at<br><a href="${link}" style="color:#F09B9C;">${link.replace("https://", "")}</a>`),
    );
    await resend.emails.send({
      from: FROM,
      to: b.guest_email,
      subject: `Your referral code for ${ev.wedding_name ?? "the weekend"}`,
      html,
    });
    await supabase.from("lb_bookings").update({ referral_code_emailed_at: new Date().toISOString() }).eq("id", b.id);
    return json({ sent: "code" });
  }

  // kind === "credit"
  const credit = Number(b.referral_credit_amount) || 0;
  if (credit <= 0) return json({ skipped: "no_credit" });
  if (b.referral_credit_emailed_at && !body.force) return json({ skipped: "already_sent" });
  let friend = "A couple you invited";
  if (b.referral_credit_from_booking_id) {
    const { data: f } = await supabase
      .from("lb_bookings")
      .select("guest_name")
      .eq("id", b.referral_credit_from_booking_id)
      .maybeSingle();
    if (f?.guest_name) friend = esc(f.guest_name);
  }
  const newBalance = Math.max(0, (Number(b.total_amount) || 0) / 2 - credit);
  const html = shell(
    label(weekend) +
      h1(`${friend} will be joining you`) +
      p(`Hi ${esc(firstName(b.guest_name))},`) +
      p(`${friend} reserved ${weekend} with your referral code. As a thank-you, ${money(Number(body.amount) > 0 ? Number(body.amount) : reward)} has come off the remaining balance of your stay.`) +
      figures([
        ["Referral credit so far", money(credit)],
        ["Remaining balance, before tax", money(newBalance)],
      ]) +
      p(`${ev.balance_due_on ? `Your balance is charged automatically on ${longDate(ev.balance_due_on)}. ` : ""}There is nothing you need to do.`),
  );
  await resend.emails.send({
    from: FROM,
    to: b.guest_email,
    subject: `${friend.replace(/&amp;/g, "&")} booked with your code`,
    html,
  });
  await supabase.from("lb_bookings").update({ referral_credit_emailed_at: new Date().toISOString() }).eq("id", b.id);
  return json({ sent: "credit" });
});
