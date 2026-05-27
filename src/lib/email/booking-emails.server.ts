import { Resend } from "resend";
import {
  depositConfirmedEmail,
  paidConfirmedEmail,
  coveredGuestEmail,
  adminNotificationEmail,
  paymentFailedEmail,
} from "@/lib/email-templates";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(key);
}

const FROM = "Gilbertsville Farmhouse <noreply@gilbertsvillefarmhouse.com>";

const firstName = (full: string) => (full || "").trim().split(/\s+/)[0] || "there";
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "";

async function send(to: string, payload: { subject: string; html: string }) {
  await getResend().emails.send({ from: FROM, to, subject: payload.subject, html: payload.html });
}

export async function sendDepositConfirmation(opts: {
  to: string;
  guestName: string;
  weddingName: string;
  sectionName: string;
  checkIn: string;
  checkOut: string;
  amountPaid: number;
  remaining: number;
  coveredGuestName?: string | null;
}) {
  const total = opts.amountPaid + opts.remaining;
  await send(opts.to, depositConfirmedEmail({
    guestFirstName: firstName(opts.guestName),
    weddingName: opts.weddingName,
    sectionName: opts.sectionName,
    checkInDate: fmtDate(opts.checkIn),
    checkOutDate: fmtDate(opts.checkOut),
    baseAmount: total,
    addonAmount: 0,
    resortFee: 0,
    taxAmount: 0,
    totalAmount: total,
    depositAmount: opts.amountPaid,
    finalAmount: opts.remaining,
    finalChargeDate: "closer to your stay",
    addonsSelected: [],
    coveredGuestName: opts.coveredGuestName ?? undefined,
    coveredGuestSection: opts.coveredGuestName ? opts.sectionName : undefined,
  }));
}

export async function sendPaidInFullConfirmation(opts: {
  to: string;
  guestName: string;
  weddingName: string;
  sectionName: string;
  checkIn: string;
  checkOut: string;
  amountPaid: number;
  coveredGuestName?: string | null;
}) {
  await send(opts.to, paidConfirmedEmail({
    guestFirstName: firstName(opts.guestName),
    weddingName: opts.weddingName,
    sectionName: opts.sectionName,
    checkInDate: fmtDate(opts.checkIn),
    checkOutDate: fmtDate(opts.checkOut),
    baseAmount: opts.amountPaid,
    addonAmount: 0,
    resortFee: 0,
    taxAmount: 0,
    totalAmount: opts.amountPaid,
    addonsSelected: [],
    coveredGuestName: opts.coveredGuestName ?? undefined,
    coveredGuestSection: opts.coveredGuestName ? opts.sectionName : undefined,
  }));
}

export async function sendCoveredGuestEmail(opts: {
  to: string;
  guestName: string;
  payerName: string;
  weddingName: string;
  sectionName: string;
  checkIn: string;
  checkOut: string;
}) {
  await send(opts.to, coveredGuestEmail({
    guestFirstName: firstName(opts.guestName),
    payerFirstName: firstName(opts.payerName),
    weddingName: opts.weddingName,
    sectionName: opts.sectionName,
    checkInDate: fmtDate(opts.checkIn),
    checkOutDate: fmtDate(opts.checkOut),
  }));
}

export async function sendAdminNotification(opts: {
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
  adminEventUrl?: string;
}) {
  const to = process.env.BRANDON_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
  if (!to) return;
  await send(to, adminNotificationEmail({
    guestName: opts.guestName,
    guestEmail: opts.guestEmail ?? "",
    weddingName: opts.weddingName,
    sectionName: opts.sectionName,
    paymentType: opts.paymentType,
    amountCollected: opts.amount,
    coveredGuestName: opts.secondaryGuestName ?? undefined,
    coveredGuestSection: opts.secondaryGuestName ? opts.sectionName : undefined,
    adminEventUrl: opts.adminEventUrl ?? (process.env.APP_BASE_URL ?? ""),
  }));
}

export async function sendPaymentFailedEmail(opts: { to: string; guestName: string; weddingName: string }) {
  await send(opts.to, paymentFailedEmail({
    guestFirstName: firstName(opts.guestName),
    weddingName: opts.weddingName,
    sectionName: "your reservation",
    failedAmount: 0,
    retryUrl: process.env.APP_BASE_URL ?? "",
    retryDeadline: "as soon as possible",
  }));
}