import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/* ───────────── Email gate lookup ───────────── */

export const lookupBooking = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email().max(255),
      eventSlug: z.string().min(1).max(120),
      sectionSlug: z.string().min(1).max(120),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc("lookup_guest_booking", {
      p_email: data.email,
      p_event_slug: data.eventSlug,
      p_section_slug: data.sectionSlug,
    });
    if (error) {
      console.error("lookup_guest_booking error", error);
      return { booking: null };
    }
    const row = rows?.[0] ?? null;
    return { booking: row };
  });

export const lookupSecondaryGuest = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email().max(255),
      eventSlug: z.string().min(1).max(120),
      excludeBookingId: z.string().uuid(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc("lookup_secondary_guest", {
      p_email: data.email,
      p_event_slug: data.eventSlug,
    });
    if (error) {
      console.error("lookup_secondary_guest error", error);
      return { booking: null };
    }
    const row = rows?.[0] ?? null;
    if (row && row.booking_id === data.excludeBookingId) return { booking: null, sameAsPrimary: true };
    return { booking: row };
  });

/* ───────────── Add-ons fetch ───────────── */

export const getSectionAddons = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sectionId: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("lb_section_addons")
      .select("id, addon_name, addon_price, addon_type, is_required, sort_order")
      .eq("section_id", data.sectionId)
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    return { addons: rows ?? [] };
  });

/* createCheckoutSession moved to client helper at src/lib/checkout.ts —
   it now invokes the `create-checkout-session` Supabase Edge Function so
   STRIPE_SECRET_KEY stays out of the browser bundle. */

export const fetchSessionConfirmation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string().min(1).max(200) }).parse)
  .handler(async ({ data }) => {
    const { data: bookings, error } = await supabaseAdmin
      .from("lb_bookings")
      .select(
        "id, guest_name, guest_email, payment_status, payment_schedule, total_amount, addons_selected, deposit_paid_at, final_paid_at, covered_at, covered_by_booking_id, is_primary, section_id, event_id",
      )
      .eq("stripe_session_id", data.sessionId);
    if (error) throw error;
    if (!bookings || bookings.length === 0) return { bookings: [] };

    const sectionIds = [...new Set(bookings.map((b) => b.section_id))];
    const eventIds = [...new Set(bookings.map((b) => b.event_id))];
    const [sections, events] = await Promise.all([
      supabaseAdmin.from("lb_room_sections").select("id, section_name, nights").in("id", sectionIds),
      supabaseAdmin.from("lb_events").select("id, wedding_name, check_in_date, check_out_date").in("id", eventIds),
    ]);

    return {
      bookings: bookings.map((b) => ({
        ...b,
        section: sections.data?.find((s) => s.id === b.section_id) ?? null,
        event: events.data?.find((e) => e.id === b.event_id) ?? null,
      })),
    };
  });