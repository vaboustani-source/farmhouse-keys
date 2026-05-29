import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const to = Deno.env.get("BRANDON_NOTIFICATION_EMAIL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!resendKey || !to || !supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const [activeEventsRes, pendingRes, depositRes, paidRes, failedRes] = await Promise.all([
      supabase.from("lb_events").select("id", { count: "exact", head: true }).neq("status", "archived"),
      supabase.from("lb_bookings").select("id", { count: "exact", head: true }).eq("payment_status", "pending"),
      supabase.from("lb_bookings").select("id", { count: "exact", head: true }).eq("payment_status", "deposit_paid"),
      supabase.from("lb_bookings").select("id", { count: "exact", head: true }).in("payment_status", ["paid", "covered"]),
      supabase
        .from("lb_bookings")
        .select("guest_name, guest_email, event_id, lb_events!inner(wedding_name)")
        .eq("payment_status", "payment_failed"),
    ]);

    const activeEvents = activeEventsRes.count ?? 0;
    const pending = pendingRes.count ?? 0;
    const deposit = depositRes.count ?? 0;
    const paid = paidRes.count ?? 0;
    const failedRows = (failedRes.data ?? []) as Array<{
      guest_name: string | null;
      guest_email: string | null;
      lb_events: { wedding_name: string | null } | null;
    }>;
    const failedCount = failedRows.length;

    const statusLine =
      failedCount > 0
        ? `<p style="color:#b91c1c;font-weight:bold;">⚠️ ACTION NEEDED: ${failedCount} failed payment${failedCount === 1 ? "" : "s"}</p>`
        : `<p style="color:#15803d;font-weight:bold;">✅ All systems operational</p>`;

    const failedList =
      failedCount > 0
        ? `<h3>Failed payments requiring attention</h3><ul>${failedRows
            .map(
              (r) =>
                `<li><strong>${r.guest_name ?? r.guest_email ?? "Unknown guest"}</strong> — ${r.lb_events?.wedding_name ?? "Unknown event"}</li>`
            )
            .join("")}</ul>`
        : "";

    const subject = "GFH Lodging — weekly system check";
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2>Weekly System Check</h2>
        <p><strong>${today}</strong></p>
        ${statusLine}
        <h3>Booking summary</h3>
        <ul>
          <li>Active events: <strong>${activeEvents}</strong></li>
          <li>Pending bookings: <strong>${pending}</strong></li>
          <li>Deposit paid: <strong>${deposit}</strong></li>
          <li>Paid (incl. covered): <strong>${paid}</strong></li>
          <li>Payment failed: <strong>${failedCount}</strong></li>
        </ul>
        ${failedList}
        <hr/>
        <p style="color:#6b7280;font-size:12px;">Automated weekly check from GFH Lodging. Edge functions, pg_cron, and email delivery are working — you're reading this.</p>
      </div>
    `;

    const resend = new Resend(resendKey);
    const { data, error } = await resend.emails.send({
      from: "Gilbertsville Farmhouse <notifications@updates.gilbertsvillefarmhouse.com>",
      to: [to],
      subject,
      html,
    });

    if (error) {
      return new Response(JSON.stringify({ error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ status: "ok", id: data?.id, stats: { activeEvents, pending, deposit, paid, failedCount } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});