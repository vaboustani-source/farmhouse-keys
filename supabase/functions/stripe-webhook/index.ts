// Stripe webhook handler — Supabase Edge Function port of
// src/routes/api/public/stripe-webhook.ts. Logic must remain identical.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";
import { Resend } from "https://esm.sh/resend@4";
import {
  depositConfirmedEmail,
  paidConfirmedEmail,
  coveredGuestEmail,
  adminNotificationEmail,
  paymentFailedEmail,
  paymentMethodUpdatedEmail,
} from "./email-templates.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const FROM = "Gilbertsville Farmhouse <noreply@stay.gilbertsvillefarmhouse.com>";

function getResend() {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(key);
}

const firstName = (full: string) =>
  (full || "").trim().split(/\s+/)[0] || "there";
const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

async function sendMail(
  to: string,
  payload: { subject: string; html: string },
) {
  await getResend().emails.send({
    from: FROM,
    to,
    subject: payload.subject,
    html: payload.html,
  });
}

async function sendDepositConfirmation(opts: {
  to: string;
  guestName: string;
  weddingName: string;
  sectionName: string;
  checkIn: string;
  checkOut: string;
  amountPaid: number;
  remaining: number;
  coveredGuestName?: string | null;
  breakdown?: {
    baseAmount: number;
    addonAmount: number;
    resortFee: number;
    taxAmount: number;
    totalAmount: number;
    addonsSelected: { name: string; price: number }[];
  };
  finalChargeDate?: string;
  cancellationPolicy?: string;
}) {
  const total = opts.breakdown?.totalAmount ?? opts.amountPaid + opts.remaining;
  await sendMail(
    opts.to,
    depositConfirmedEmail({
      guestFirstName: firstName(opts.guestName),
      weddingName: opts.weddingName,
      sectionName: opts.sectionName,
      checkInDate: fmtDate(opts.checkIn),
      checkOutDate: fmtDate(opts.checkOut),
      baseAmount: opts.breakdown?.baseAmount ?? total,
      addonAmount: opts.breakdown?.addonAmount ?? 0,
      resortFee: opts.breakdown?.resortFee ?? 0,
      taxAmount: opts.breakdown?.taxAmount ?? 0,
      totalAmount: total,
      depositAmount: opts.amountPaid,
      finalAmount: opts.remaining,
      finalChargeDate: opts.finalChargeDate ?? "closer to your stay",
      addonsSelected: opts.breakdown?.addonsSelected ?? [],
      coveredGuestName: opts.coveredGuestName ?? undefined,
      coveredGuestSection: opts.coveredGuestName ? opts.sectionName : undefined,
      cancellationPolicy: opts.cancellationPolicy,
    }),
  );
}

async function sendPaidInFullConfirmation(opts: {
  to: string;
  guestName: string;
  weddingName: string;
  sectionName: string;
  checkIn: string;
  checkOut: string;
  amountPaid: number;
  coveredGuestName?: string | null;
  breakdown?: {
    baseAmount: number;
    addonAmount: number;
    resortFee: number;
    taxAmount: number;
    addonsSelected: { name: string; price: number }[];
  };
  cancellationPolicy?: string;
}) {
  await sendMail(
    opts.to,
    paidConfirmedEmail({
      guestFirstName: firstName(opts.guestName),
      weddingName: opts.weddingName,
      sectionName: opts.sectionName,
      checkInDate: fmtDate(opts.checkIn),
      checkOutDate: fmtDate(opts.checkOut),
      baseAmount: opts.breakdown?.baseAmount ?? opts.amountPaid,
      addonAmount: opts.breakdown?.addonAmount ?? 0,
      resortFee: opts.breakdown?.resortFee ?? 0,
      taxAmount: opts.breakdown?.taxAmount ?? 0,
      totalAmount: opts.amountPaid,
      addonsSelected: opts.breakdown?.addonsSelected ?? [],
      coveredGuestName: opts.coveredGuestName ?? undefined,
      coveredGuestSection: opts.coveredGuestName ? opts.sectionName : undefined,
      cancellationPolicy: opts.cancellationPolicy,
    }),
  );
}

