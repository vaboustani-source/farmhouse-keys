import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  sendDepositConfirmation,
  sendPaidInFullConfirmation,
  sendCoveredGuestEmail,
  sendAdminNotification,
  sendPaymentFailedEmail,
} from "@/lib/email/booking-emails.server";

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
            const isSplit = metadata.payment_schedule === "split_50_50";
            if (!primaryId) {
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
              .select("id, guest_name, guest_email, event_id")
              .eq("stripe_payment_intent_id", pi.id);
            for (const b of bookings ?? []) {
              await supabaseAdmin
                .from("lb_bookings")
                .update({ payment_status: "payment_failed" })
                .eq("id", b.id);
              const { data: ev } = await supabaseAdmin
                .from("lb_events")
                .select("wedding_name")
                .eq("id", b.event_id)
                .single();
              await sendPaymentFailedEmail({
                to: b.guest_email,
                guestName: b.guest_name,
                weddingName: ev?.wedding_name ?? "your wedding weekend",
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