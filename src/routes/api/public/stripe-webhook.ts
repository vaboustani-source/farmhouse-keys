import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  sendDepositConfirmation,
  sendPaidInFullConfirmation,
  sendCoveredGuestEmail,
  sendAdminNotification,
  sendPaymentFailedEmail,
  sendPaymentMethodUpdated,
} from "@/lib/email/booking-emails.server";
import { Resend } from "resend";
import { logActivity } from "@/lib/activity-log.server";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sig = request.headers.get("stripe-signature");
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        const apiKey = process.env.STRIPE_SECRET_KEY;
        if (!sig || !secret || !apiKey) {
          return new Response("Missing signature or secrets", { status: 400 });
        }
        const stripe = new Stripe(apiKey);
        const body = await request.text();
        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, sig, secret);
        } catch (err) {
          console.error("Stripe webhook signature verification failed", err);
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const metadata = session.metadata ?? {};
            const primaryId = metadata.primary_booking_id;
            const secondaryId = metadata.secondary_booking_id || null;
            const isSplit =
              metadata.payment_schedule === "split_50_50" ||
              metadata.payment_schedule === "deposit_50_balance_50";
            if (!primaryId) {
              return new Response("ok", { status: 200 });
            }

            // ── Idempotency: skip if this booking is already finalized ──
            const { data: existingPrimary } = await supabaseAdmin
              .from("lb_bookings")
              .select("payment_status, final_paid_at, deposit_paid_at")
              .eq("id", primaryId)
              .single();
            if (existingPrimary?.final_paid_at) {
              return new Response("ok", { status: 200 });
            }
            if (
              isSplit &&
              existingPrimary?.payment_status === "deposit_paid" &&
              existingPrimary?.deposit_paid_at
            ) {
              return new Response("ok", { status: 200 });
            }

            const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
            const now = new Date().toISOString();

            if (isSplit) {
              await supabaseAdmin
                .from("lb_bookings")
                .update({
                  payment_status: "deposit_paid",
                  deposit_paid_at: now,
                  stripe_payment_intent_id: piId,
                })
                .eq("id", primaryId);
            } else {
              await supabaseAdmin
                .from("lb_bookings")
                .update({
                  payment_status: "paid",
                  deposit_paid_at: now,
                  final_paid_at: now,
                  stripe_payment_intent_id: piId,
                })
                .eq("id", primaryId);
            }

            if (secondaryId) {
              await supabaseAdmin
                .from("lb_bookings")
                .update({
                  payment_status: "covered",
                  covered_at: now,
                  covered_by_booking_id: primaryId,
                  stripe_payment_intent_id: piId,
                })
                .eq("id", secondaryId);
            }

            // Fetch enriched data for emails
            const { data: bookings } = await supabaseAdmin
              .from("lb_bookings")
              .select("id, guest_name, guest_email, total_amount, event_id, section_id, cot_requested, cot_fee")
              .in("id", [primaryId, ...(secondaryId ? [secondaryId] : [])]);

            const primary = bookings?.find((b) => b.id === primaryId);
            const secondary = secondaryId ? bookings?.find((b) => b.id === secondaryId) : null;

            if (primary) {
              const { data: section } = await supabaseAdmin
                .from("lb_room_sections")
                .select("section_name")
                .eq("id", primary.section_id)
                .single();
              const { data: ev } = await supabaseAdmin
                .from("lb_events")
                .select("wedding_name, check_in_date, check_out_date")
                .eq("id", primary.event_id)
                .single();

              const totalCharged = (session.amount_total ?? 0) / 100;
              const fullPrimaryTotal = Number(primary.total_amount || 0);

              await logActivity({
                eventId: primary.event_id,
                bookingId: primary.id,
                actor: "stripe",
                actorName: "Stripe webhook",
                action: isSplit ? "payment.deposit_paid" : "payment.paid_full",
                label: isSplit
                  ? `Deposit received from ${primary.guest_name}`
                  : `Paid in full by ${primary.guest_name}`,
                metadata: {
                  amount: totalCharged,
                  section_name: section?.section_name ?? null,
                  stripe_session_id: session.id,
                },
              });
              if (secondary) {
                await logActivity({
                  eventId: secondary.event_id,
                  bookingId: secondary.id,
                  actor: "stripe",
                  actorName: "Stripe webhook",
                  action: "booking.covered",
                  label: `${secondary.guest_name} covered by ${primary.guest_name}`,
                  metadata: { covered_by_booking_id: primary.id },
                });
              }

              if (isSplit) {
                await sendDepositConfirmation({
                  to: primary.guest_email,
                  guestName: primary.guest_name,
                  weddingName: ev?.wedding_name ?? "your wedding weekend",
                  sectionName: section?.section_name ?? "your section",
                  checkIn: ev?.check_in_date ?? "",
                  checkOut: ev?.check_out_date ?? "",
                  amountPaid: totalCharged,
                  remaining: fullPrimaryTotal - fullPrimaryTotal * 0.5,
                  coveredGuestName: secondary?.guest_name ?? null,
                });
              } else {
                await sendPaidInFullConfirmation({
                  to: primary.guest_email,
                  guestName: primary.guest_name,
                  weddingName: ev?.wedding_name ?? "your wedding weekend",
                  sectionName: section?.section_name ?? "your section",
                  checkIn: ev?.check_in_date ?? "",
                  checkOut: ev?.check_out_date ?? "",
                  amountPaid: totalCharged,
                  coveredGuestName: secondary?.guest_name ?? null,
                });
              }

              await sendAdminNotification({
                guestName: primary.guest_name,
                sectionName: section?.section_name ?? "",
                amount: totalCharged,
                paymentType: isSplit ? "deposit" : "full",
                weddingName: ev?.wedding_name ?? "",
                secondaryGuestName: secondary?.guest_name ?? null,
                cotRequested: !!(primary as { cot_requested?: boolean }).cot_requested,
                cotFee: Number((primary as { cot_fee?: number }).cot_fee ?? 0),
                checkIn: ev?.check_in_date ?? "",
                checkOut: ev?.check_out_date ?? "",
              });

              if (secondary) {
                const { data: secSection } = await supabaseAdmin
                  .from("lb_room_sections")
                  .select("section_name")
                  .eq("id", secondary.section_id)
                  .single();
                await sendCoveredGuestEmail({
                  to: secondary.guest_email,
                  guestName: secondary.guest_name,
                  payerName: primary.guest_name,
                  weddingName: ev?.wedding_name ?? "your wedding weekend",
                  sectionName: secSection?.section_name ?? "your section",
                  checkIn: ev?.check_in_date ?? "",
                  checkOut: ev?.check_out_date ?? "",
                });
              }
            }
          } else if (event.type === "payment_intent.payment_failed") {
            const pi = event.data.object as Stripe.PaymentIntent;
            const { data: bookings } = await supabaseAdmin
              .from("lb_bookings")
              .select("id, guest_name, guest_email, event_id, total_amount, section_id")
              .eq("stripe_payment_intent_id", pi.id);
            for (const b of bookings ?? []) {
              const newToken = crypto.randomUUID();
              const newExpiry = new Date(
                Date.now() + 14 * 86400000,
              ).toISOString();
              await supabaseAdmin
                .from("lb_bookings")
                .update({
                  payment_status: "payment_failed",
                  payment_update_token: newToken,
                  payment_update_token_expires_at: newExpiry,
                })
                .eq("id", b.id);
              const { data: ev } = await supabaseAdmin
                .from("lb_events")
                .select("wedding_name")
                .eq("id", b.event_id)
                .single();
              const { data: section } = await supabaseAdmin
                .from("lb_room_sections")
                .select("section_name")
                .eq("id", b.section_id)
                .single();
              const baseUrl =
                process.env.APP_BASE_URL ?? "https://stay.gilbertsvillefarmhouse.com";
              const failedAmount =
                (pi.amount ?? 0) / 100 ||
                Number(b.total_amount || 0) / 2;
              await sendPaymentFailedEmail({
                to: b.guest_email,
                guestName: b.guest_name,
                weddingName: ev?.wedding_name ?? "your wedding weekend",
                sectionName: section?.section_name ?? "your reservation",
                failedAmount,
                retryUrl: `${baseUrl}/update-payment/${newToken}`,
                retryDeadline: "as soon as possible",
              });
              await logActivity({
                eventId: b.event_id,
                bookingId: b.id,
                actor: "stripe",
                actorName: "Stripe webhook",
                action: "payment.failed",
                label: `Payment failed — ${b.guest_name}`,
                metadata: { amount: failedAmount, stripe_payment_intent_id: pi.id },
              });
            }
          } else if (event.type === "setup_intent.succeeded") {
            const si = event.data.object as Stripe.SetupIntent;
            const customerId =
              typeof si.customer === "string" ? si.customer : si.customer?.id ?? null;
            const paymentMethodId =
              typeof si.payment_method === "string"
                ? si.payment_method
                : si.payment_method?.id ?? null;
            if (!customerId || !paymentMethodId) {
              return new Response("ok", { status: 200 });
            }

            const { data: bookings } = await supabaseAdmin
              .from("lb_bookings")
              .select(
                "id, guest_name, guest_email, total_amount, payment_status, event_id, section_id",
              )
              .eq("stripe_customer_id", customerId);

            for (const b of bookings ?? []) {
              const updateFields = {
                stripe_payment_method_id: paymentMethodId,
                payment_update_token: null,
                payment_update_token_expires_at: null,
                ...(b.payment_status === "payment_failed"
                  ? { payment_status: "deposit_paid" }
                  : {}),
              } as never;
              await supabaseAdmin
                .from("lb_bookings")
                .update(updateFields)
                .eq("id", b.id);

              const { data: ev } = await supabaseAdmin
                .from("lb_events")
                .select("wedding_name, check_in_date")
                .eq("id", b.event_id)
                .single();
              const { data: section } = await supabaseAdmin
                .from("lb_room_sections")
                .select("section_name")
                .eq("id", b.section_id)
                .single();

              const balance = Number(b.total_amount || 0) / 2;
              const chargeDate = ev?.check_in_date
                ? new Date(
                    new Date(ev.check_in_date + "T00:00:00").getTime() -
                      30 * 86400000,
                  ).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                : "30 days before check-in";

              try {
                await sendPaymentMethodUpdated({
                  to: b.guest_email,
                  guestName: b.guest_name,
                  weddingName: ev?.wedding_name ?? "your wedding weekend",
                  sectionName: section?.section_name ?? "your reservation",
                  balance,
                  chargeDate,
                });
              } catch (e) {
                console.error("sendPaymentMethodUpdated failed", e);
              }

              // Admin notification
              try {
                const adminTo =
                  process.env.BRANDON_NOTIFICATION_EMAIL ?? process.env.ADMIN_EMAIL;
                const resendKey = process.env.RESEND_API_KEY;
                if (adminTo && resendKey) {
                  const resend = new Resend(resendKey);
                  await resend.emails.send({
                    from: "Gilbertsville Farmhouse <noreply@gilbertsvillefarmhouse.com>",
                    to: adminTo,
                    subject: "Guest updated payment method",
                    html: `<p>${b.guest_name} updated their payment method for ${ev?.wedding_name ?? ""}.</p>`,
                  });
                }
              } catch (e) {
                console.error("admin notify failed", e);
              }

              await logActivity({
                eventId: b.event_id,
                bookingId: b.id,
                actor: "guest",
                actorName: b.guest_name,
                action: "payment.method_updated",
                label: `Payment method updated — ${b.guest_name}`,
                metadata: { stripe_setup_intent_id: si.id },
              });
              await supabaseAdmin.from("lb_sync_log").insert({
                action: "payment_method_updated",
                direction: "inbound",
                lb_booking_id: b.id,
                event_id: b.event_id,
                guest_email: b.guest_email,
                reason: `SetupIntent ${si.id} → pm ${paymentMethodId}`,
              });
            }
          } else if (event.type === "payment_intent.succeeded") {
            const pi = event.data.object as Stripe.PaymentIntent;
            const { data: bookings } = await supabaseAdmin
              .from("lb_bookings")
              .select(
                "id, guest_name, guest_email, total_amount, payment_status, payment_schedule, event_id, section_id",
              )
              .eq("stripe_payment_intent_id", pi.id);

            if (!bookings || bookings.length === 0) {
              await supabaseAdmin.from("lb_sync_log").insert({
                action: "stripe_pi_succeeded_no_booking",
                direction: "inbound",
                reason: `No lb_bookings match payment_intent ${pi.id}`,
              });
              return new Response("ok", { status: 200 });
            }

            const now = new Date().toISOString();
            for (const b of bookings) {
              if (b.payment_status === "paid") continue; // idempotent
              if (b.payment_status !== "deposit_paid") continue; // only promote deposit→paid

              await supabaseAdmin
                .from("lb_bookings")
                .update({ payment_status: "paid", final_paid_at: now })
                .eq("id", b.id);

              const { data: section } = await supabaseAdmin
                .from("lb_room_sections")
                .select("section_name")
                .eq("id", b.section_id)
                .single();
              const { data: ev } = await supabaseAdmin
                .from("lb_events")
                .select("wedding_name, check_in_date, check_out_date")
                .eq("id", b.event_id)
                .single();

              const finalAmount = (pi.amount_received ?? pi.amount ?? 0) / 100;

              await sendPaidInFullConfirmation({
                to: b.guest_email,
                guestName: b.guest_name,
                weddingName: ev?.wedding_name ?? "your wedding weekend",
                sectionName: section?.section_name ?? "your section",
                checkIn: ev?.check_in_date ?? "",
                checkOut: ev?.check_out_date ?? "",
                amountPaid: finalAmount,
              });

              await sendAdminNotification({
                guestName: b.guest_name,
                sectionName: section?.section_name ?? "",
                amount: finalAmount,
                paymentType: "full",
                weddingName: ev?.wedding_name ?? "",
                checkIn: ev?.check_in_date ?? "",
                checkOut: ev?.check_out_date ?? "",
                guestEmail: b.guest_email,
              });
              await logActivity({
                eventId: b.event_id,
                bookingId: b.id,
                actor: "stripe",
                actorName: "Stripe webhook",
                action: "payment.balance_charged",
                label: `Balance charged — ${b.guest_name}`,
                metadata: { amount: finalAmount, section_name: section?.section_name ?? null, stripe_payment_intent_id: pi.id },
              });
            }
          }
        } catch (err) {
          console.error("Stripe webhook handler error", err);
          return new Response("Handler error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});