/** "Free cancellation until <date>" when the event sets a cutoff; otherwise
 * the template's default 45-day wedding policy applies. */
function cancellationPolicyFor(ev: {
  check_in_date?: string | null;
  cancel_cutoff_days?: number | null;
}): string | undefined {
  if (!ev?.check_in_date || !ev?.cancel_cutoff_days) return undefined;
  const cancelBy = new Date(
    new Date(ev.check_in_date + "T00:00:00").getTime() -
      ev.cancel_cutoff_days * 86400000,
  );
  const label = cancelBy.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return `Free cancellation until ${label}. After that, the reservation is fully non-refundable.`;
}

async function sendCoveredGuestEmail(opts: {
  to: string;
  guestName: string;
  payerName: string;
  weddingName: string;
  sectionName: string;
  checkIn: string;
  checkOut: string;
}) {
  await sendMail(
    opts.to,
    coveredGuestEmail({
      guestFirstName: firstName(opts.guestName),
      payerFirstName: firstName(opts.payerName),
      weddingName: opts.weddingName,
      sectionName: opts.sectionName,
      checkInDate: fmtDate(opts.checkIn),
      checkOutDate: fmtDate(opts.checkOut),
    }),
  );
}

async function sendAdminNotification(opts: {
  guestName: string;
  sectionName: string;
  amount: number;
  paymentType: "deposit" | "full";
  weddingName: string;
  secondaryGuestName?: string | null;
  cotRequested?: boolean;
  cotFee?: number;
  checkIn?: string;
  checkOut?: string;
  guestEmail?: string;
}) {
  const to =
    Deno.env.get("BRANDON_NOTIFICATION_EMAIL") || Deno.env.get("ADMIN_EMAIL");
  if (!to) return;
  await sendMail(
    to,
    adminNotificationEmail({
      guestName: opts.guestName,
      guestEmail: opts.guestEmail ?? "",
      weddingName: opts.weddingName,
      sectionName: opts.sectionName,
      paymentType: opts.paymentType,
      amountCollected: opts.amount,
      coveredGuestName: opts.secondaryGuestName ?? undefined,
      coveredGuestSection: opts.secondaryGuestName ? opts.sectionName : undefined,
      adminEventUrl: Deno.env.get("APP_BASE_URL") ?? "",
    }),
  );
}

async function sendPaymentFailedEmail(opts: {
  to: string;
  guestName: string;
  weddingName: string;
  sectionName?: string;
  failedAmount?: number;
  retryUrl: string;
  retryDeadline?: string;
}) {
  await sendMail(
    opts.to,
    paymentFailedEmail({
      guestFirstName: firstName(opts.guestName),
      weddingName: opts.weddingName,
      sectionName: opts.sectionName ?? "your reservation",
      failedAmount: opts.failedAmount ?? 0,
      retryUrl: opts.retryUrl,
      retryDeadline: opts.retryDeadline ?? "as soon as possible",
    }),
  );
}

async function sendPaymentMethodUpdated(opts: {
  to: string;
  guestName: string;
  weddingName: string;
  sectionName: string;
  balance: number;
  chargeDate: string;
}) {
  await sendMail(
    opts.to,
    paymentMethodUpdatedEmail({
      guestFirstName: firstName(opts.guestName),
      weddingName: opts.weddingName,
      sectionName: opts.sectionName,
      balance: opts.balance,
      chargeDate: opts.chargeDate,
    }),
  );
}

