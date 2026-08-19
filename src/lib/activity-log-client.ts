import { supabase } from "@/integrations/supabase/client";

export type ActivityActor = "admin" | "guest" | "system" | "stripe";

export type LogActivityInput = {
  eventId?: string | null;
  bookingId?: string | null;
  actor: ActivityActor;
  actorName?: string | null;
  action: string;
  label: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Insert a row into lb_activity_log from the browser under the signed-in
 * admin's session (RLS: "Admins insert activity"). Never throws — failures
 * are logged so callers can fire-and-forget without breaking their work.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const row = {
      event_id: input.eventId ?? null,
      booking_id: input.bookingId ?? null,
      actor: input.actor,
      actor_name: input.actorName ?? null,
      action: input.action,
      label: input.label,
      metadata: (input.metadata ?? null) as never,
    };
    const { error } = await supabase.from("lb_activity_log").insert(row as never);
    if (error) console.error("logActivity insert failed", error, input);
  } catch (err) {
    console.error("logActivity threw", err, input);
  }
}
