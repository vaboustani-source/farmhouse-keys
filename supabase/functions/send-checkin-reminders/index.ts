// Daily check-in reminder: emails guests whose stay begins in 7 days.
// Also supports a manual trigger (POST body { event_id }) that bypasses the
// date filter for testing — used by the admin "Send check-in reminders now"
// button. Auth: Bearer SUPABASE_ANON_KEY (same pattern as collect-balance-payments).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Resend } from "https://esm.sh/resend@4.0.1";
import { checkInReminderEmail } from "../../../src/lib/email-templates.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_EMAIL =
  Deno.env.get("BRANDON_NOTIFICATION_EMAIL") ?? Deno.env.get("ADMIN_EMAIL") ?? "";
const FROM = "Gilbertsville Farmhouse <noreply@gilbertsvillefarmhouse.com>";

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