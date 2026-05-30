// Shared helper for Supabase Edge Functions to write to lb_activity_log.
// Uses the service-role key via the Supabase REST API.

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

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      console.error("logActivity: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
      return;
    }
    const res = await fetch(`${url}/rest/v1/lb_activity_log`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "apikey": key,
        "authorization": `Bearer ${key}`,
        "prefer": "return=minimal",
      },
      body: JSON.stringify({
        event_id: input.eventId ?? null,
        booking_id: input.bookingId ?? null,
        actor: input.actor,
        actor_name: input.actorName ?? null,
        action: input.action,
        label: input.label,
        metadata: input.metadata ?? null,
      }),
    });
    if (!res.ok) {
      console.error("logActivity http", res.status, await res.text());
    }
  } catch (err) {
    console.error("logActivity threw", err);
  }
}