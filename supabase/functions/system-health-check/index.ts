import { Resend } from "npm:resend@4.0.0";

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
    if (!resendKey || !to) {
      return new Response(JSON.stringify({ error: "Missing env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(resendKey);
    const now = new Date().toISOString();

    const { data, error } = await resend.emails.send({
      from: "Gilbertsville Farmhouse <notifications@updates.gilbertsvillefarmhouse.com>",
      to: [to],
      subject: `Weekly System Check — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
      html: `
        <h2>Weekly System Health Check</h2>
        <p>This is an automated weekly check confirming that scheduled jobs, edge functions, and email delivery are operating normally.</p>
        <ul>
          <li><strong>Timestamp:</strong> ${now}</li>
          <li><strong>Edge functions:</strong> reachable</li>
          <li><strong>Email delivery:</strong> working (you're reading this)</li>
          <li><strong>pg_cron:</strong> firing on schedule</li>
        </ul>
        <p>No action required.</p>
      `,
    });

    if (error) {
      return new Response(JSON.stringify({ error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "ok", id: data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});