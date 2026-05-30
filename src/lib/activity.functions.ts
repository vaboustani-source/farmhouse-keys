import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logActivity } from "@/lib/activity-log.server";

const CategoryEnum = z.enum(["all", "bookings", "payments", "admin", "system"]);

const ListInput = z.object({
  eventId: z.string().uuid().optional(),
  category: CategoryEnum.default("all"),
  actor: z.enum(["all", "admin", "guest", "system", "stripe"]).default("all"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().min(1).max(500).default(200),
  cursor: z.string().datetime().optional(),
});

function categoryActionPrefixes(cat: string): string[] {
  switch (cat) {
    case "bookings": return ["booking."];
    case "payments": return ["payment.", "refund.", "charge."];
    case "admin": return ["pricing.", "guest.", "event."];
    case "system": return ["email.", "system."];
    default: return [];
  }
}

export const listActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ListInput.parse(data))
  .handler(async ({ data, context }) => {
    // Authorization: admins can read anything; non-admins need event_id and membership.
    const { userId } = context;
    const { data: u } = await supabaseAdmin
      .from("users")
      .select("role, email")
      .eq("id", userId)
      .maybeSingle();
    const isAdmin = u?.role === "admin";
    if (!isAdmin && !data.eventId) {
      throw new Error("Forbidden");
    }

    let q = supabaseAdmin
      .from("lb_activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.eventId) q = q.eq("event_id", data.eventId);
    if (data.actor !== "all") q = q.eq("actor", data.actor);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.cursor) q = q.lt("created_at", data.cursor);

    const prefixes = categoryActionPrefixes(data.category);
    if (prefixes.length > 0) {
      // OR on multiple ilike patterns
      const orStr = prefixes.map((p) => `action.ilike.${p}%`).join(",");
      q = q.or(orStr);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

const LogInput = z.object({
  eventId: z.string().uuid().nullable().optional(),
  bookingId: z.string().uuid().nullable().optional(),
  action: z.string().min(1).max(120),
  label: z.string().min(1).max(400),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const logAdminActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => LogInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: u } = await supabaseAdmin
      .from("users")
      .select("email, role")
      .eq("id", userId)
      .maybeSingle();
    const actorName = u?.email?.split("@")[0] ?? null;
    await logActivity({
      eventId: data.eventId ?? null,
      bookingId: data.bookingId ?? null,
      actor: "admin",
      actorName,
      action: data.action,
      label: data.label,
      metadata: data.metadata ?? null,
    });
    return { ok: true };
  });

export const listEventsForFilter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("lb_events")
      .select("id, wedding_name, couple_names")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { events: data ?? [] };
  });