import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Resend } from "resend";
import { supabase } from "@/integrations/supabase/client";
import { invitationEmail } from "@/lib/email-templates";

const fmtDate = (d: string | null) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

async function sendOne(bookingId: string) {
  const { data: booking, error: bErr } = await supabase
    .from("lb_bookings")
    .select(
      "id, event_id, section_id, guest_name, guest_email, payment_status, invitation_count",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (bErr || !booking) return { ok: false as const, reason: "invalid_booking" };

  const [{ data: ev }, { data: section }] = await Promise.all([
    supabase
      .from("lb_events")
      .select("id, wedding_name, couple_names, check_in_date, check_out_date, slug")
      .eq("id", booking.event_id)
      .maybeSingle(),
    supabase
      .from("lb_room_sections")
      .select("section_name, booking_link_slug, guest_nightly_rate, nights")
      .eq("id", booking.section_id)
      .maybeSingle(),
  ]);
  if (!ev || !section) return { ok: false as const, reason: "invalid_event_or_section" };

  const baseUrl =
    process.env.APP_BASE_URL || "https://stay.gilbertsvillefarmhouse.com";
  const bookingUrl = `${baseUrl}/book/${ev.slug ?? ev.id}/${section.booking_link_slug ?? booking.section_id}`;

  const firstName =
    (booking.guest_name || "").trim().split(/\s+/)[0] || "there";

  const tpl = invitationEmail({
    guestFirstName: firstName,
    coupleNames: ev.couple_names ?? "",
    weddingName: ev.wedding_name ?? "",
    sectionName: section.section_name,
    checkInDate: fmtDate(ev.check_in_date),
    checkOutDate: fmtDate(ev.check_out_date),
    nights: section.nights ?? 2,
    guestNightlyRate: Number(section.guest_nightly_rate ?? 0),
    bookingUrl,
  });

  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false as const, reason: "email_not_configured" };
  try {
    await new Resend(key).emails.send({
      from: "Gilbertsville Farmhouse <noreply@stay.gilbertsvillefarmhouse.com>",
      to: booking.guest_email,
      subject: tpl.subject,
      html: tpl.html,
    });
  } catch (err) {
    console.error("invitation send failed", err);
    return { ok: false as const, reason: "send_failed" };
  }

  const now = new Date().toISOString();
  await supabase
    .from("lb_bookings")
    .update({
      invitation_sent_at: now,
      invitation_count: (booking.invitation_count ?? 0) + 1,
    })
    .eq("id", booking.id);

  return { ok: true as const, sentAt: now };
}

export const sendBookingInvitation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ bookingId: z.string().uuid() }).parse)
  .handler(async ({ data }) => sendOne(data.bookingId));

export const sendSectionPendingInvitations = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      eventId: z.string().uuid(),
      sectionId: z.string().uuid(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: rows } = await supabase
      .from("lb_bookings")
      .select("id")
      .eq("event_id", data.eventId)
      .eq("section_id", data.sectionId)
      .eq("payment_status", "pending")
      .is("invitation_sent_at", null)
      .neq("removed", true);
    let sent = 0;
    let failed = 0;
    for (const row of rows ?? []) {
      const res = await sendOne(row.id);
      if (res.ok) sent++;
      else failed++;
    }
    return { sent, failed, total: rows?.length ?? 0 };
  });