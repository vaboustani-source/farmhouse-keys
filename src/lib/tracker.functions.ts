import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Resend } from "resend";
import { supabase } from "@/integrations/supabase/client";
import { invitationEmail } from "@/lib/email-templates";

const tokenSchema = z.object({ token: z.string().uuid() });

export const getTrackerData = createServerFn({ method: "POST" })
  .inputValidator(tokenSchema.parse)
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabase.rpc("lookup_tracker_by_token", {
      p_token: data.token,
    });
    if (error) {
      console.error("lookup_tracker_by_token", error);
      return { event: null };
    }
    const row = (rows as Array<Record<string, unknown>> | null)?.[0];
    if (!row) return { event: null };
    return {
      event: {
        eventId: row.event_id as string,
        weddingName: row.wedding_name as string,
        coupleNames: row.couple_names as string,
        checkInDate: row.check_in_date as string | null,
        checkOutDate: row.check_out_date as string | null,
        sections: row.sections as Array<{
          id: string;
          section_name: string;
          sort_order: number;
          total_rooms: number;
        }>,
        bookings: row.bookings as Array<{
          id: string;
          section_id: string;
          guest_name: string;
          payment_status: string;
          booked_at: string | null;
          deposit_paid_at: string | null;
          final_paid_at: string | null;
          covered_at: string | null;
          reminder_sent_at: string | null;
          reminder_count: number;
        }>,
      },
    };
  });

export const sendNudge = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ token: z.string().uuid(), bookingId: z.string().uuid() }).parse,
  )
  .handler(async ({ data }) => {
    // Validate the token resolves to an event, and the booking belongs to it.
    const { data: ev } = await supabase
      .from("lb_events")
      .select("id, wedding_name, couple_names, check_in_date, slug")
      .eq("couple_access_token", data.token)
      .maybeSingle();
    if (!ev) return { ok: false, reason: "invalid_token" as const };

    const { data: booking } = await supabase
      .from("lb_bookings")
      .select(
        "id, event_id, section_id, guest_name, guest_email, payment_status, reminder_sent_at, reminder_count",
      )
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!booking || booking.event_id !== ev.id) {
      return { ok: false, reason: "invalid_booking" as const };
    }
    if (booking.payment_status !== "pending") {
      return { ok: false, reason: "already_confirmed" as const };
    }
    if ((booking.reminder_count ?? 0) >= 3) {
      return { ok: false, reason: "max_reached" as const };
    }
    if (booking.reminder_sent_at) {
      const ageMs = Date.now() - new Date(booking.reminder_sent_at).getTime();
      if (ageMs < 48 * 60 * 60 * 1000) {
        return { ok: false, reason: "cooldown" as const };
      }
    }

    const { data: section } = await supabase
      .from("lb_room_sections")
      .select("section_name, booking_link_slug, guest_nightly_rate, nights")
      .eq("id", booking.section_id)
      .single();
    if (!section) return { ok: false, reason: "invalid_section" as const };

    const baseUrl =
      process.env.APP_BASE_URL ||
      "https://stay.gilbertsvillefarmhouse.com";
    const bookingUrl = `${baseUrl}/book/${ev.slug ?? ev.id}/${section.booking_link_slug ?? booking.section_id}`;

    const firstName = (booking.guest_name || "").trim().split(/\s+/)[0] || "there";
    const fmtDate = (d: string | null) =>
      d
        ? new Date(d + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })
        : "";

    const tpl = invitationEmail({
      guestFirstName: firstName,
      coupleNames: ev.couple_names ?? "",
      weddingName: ev.wedding_name ?? "",
      sectionName: section.section_name,
      checkInDate: fmtDate(ev.check_in_date),
      checkOutDate: "",
      nights: section.nights ?? 2,
      guestNightlyRate: Number(section.guest_nightly_rate ?? 0),
      bookingUrl,
    });

    const key = process.env.RESEND_API_KEY;
    if (!key) return { ok: false, reason: "email_not_configured" as const };
    try {
      await new Resend(key).emails.send({
        from: "Gilbertsville Farmhouse <noreply@stay.gilbertsvillefarmhouse.com>",
        to: booking.guest_email,
        subject: tpl.subject,
        html: tpl.html,
      });
    } catch (err) {
      console.error("resend send error", err);
      return { ok: false, reason: "send_failed" as const };
    }

    const now = new Date().toISOString();
    await supabase
      .from("lb_bookings")
      .update({
        reminder_sent_at: now,
        reminder_count: (booking.reminder_count ?? 0) + 1,
      })
      .eq("id", booking.id);

    return { ok: true as const, reminderSentAt: now };
  });