type ActivityActor = "admin" | "guest" | "system" | "stripe";
async function logActivity(input: {
  eventId?: string | null;
  bookingId?: string | null;
  actor: ActivityActor;
  actorName?: string | null;
  action: string;
  label: string;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("lb_activity_log").insert({
      event_id: input.eventId ?? null,
      booking_id: input.bookingId ?? null,
      actor: input.actor,
      actor_name: input.actorName ?? null,
      action: input.action,
      label: input.label,
      metadata: input.metadata ?? null,
    } as never);
    if (error) console.error("logActivity insert failed", error, input);
  } catch (err) {
    console.error("logActivity threw", err, input);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type, stripe-signature",
      },
    });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const sig = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const apiKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!sig || !secret || !apiKey) {
    return new Response("Missing signature or secrets", { status: 400 });
  }
  const stripe = new Stripe(apiKey, { apiVersion: "2024-12-18.acacia" });
  const body = await req.text();
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
      if (!primaryId) return new Response("ok", { status: 200 });

      // ── BALANCE PAYMENT (guest pre-paid balance via reservation card) ──
      if (metadata.payment_type === "balance") {
        const { data: bk } = await supabaseAdmin
          .from("lb_bookings")
          .select("id, guest_name, guest_email, total_amount, payment_status, event_id, section_id, final_paid_at")
          .eq("id", primaryId)
          .single();
        if (!bk || bk.final_paid_at) return new Response("ok", { status: 200 });

        const piId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null;
        const now = new Date().toISOString();
        await supabaseAdmin
          .from("lb_bookings")
          .update({
            payment_status: "paid",
            final_paid_at: now,
            stripe_payment_intent_id: piId,
          })
          .eq("id", primaryId);

        const { data: section } = await supabaseAdmin
          .from("lb_room_sections")
          .select("section_name")
          .eq("id", bk.section_id)
          .single();
        const { data: ev } = await supabaseAdmin
          .from("lb_events")
          .select("wedding_name, check_in_date, check_out_date")
          .eq("id", bk.event_id)
          .single();

        const amountPaid = (session.amount_total ?? 0) / 100;
        try {
          await sendPaidInFullConfirmation({
            to: bk.guest_email,
            guestName: bk.guest_name,
            weddingName: ev?.wedding_name ?? "your wedding weekend",
            sectionName: section?.section_name ?? "your section",
            checkIn: ev?.check_in_date ?? "",
            checkOut: ev?.check_out_date ?? "",
            amountPaid,
          });
          await sendAdminNotification({
            guestName: bk.guest_name,
            guestEmail: bk.guest_email,
            sectionName: section?.section_name ?? "",
            amount: amountPaid,
            paymentType: "full",
            weddingName: ev?.wedding_name ?? "",
            checkIn: ev?.check_in_date ?? "",
            checkOut: ev?.check_out_date ?? "",
          });
        } catch (e) {
          console.error("balance-payment email failed", e);
        }
        await logActivity({
          eventId: bk.event_id,
          bookingId: bk.id,
          actor: "guest",
          actorName: bk.guest_name,
          action: "payment.balance_paid_early",
          label: `Balance paid early — ${bk.guest_name}`,
          metadata: {
            amount: amountPaid,
            section_name: section?.section_name ?? null,
            stripe_session_id: session.id,
          },
        });
        return new Response("ok", { status: 200 });
      }

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

      const piId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
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

      const { data: bookings } = await supabaseAdmin
        .from("lb_bookings")
        .select(
          "id, guest_name, guest_email, total_amount, base_amount, addon_amount, resort_fee, addons_selected, event_id, section_id, cot_requested, cot_fee",
        )
        .in("id", [primaryId, ...(secondaryId ? [secondaryId] : [])]);

      const primary = bookings?.find((b) => b.id === primaryId);
      const secondary = secondaryId
        ? bookings?.find((b) => b.id === secondaryId)
        : null;

      if (primary) {
        const { data: section } = await supabaseAdmin
          .from("lb_room_sections")
          .select("section_name")
          .eq("id", primary.section_id)
          .single();
        const { data: ev } = await supabaseAdmin
          .from("lb_events")
          .select(
            "wedding_name, check_in_date, check_out_date, balance_due_on, cancel_cutoff_days",
          )
          .eq("id", primary.event_id)
          .single();

        const totalCharged = (session.amount_total ?? 0) / 100;
        const fullPrimaryTotal = Number(primary.total_amount || 0);

        // Real line items for the confirmation email. Tax = what Stripe
        // actually charged beyond the pre-tax total (per-charge for splits).
        const addonLines: { name: string; price: number }[] = Array.isArray(
          primary.addons_selected,
        )
          ? (primary.addons_selected as { name?: string; price?: number }[])
              .filter((a) => a?.name)
              .map((a) => ({ name: String(a.name), price: Number(a.price) || 0 }))
          : [];
        if (primary.cot_requested && Number(primary.cot_fee) > 0) {
          addonLines.push({
            name: "3rd guest / cot setup",
            price: Number(primary.cot_fee),
          });
        }
        const preTaxCharged = isSplit ? fullPrimaryTotal * 0.5 : fullPrimaryTotal;
        const taxCharged = Math.max(0, totalCharged - preTaxCharged);
        const fullTaxEstimate = isSplit ? taxCharged * 2 : taxCharged;
        const breakdown = {
          baseAmount: Number(primary.base_amount) || 0,
          addonAmount: Number(primary.addon_amount) || 0,
          resortFee: Number(primary.resort_fee) || 0,
          taxAmount: fullTaxEstimate,
          totalAmount: fullPrimaryTotal + fullTaxEstimate,
          addonsSelected: addonLines,
        };
        const cancelPolicy = cancellationPolicyFor(ev ?? {});

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
            // Both halves are equal (50% of pre-tax total + tax on each half).
            remaining: totalCharged,
            coveredGuestName: secondary?.guest_name ?? null,
            breakdown,
            finalChargeDate: ev?.balance_due_on
              ? fmtDate(ev.balance_due_on)
              : undefined,
            cancellationPolicy: cancelPolicy,
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
            breakdown,
            cancellationPolicy: cancelPolicy,
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
        const newExpiry = new Date(Date.now() + 14 * 86400000).toISOString();
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
          Deno.env.get("APP_BASE_URL") ??
          "https://stay.gilbertsvillefarmhouse.com";
        const failedAmount =
          (pi.amount ?? 0) / 100 || Number(b.total_amount || 0) / 2;
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
          .select("wedding_name, check_in_date, balance_due_on")
          .eq("id", b.event_id)
          .single();
        const { data: section } = await supabaseAdmin
          .from("lb_room_sections")
          .select("section_name")
          .eq("id", b.section_id)
          .single();

        const balance = Number(b.total_amount || 0) / 2;
        // Events with an explicit balance date (pop-up weekends) charge on
        // that date; weddings charge 30 days before check-in.
        const chargeDate = ev?.balance_due_on
          ? fmtDate(ev.balance_due_on)
          : ev?.check_in_date
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

        try {
          const adminTo =
            Deno.env.get("BRANDON_NOTIFICATION_EMAIL") ??
            Deno.env.get("ADMIN_EMAIL");
          const resendKey = Deno.env.get("RESEND_API_KEY");
          if (adminTo && resendKey) {
            const resend = new Resend(resendKey);
            await resend.emails.send({
              from: FROM,
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
        } as never);
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
        } as never);
        return new Response("ok", { status: 200 });
      }

      const now = new Date().toISOString();
      for (const b of bookings) {
        if (b.payment_status === "paid") continue;
        if (b.payment_status !== "deposit_paid") continue;

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
          metadata: {
            amount: finalAmount,
            section_name: section?.section_name ?? null,
            stripe_payment_intent_id: pi.id,
          },
        });
      }
    }
  } catch (err) {
    console.error("Stripe webhook handler error", err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});