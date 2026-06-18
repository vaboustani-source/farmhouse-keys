// Daily check-in reminder: emails guests whose stay begins in 7 days.
// Also supports a manual trigger (POST body { event_id }) that bypasses the
// date filter for testing — used by the admin "Send check-in reminders now"
// button. Auth: Bearer SUPABASE_ANON_KEY (same pattern as collect-balance-payments).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Resend } from "https://esm.sh/resend@4.0.1";

// Inlined check-in reminder email (mirror of src/lib/email-templates.ts
// checkInReminderEmail — Supabase Edge Functions only bundle the function
// directory, so we cannot import from src/).
function checkInReminderEmail(p: {
  guestFirstName: string;
  weddingName: string;
  sectionName: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  checkInTime?: string;
  checkOutTime?: string;
  propertyAddress?: string;
  cotRequested?: boolean;
}): { subject: string; html: string } {
  const subject = "Your stay at Gilbertsville Farmhouse is in one week";
  const checkInTime = p.checkInTime || "3:00 PM";
  const checkOutTime = p.checkOutTime || "11:00 AM";
  const propertyAddress =
    p.propertyAddress || "424 County Highway 18, South New Berlin, NY 13843";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(propertyAddress)}`;
  const cotRow = p.cotRequested
    ? `<tr>
         <td style="padding:10px 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;width:40%;vertical-align:top;">Cot</td>
         <td style="padding:10px 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:14px;color:#1A1A1A;vertical-align:top;">A cot will be ready in your room</td>
       </tr>`
    : "";

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;width:40%;vertical-align:top;">${label}</td>
      <td style="padding:10px 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:14px;color:#1A1A1A;vertical-align:top;">${value}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Gilbertsville Farmhouse</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@300;400;500&display=swap');body{margin:0;padding:0;background-color:#F5F0EB;}a{color:#2C3E2D;}</style>
</head>
<body style="margin:0;padding:0;background-color:#F5F0EB;font-family:'Jost',Helvetica,Arial,sans-serif;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F0EB;">
<tr><td align="center" style="padding:40px 16px 24px;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;">
  <tr><td align="center" style="padding-bottom:32px;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#2C3E2D;border-radius:4px 4px 0 0;">
      <tr><td align="center" style="padding:36px 40px 28px;">
        <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#C9A84C;">GILBERTSVILLE FARMHOUSE</p>
        <table role="presentation" align="center" width="40" style="border-top:1px solid #C9A84C;margin-top:14px;"><tr><td>&nbsp;</td></tr></table>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="background-color:#FFFFFF;border-radius:0 0 4px 4px;padding:48px 48px 40px;border:1px solid #E8E2D9;border-top:none;">
    <span style="display:inline-block;padding:4px 12px;background-color:#2C3E2D;border-radius:2px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;font-weight:500;">See you soon</span>
    <div style="margin-top:24px;">
      <h1 style="margin:0 0 8px;font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;font-weight:400;color:#1A1A1A;line-height:1.2;">Your weekend is almost here.</h1>
      <p style="margin:0 0 32px;font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;color:#6B6B6B;font-style:italic;">${p.weddingName}</p>
    </div>
    <p style="margin:0 0 20px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3A3A3A;font-weight:300;">${p.guestFirstName}, your stay at the estate is just one week away. Here are the details for your arrival.</p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0;"><tr><td style="border-top:1px solid #E8E2D9;font-size:0;line-height:0;">&nbsp;</td></tr></table>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;">
      ${row("Arrival", `${p.checkInDate} after ${checkInTime}`)}
      ${row("Departure", `${p.checkOutDate} by ${checkOutTime}`)}
      ${row("Lodging", p.sectionName)}
      ${row("Address", `<a href="${mapsUrl}" target="_blank" style="color:#2C3E2D;text-decoration:underline;">${propertyAddress}</a>`)}
      ${cotRow}
    </table>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0;"><tr><td style="border-top:1px solid #C9A84C;font-size:0;line-height:0;opacity:0.4;">&nbsp;</td></tr></table>
    <p style="margin:0 0 20px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#3A3A3A;font-weight:300;">We'll have everything ready for your arrival. If you have any questions before you get here, reach out to your planning team.</p>
  </td></tr>
  <tr><td align="center" style="padding:32px 40px 48px;">
    <p style="margin:0 0 8px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:11px;color:#9A9188;letter-spacing:1px;text-transform:uppercase;">South New Berlin, NY · Otsego County</p>
    <p style="margin:0;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:11px;color:#B8AFA6;"><a href="https://gilbertsvillefarmhouse.com" style="color:#9A9188;text-decoration:none;">gilbertsvillefarmhouse.com</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { subject, html };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_EMAIL =
  Deno.env.get("BRANDON_NOTIFICATION_EMAIL") ?? Deno.env.get("ADMIN_EMAIL") ?? "";
const FROM = "Gilbertsville Farmhouse <noreply@stay.gilbertsvillefarmhouse.com>";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
const addDays = (n: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const firstName = (full: string) =>
  (full || "").trim().split(/\s+/)[0] || "there";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const auth = req.headers.get("authorization") ?? "";
  if (!SUPABASE_ANON_KEY || auth !== `Bearer ${SUPABASE_ANON_KEY}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let manualEventId: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.event_id === "string") manualEventId = body.event_id;
  } catch (_) {
    // empty body — scheduled run
  }

  // Resolve target events
  let eventsQuery = supabase
    .from("lb_events")
    .select("id, wedding_name, check_in_date, check_out_date, nights, check_in_time, check_out_time");

  if (manualEventId) {
    eventsQuery = eventsQuery.eq("id", manualEventId);
  } else {
    eventsQuery = eventsQuery.eq("check_in_date", addDays(7));
  }

  const { data: events, error: evErr } = await eventsQuery;
  if (evErr) {
    console.error("event query failed", evErr);
    return new Response(JSON.stringify({ error: evErr.message }), { status: 500 });
  }

  const eventList = events ?? [];
  if (eventList.length === 0) {
    return new Response(JSON.stringify({ sent: 0, events: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  let totalSent = 0;

  for (const ev of eventList) {
    const { data: bookings, error: bkErr } = await supabase
      .from("lb_bookings")
      .select(
        "id, guest_email, guest_name, cot_requested, section_id, checkin_reminder_sent, removed, payment_status",
      )
      .eq("event_id", ev.id)
      .in("payment_status", ["paid", "deposit_paid", "covered"])
      .or("removed.is.null,removed.eq.false")
      .or("checkin_reminder_sent.is.null,checkin_reminder_sent.eq.false");

    if (bkErr) {
      console.error("booking query failed for event", ev.id, bkErr);
      continue;
    }

    const rows = bookings ?? [];
    if (rows.length === 0) continue;

    // Fetch sections for these bookings
    const sectionIds = Array.from(new Set(rows.map((r) => r.section_id).filter(Boolean)));
    const { data: sections } = await supabase
      .from("lb_room_sections")
      .select("id, section_name")
      .in("id", sectionIds);
    const sectionMap = new Map((sections ?? []).map((s) => [s.id, s.section_name as string]));

    const summaryRows: Array<{ name: string; email: string; section: string }> = [];

    for (const b of rows) {
      const sectionName = sectionMap.get(b.section_id) ?? "Your room";
      const checkIn = ev.check_in_date as string;
      const checkOut = ev.check_out_date as string;
      if (!checkIn || !checkOut) continue;

      const { subject, html } = checkInReminderEmail({
        guestFirstName: firstName(b.guest_name as string),
        weddingName: ev.wedding_name as string,
        sectionName,
        checkInDate: fmtDate(checkIn),
        checkOutDate: fmtDate(checkOut),
        nights: (ev.nights as number) ?? 2,
        checkInTime: (ev.check_in_time as string) || "3:00 PM",
        checkOutTime: (ev.check_out_time as string) || "11:00 AM",
        cotRequested: !!b.cot_requested,
      });

      try {
        await resend.emails.send({ from: FROM, to: b.guest_email as string, subject, html });
        await supabase
          .from("lb_bookings")
          .update({
            checkin_reminder_sent: true,
            checkin_reminder_sent_at: new Date().toISOString(),
          })
          .eq("id", b.id);
        await supabase.from("lb_sync_log").insert({
          action: "checkin_reminder_sent",
          direction: "outbound",
          lb_booking_id: b.id,
          event_id: ev.id,
          guest_email: b.guest_email,
          reason: manualEventId ? "manual trigger" : "scheduled 7-day reminder",
        });
        summaryRows.push({
          name: b.guest_name as string,
          email: b.guest_email as string,
          section: sectionName,
        });
        totalSent++;
      } catch (err) {
        console.error("send failed", b.id, err);
      }
    }

    // Admin summary (one per event)
    if (summaryRows.length > 0 && ADMIN_EMAIL) {
      const listHtml = summaryRows
        .map(
          (r) =>
            `<li><strong>${r.name}</strong> (${r.email}) — ${r.section}</li>`,
        )
        .join("");
      try {
        await resend.emails.send({
          from: FROM,
          to: ADMIN_EMAIL,
          subject: `Check-in reminders sent — ${ev.wedding_name}`,
          html: `
            <p>Sent check-in reminder emails for <strong>${ev.wedding_name}</strong>
            (check-in ${fmtDate(ev.check_in_date as string)}):</p>
            <ul>${listHtml}</ul>
            <p>${summaryRows.length} guest${summaryRows.length === 1 ? "" : "s"} notified.</p>
          `,
        });
      } catch (err) {
        console.error("admin summary failed", ev.id, err);
      }
    }
  }

  return new Response(JSON.stringify({ sent: totalSent, events: eventList.length }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});