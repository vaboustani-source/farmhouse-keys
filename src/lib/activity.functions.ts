import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activity-log-client";

/* The activity feed runs in the browser under the signed-in user's session.
   RLS does the authorization: admins read everything ("Admins read all
   activity"), event members read only their events' rows. The previous
   createServerFn + supabaseAdmin path hung forever on Lovable's published
   hosting, which never provides the service-role key. */

export type ActivityCategory = "all" | "bookings" | "payments" | "admin" | "system";
export type ActivityActorFilter = "all" | "admin" | "guest" | "system" | "stripe";

export type ListActivityInput = {
  eventId?: string;
  category?: ActivityCategory;
  actor?: ActivityActorFilter;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
};

function categoryActionPrefixes(cat: string): string[] {
  switch (cat) {
    case "bookings":
      return ["booking."];
    case "payments":
      return ["payment.", "refund.", "charge."];
    case "admin":
      return ["pricing.", "guest.", "event."];
    case "system":
      return ["email.", "system."];
    default:
      return [];
  }
}

export async function listActivity({ data }: { data: ListActivityInput }) {
  let q = supabase
    .from("lb_activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(data.limit ?? 200);

  if (data.eventId) q = q.eq("event_id", data.eventId);
  if (data.actor && data.actor !== "all") q = q.eq("actor", data.actor);
  if (data.from) q = q.gte("created_at", data.from);
  if (data.to) q = q.lte("created_at", data.to);
  if (data.cursor) q = q.lt("created_at", data.cursor);

  const prefixes = categoryActionPrefixes(data.category ?? "all");
  if (prefixes.length > 0) {
    // OR on multiple ilike patterns
    const orStr = prefixes.map((p) => `action.ilike.${p}%`).join(",");
    q = q.or(orStr);
  }

  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  return { rows: rows ?? [] };
}

export async function logAdminActivity({
  data,
}: {
  data: {
    eventId?: string | null;
    bookingId?: string | null;
    action: string;
    label: string;
    metadata?: Record<string, unknown> | null;
  };
}) {
  const { data: auth } = await supabase.auth.getUser();
  const actorName = auth.user?.email?.split("@")[0] ?? null;
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
}

export async function listEventsForFilter() {
  const { data, error } = await supabase
    .from("lb_events")
    .select("id, wedding_name, couple_names")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { events: data ?? [] };
}
