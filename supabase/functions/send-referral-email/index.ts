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

function shell(inner: string): string {
  return `<div style="background:#F4F0E8;padding:32px 12px;">
  <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0"
    style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E8E2D9;">
    <tr><td style="padding:36px 36px 32px;font-family:'Jost',Helvetica,Arial,sans-serif;color:#1A1A1A;">
      <p style="margin:0 0 24px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;">Gilbertsville Farmhouse</p>
      ${inner}
      <p style="margin:28px 0 0;font-size:12px;line-height:1.7;color:#9A9188;font-weight:300;">
        Questions? Write to events@gilbertsvillefarmhouse.com.</p>
    </td></tr>
  </table></div>`;
}
const h1 = (t: string) =>
  `<h1 style="margin:0 0 16px;font-family:'Cormorant Garamond',Georgia,serif;font-weight:400;font-size:28px;line-height:1.25;color:#1A1A1A;">${t}</h1>`;
const p = (t: string) =>
  `<p style="margin:0 0 16px;font-size:14px;line-height:1.75;color:#3A352F;font-weight:300;">${t}</p>`;
const codeBox = (code: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;background:#FAF8F4;border:1px solid #E8E2D9;border-left:3px solid #C9A84C;">
    <tr><td style="padding:20px 24px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;">Your invitation code</p>
      <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;letter-spacing:2px;color:#1A1A1A;">${code}</p>
    </td></tr></table>`;

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
  const code = esc(b.referral_code);
  const link = `${SITE}/stay/${ev.slug}?ref=${encodeURIComponent(b.referral_code)}`;
  const hasBalance = b.payment_status === "deposit_paid" && !b.final_paid_at;
  const resend = new Resend(Deno.env.get("RESEND_API_KEY") ?? "");

  if (kind === "code") {
    if (b.referral_code_emailed_at && !body.force) return json({ skipped: "already_sent" });
    const html = shell(
      h1(`Bring another couple to ${weekend}`) +
        p(`Hi ${esc(firstName(b.guest_name))},`) +
        p(`Your reservation is set. If there is a couple you would like at the next fire over, this code is yours to share.`) +
        codeBox(code) +
        p(
          hasBalance && reward > 0
            ? `For every couple who reserves the weekend with it, ${money(reward)} comes off the remaining balance of your stay${friendPct > 0 ? `, and they receive ${friendPct}% off their own weekend` : ""}. It is applied automatically before your balance is charged${ev.balance_due_on ? ` on ${longDate(ev.balance_due_on)}` : ""}.`
            : friendPct > 0
              ? `Any couple who reserves with it receives ${friendPct}% off their weekend.`
              : `They enter it as they reserve, so we know you are coming together.`,
        ) +
        p(`They can enter the code as they book, or simply use your link:<br><a href="${link}" style="color:#1A1A1A;">${link.replace("https://", "")}</a>`),
    );
    await resend.emails.send({
      from: FROM,
      to: b.guest_email,
      subject: `Your invitation code for ${ev.wedding_name ?? "the weekend"}`,
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
    h1(`${friend} will be joining you`) +
      p(`Hi ${esc(firstName(b.guest_name))},`) +
      p(`${friend} reserved ${weekend} with your invitation code. As a thank-you, ${money(Number(body.amount) > 0 ? Number(body.amount) : reward)} has come off the remaining balance of your stay.`) +
      p(`Invitation credit so far: <strong>${money(credit)}</strong><br>Remaining balance: <strong>${money(newBalance)}</strong> plus tax${ev.balance_due_on ? `, charged automatically on ${longDate(ev.balance_due_on)}` : ""}.`) +
      p(`There is nothing you need to do.`),
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
