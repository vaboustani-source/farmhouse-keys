// Daily balance collection: charges remaining 50% for deposit_50_balance_50
// bookings exactly 30 days before check-in. Also sends a heads-up email
// 7 days before charge date (37 days from check-in).
//
// Triggered by pg_cron via HTTP POST. Auth: x-cron-secret header.

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Resend } from "https://esm.sh/resend@4.0.1";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const ADMIN_EMAIL =
  Deno.env.get("BRANDON_NOTIFICATION_EMAIL") ?? Deno.env.get("ADMIN_EMAIL") ?? "";
const FROM = "Gilbertsville Farmhouse <noreply@gilbertsvillefarmhouse.com>";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
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

async function sendReminder(opts: {
  to: string;
  guestName: string;
  amount: number;
  chargeDate: string;
}) {
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: "Your final payment is coming up",
    html: `
      <p>Hi ${opts.guestName.split(" ")[0] || "there"},</p>
      <p>Your remaining balance of <strong>${fmtMoney(opts.amount)}</strong>
      will be automatically charged on <strong>${fmtDate(opts.chargeDate)}</strong>.</p>
      <p>No action needed — we just wanted to give you a heads up.</p>
      <p>— Gilbertsville Farmhouse</p>
    `,
  });
}

async function sendPaymentFailed(to: string, guestName: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "We couldn't process your final payment",
    html: `
      <p>Hi ${guestName.split(" ")[0] || "there"},</p>
      <p>We tried to charge your remaining balance today but the payment did not go through.
      Please reply to this email and we'll send you a secure link to retry.</p>
      <p>— Gilbertsville Farmhouse</p>
    `,
  });
}

async function sendPaidInFull(to: string, guestName: string, amount: number) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Your balance has been paid in full",
    html: `
      <p>Hi ${guestName.split(" ")[0] || "there"},</p>
      <p>We've charged your remaining balance of <strong>${fmtMoney(amount)}</strong>.
      Your reservation is now paid in full. See you soon!</p>
      <p>— Gilbertsville Farmhouse</p>
    `,
  });
}

async function sendAdmin(subject: string, html: string) {
  if (!ADMIN_EMAIL) return;
  await resend.emails.send({ from: FROM, to: ADMIN_EMAIL, subject, html });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const chargeOn = addDays(30); // bookings whose check_in is 30 days out
  const reminderOn = addDays(37); // bookings whose check_in is 37 days out

  const summary = { charged: 0, failed: 0, reminders: 0, skipped: 0 };

  // --- Reminders: check_in_date 37 days out ---
  {
    const { data: events } = await supabase
      .from("lb_events")
      .select("id")
      .eq("check_in_date", reminderOn);
    const eventIds = (events ?? []).map((e) => e.id);
    if (eventIds.length > 0) {
      const { data: rows } = await supabase
        .from("lb_bookings")
        .select("id, guest_email, guest_name, total_amount, reminder_count")
        .in("event_id", eventIds)
        .eq("payment_status", "deposit_paid")
        .eq("payment_schedule", "deposit_50_balance_50")
        .is("final_paid_at", null)
        .lt("reminder_count", 1);
      for (const b of rows ?? []) {
        const balance = Number(b.total_amount || 0) / 2;
        try {
          await sendReminder({
            to: b.guest_email,
            guestName: b.guest_name,
            amount: balance,
            chargeDate: chargeOn,
          });
          await supabase
            .from("lb_bookings")
            .update({
              reminder_count: (b.reminder_count ?? 0) + 1,
              reminder_sent_at: new Date().toISOString(),
            })
            .eq("id", b.id);
          summary.reminders++;
        } catch (err) {
          console.error("reminder failed", b.id, err);
        }
      }
    }
  }

  // --- Charges: check_in_date 30 days out ---
  {
    const { data: events } = await supabase
      .from("lb_events")
      .select("id, wedding_name")
      .eq("check_in_date", chargeOn);
    const eventIds = (events ?? []).map((e) => e.id);
    if (eventIds.length === 0) {
      return new Response(JSON.stringify(summary), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const { data: rows } = await supabase
      .from("lb_bookings")
      .select(
        "id, guest_email, guest_name, total_amount, stripe_payment_intent_id, event_id",
      )
      .in("event_id", eventIds)
      .eq("payment_status", "deposit_paid")
      .eq("payment_schedule", "deposit_50_balance_50")
      .is("final_paid_at", null);

    for (const b of rows ?? []) {
      const balanceCents = Math.round((Number(b.total_amount || 0) / 2) * 100);
      const ev = events!.find((e) => e.id === b.event_id);
      if (!b.stripe_payment_intent_id || balanceCents <= 0) {
        summary.skipped++;
        await sendAdmin(
          "Balance charge skipped — missing PI",
          `Booking ${b.id} (${b.guest_email}) has no stripe_payment_intent_id or zero balance.`,
        );
        continue;
      }

      try {
        // Look up the original PaymentIntent to retrieve customer + saved PM
        const originalPi = await stripe.paymentIntents.retrieve(
          b.stripe_payment_intent_id,
        );
        const customerId =
          typeof originalPi.customer === "string"
            ? originalPi.customer
            : originalPi.customer?.id;
        const paymentMethodId =
          typeof originalPi.payment_method === "string"
            ? originalPi.payment_method
            : originalPi.payment_method?.id;
        if (!customerId || !paymentMethodId) {
          throw new Error("Missing customer or payment_method on original PI");
        }

        const newPi = await stripe.paymentIntents.create({
          amount: balanceCents,
          currency: "usd",
          customer: customerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          description: `Final balance — ${ev?.wedding_name ?? "wedding stay"}`,
          metadata: { booking_id: b.id, charge_type: "balance_50" },
        });

        if (newPi.status === "succeeded") {
          await supabase
            .from("lb_bookings")
            .update({
              payment_status: "paid",
              final_paid_at: new Date().toISOString(),
              stripe_payment_intent_id: newPi.id,
            })
            .eq("id", b.id);
          await sendPaidInFull(b.guest_email, b.guest_name, balanceCents / 100);
          await sendAdmin(
            "Balance collected",
            `${b.guest_name} (${b.guest_email}) — ${fmtMoney(balanceCents / 100)} charged.`,
          );
          summary.charged++;
        } else {
          throw new Error(`PI status: ${newPi.status}`);
        }
      } catch (err) {
        console.error("balance charge failed", b.id, err);
        await supabase
          .from("lb_bookings")
          .update({ payment_status: "payment_failed" })
          .eq("id", b.id);
        try {
          await sendPaymentFailed(b.guest_email, b.guest_name);
        } catch (_) {
          // ignore
        }
        await sendAdmin(
          "Balance charge FAILED",
          `Booking ${b.id} (${b.guest_email}): ${(err as Error).message}`,
        );
        summary.failed++;
      }
    }
  }

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});