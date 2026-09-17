// "You started reserving and stopped" email for pop-up weekends. Sent by hand
// (SQL net.http_post), never automatically. Same branding as send-referral-email.
//   { booking_id, test_to? }  test_to sends the real rendering to that address
//   and records nothing; without it the guest is emailed once (checkout_reminder_sent_at).
// Auth: x-referral-secret must match lb_private_config.referral_email_secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);
const FROM = "Gilbertsville Farmhouse <noreply@stay.gilbertsvillefarmhouse.com>";
const SITE = "https://stay.gilbertsvillefarmhouse.com";
const SANS = "'Jost',Helvetica,Arial,sans-serif";
const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 === 0 ? 0 : 2 });
const firstName = (full: string) => (full || "").trim().split(/\s+/)[0] || "there";
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const monthDay = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });
const dateRange = (a: string | null, b: string | null) => {
  if (!a || !b) return "";
  const [m1, d1] = monthDay(a).split(" ");
  const [m2, d2] = monthDay(b).split(" ");
  return m1 === m2 ? `${m1} ${d1}–${d2}` : `${m1} ${d1} – ${m2} ${d2}`;
};

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
const button = (href: string, text: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:14px auto 16px;">
    <tr><td align="center" bgcolor="#F09B9C" style="background:#F09B9C;border-radius:4px;">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#1E1313;text-decoration:none;">${text}</a>
    </td></tr></table>`;
const fine = (t: string) =>
  `<p style="margin:0 0 34px;font-family:${SANS};font-size:12px;line-height:1.7;color:#B8AFA6;font-weight:300;text-align:center;">${t}</p>`;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const { data: cfg } = await supabase
    .from("lb_private_config")
    .select("value")
    .eq("key", "referral_email_secret")
    .maybeSingle();
  const secret = (cfg as { value?: string } | null)?.value ?? "";
  if (!secret || req.headers.get("x-referral-secret") !== secret) return json({ error: "unauthorized" }, 401);

  let body: { booking_id?: string; test_to?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  if (!body.booking_id) return json({ error: "booking_id_required" }, 400);
  const testTo = (body.test_to ?? "").trim();

  const { data: b } = await supabase
    .from("lb_bookings")
    .select("id, event_id, section_id, guest_name, guest_email, payment_status, removed, checkout_reminder_sent_at")
    .eq("id", body.booking_id)
    .maybeSingle();
  if (!b || b.removed === true || !b.guest_email) return json({ skipped: "no_booking" });
  if (b.payment_status !== "pending") return json({ skipped: "not_pending" });
  if (!testTo && b.checkout_reminder_sent_at) return json({ skipped: "already_sent" });

  // Never chase someone who has since reserved under the same email.
  const { data: paid } = await supabase
    .from("lb_bookings")
    .select("id")
    .eq("event_id", b.event_id)
    .ilike("guest_email", b.guest_email)
    .in("payment_status", ["paid", "deposit_paid", "covered"])
    .limit(1);
  if (!testTo && paid && paid.length > 0) return json({ skipped: "already_reserved" });

  const [{ data: ev }, { data: section }, { data: wl }] = await Promise.all([
    supabase
      .from("lb_events")
      .select(
        "slug, wedding_name, event_type, status, check_in_date, check_out_date, balance_due_on, group_offer_percent, group_offer_rooms, referral_reward_amount, referral_friend_percent",
      )
      .eq("id", b.event_id)
      .maybeSingle(),
    supabase.from("lb_room_sections").select("section_name").eq("id", b.section_id).maybeSingle(),
    supabase.from("lb_waitlist_members").select("id").eq("event_id", b.event_id).ilike("email", b.guest_email).limit(1),
  ]);
  if (!ev || ev.event_type !== "popup" || ev.status !== "active") return json({ skipped: "event_not_open" });

  const onWaitlist = !!wl && wl.length > 0;
  const weekend = esc(ev.wedding_name ?? "the weekend");
  const tier = esc(section?.section_name ?? "your weekend");
  const dates = dateRange(ev.check_in_date, ev.check_out_date);
  const groupPct = Number(ev.group_offer_percent) || 0;
  const rooms = Number(ev.group_offer_rooms) || 2;
  const reward = Number(ev.referral_reward_amount) || 0;
  const friendPct = Number(ev.referral_friend_percent) || 0;
  const href = `${SITE}/stay/${ev.slug}?utm_source=email&utm_medium=email&utm_campaign=cw-finish-reservation`;
  const shown = `${SITE.replace("https://", "")}/stay/${ev.slug}`;
  const splitOpen = !!ev.balance_due_on && new Date().toISOString().slice(0, 10) <= ev.balance_due_on;

  const html = shell(
    label(`${weekend}${dates ? ` · ${dates}` : ""}`) +
      h1(`Your weekend is still here`) +
      p(`Hi ${esc(firstName(b.guest_name))},`) +
      p(`You began reserving ${tier} for ${weekend}${dates ? `, ${dates}` : ""}, and stopped just before the last step.`) +
      p(`Two nights in a private guesthouse on 125 acres. A candlelit dinner the first night. Bonfires both nights, and a Saturday with nothing to plan and everything to enjoy.`) +
      (onWaitlist
        ? p(`Your private rate is still tied to this email address. Reserve with it and it applies on its own.`)
        : groupPct > 0
          ? p(`If you come with another couple, reserve ${rooms === 2 ? "two" : rooms} guesthouses together and both stays are ${groupPct}% off.`)
          : "") +
      (reward > 0
        ? p(`Reserve now and you will receive a referral code of your own. <strong style="font-weight:600;color:#F6F1E8;">For every couple who books ${weekend} with it, you receive ${money(reward)} off the remaining balance of your stay${friendPct > 0 ? `, and they receive ${friendPct}% off theirs` : ""}.</strong>`)
        : "") +
      (splitOpen ? p(`You can pay half now and half on ${monthDay(ev.balance_due_on as string)}.`) : "") +
      button(href, "Finish your reservation") +
      fine(`<a href="${href}" style="color:#F09B9C;">${shown}</a>`) +
      p(`If something got in the way the first time, tell us and we will take care of it.`) +
      `<p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.9;color:#E8E0D4;font-weight:300;">Warmly,<br>Gilbertsville Farmhouse</p>`,
  );

  const resend = new Resend(Deno.env.get("RESEND_API_KEY") ?? "");
  await resend.emails.send({
    from: FROM,
    to: testTo || b.guest_email,
    subject: friendPct > 0 || groupPct > 0 ? `Bring friends and get ${groupPct || friendPct}% off` : `Your weekend is still here`,
    html,
  });
  if (!testTo) {
    await supabase.from("lb_bookings").update({ checkout_reminder_sent_at: new Date().toISOString() }).eq("id", b.id);
  }
  return json({ sent: testTo ? "test" : "guest", version: onWaitlist ? "waitlist" : "everyone_else" });
});
