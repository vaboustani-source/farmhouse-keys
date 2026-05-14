import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(key);
}

const FROM = "Gilbertsville Farmhouse <noreply@gilbertsvillefarmhouse.com>";

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "";

const wrap = (body: string) => `<div style="font-family: Georgia, 'Cormorant Garamond', serif; color:#1A1A1A; max-width:560px; margin:0 auto; padding:32px 24px; background:#FAF8F4;">
  <div style="text-align:center; font-size:14px; letter-spacing:0.18em; text-transform:uppercase; color:#2C3E2D; margin-bottom:32px;">Gilbertsville Farmhouse</div>
  ${body}
  <hr style="border:none; border-top:1px solid #E8E2D9; margin:32px 0 16px;" />
  <div style="text-align:center; font-size:12px; color:#6B6B6B;">A private estate. Tended by hand.</div>
</div>`;

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
  const body = `
    <h1 style="font-family:'Cormorant Garamond',serif; font-size:32px; font-weight:500; margin:0 0 16px;">Your room is reserved.</h1>
    <p style="font-family:'Jost',sans-serif; font-size:16px; line-height:1.6;">Dear ${opts.guestName.split(" ")[0]},</p>
    <p style="font-family:'Jost',sans-serif; font-size:16px; line-height:1.6;">Your deposit for <strong>${opts.weddingName}</strong> is confirmed. Your room in the <strong>${opts.sectionName}</strong> is held — no further action needed.</p>
    <table style="font-family:'Jost',sans-serif; font-size:14px; width:100%; margin:24px 0; border-collapse:collapse;">
      <tr><td style="padding:8px 0; color:#6B6B6B;">Check-in</td><td style="padding:8px 0; text-align:right;">${fmtDate(opts.checkIn)}</td></tr>
      <tr><td style="padding:8px 0; color:#6B6B6B;">Check-out</td><td style="padding:8px 0; text-align:right;">${fmtDate(opts.checkOut)}</td></tr>
      <tr><td style="padding:8px 0; color:#6B6B6B;">Deposit paid today</td><td style="padding:8px 0; text-align:right;">${fmtMoney(opts.amountPaid)}</td></tr>
      <tr><td style="padding:8px 0; color:#6B6B6B;">Remaining balance</td><td style="padding:8px 0; text-align:right;">${fmtMoney(opts.remaining)}</td></tr>
    </table>
    <p style="font-family:'Jost',sans-serif; font-size:14px; line-height:1.6; color:#6B6B6B;">We'll send a friendly reminder when your final balance is due. Your planning team will be in touch with arrival details closer to the date.</p>
    ${opts.coveredGuestName ? `<p style="font-family:'Jost',sans-serif; font-size:14px;"><em>${opts.coveredGuestName}'s room has also been reserved under your reservation.</em></p>` : ""}
  `;
  await getResend().emails.send({ from: FROM, to: opts.to, subject: "Your room at Gilbertsville Farmhouse is reserved", html: wrap(body) });
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
  const body = `
    <h1 style="font-family:'Cormorant Garamond',serif; font-size:32px; font-weight:500; margin:0 0 16px;">You're confirmed.</h1>
    <p style="font-family:'Jost',sans-serif; font-size:16px; line-height:1.6;">Dear ${opts.guestName.split(" ")[0]},</p>
    <p style="font-family:'Jost',sans-serif; font-size:16px; line-height:1.6;">Your room for <strong>${opts.weddingName}</strong> is confirmed. We look forward to welcoming you.</p>
    <table style="font-family:'Jost',sans-serif; font-size:14px; width:100%; margin:24px 0; border-collapse:collapse;">
      <tr><td style="padding:8px 0; color:#6B6B6B;">Section</td><td style="padding:8px 0; text-align:right;">${opts.sectionName}</td></tr>
      <tr><td style="padding:8px 0; color:#6B6B6B;">Check-in</td><td style="padding:8px 0; text-align:right;">${fmtDate(opts.checkIn)}</td></tr>
      <tr><td style="padding:8px 0; color:#6B6B6B;">Check-out</td><td style="padding:8px 0; text-align:right;">${fmtDate(opts.checkOut)}</td></tr>
      <tr><td style="padding:8px 0; color:#6B6B6B;">Total</td><td style="padding:8px 0; text-align:right;">${fmtMoney(opts.amountPaid)}</td></tr>
    </table>
    ${opts.coveredGuestName ? `<p style="font-family:'Jost',sans-serif; font-size:14px;"><em>${opts.coveredGuestName}'s room has also been reserved under your reservation.</em></p>` : ""}
  `;
  await getResend().emails.send({ from: FROM, to: opts.to, subject: "You're confirmed at Gilbertsville Farmhouse", html: wrap(body) });
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
  const body = `
    <h1 style="font-family:'Cormorant Garamond',serif; font-size:32px; font-weight:500; margin:0 0 16px;">Your room is taken care of.</h1>
    <p style="font-family:'Jost',sans-serif; font-size:16px; line-height:1.6;">Dear ${opts.guestName.split(" ")[0]},</p>
    <p style="font-family:'Jost',sans-serif; font-size:16px; line-height:1.6;"><strong>${opts.payerName.split(" ")[0]}</strong> has reserved your room for <strong>${opts.weddingName}</strong>. You're confirmed — see you soon.</p>
    <table style="font-family:'Jost',sans-serif; font-size:14px; width:100%; margin:24px 0; border-collapse:collapse;">
      <tr><td style="padding:8px 0; color:#6B6B6B;">Section</td><td style="padding:8px 0; text-align:right;">${opts.sectionName}</td></tr>
      <tr><td style="padding:8px 0; color:#6B6B6B;">Check-in</td><td style="padding:8px 0; text-align:right;">${fmtDate(opts.checkIn)}</td></tr>
      <tr><td style="padding:8px 0; color:#6B6B6B;">Check-out</td><td style="padding:8px 0; text-align:right;">${fmtDate(opts.checkOut)}</td></tr>
    </table>
    <p style="font-family:'Jost',sans-serif; font-size:14px; color:#6B6B6B;">Your planning team will be in touch with arrival details.</p>
  `;
  await getResend().emails.send({ from: FROM, to: opts.to, subject: "Your room at Gilbertsville Farmhouse is taken care of", html: wrap(body) });
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
}) {
  const to = process.env.BRANDON_NOTIFICATION_EMAIL;
  if (!to) return;
  const body = `
    <h2 style="font-family:'Cormorant Garamond',serif; font-size:24px; margin:0 0 16px;">New lodging payment${opts.cotRequested ? " · 🛏️ COT REQUESTED" : ""}</h2>
    ${opts.cotRequested ? `<div style="background:#C9A84C; color:#1A1A1A; padding:12px; margin-bottom:16px; font-family:'Jost',sans-serif; font-size:14px; text-align:center; letter-spacing:0.08em; text-transform:uppercase;">3rd guest / cot setup requested · ${fmtMoney(opts.cotFee ?? 0)}</div>` : ""}
    <table style="font-family:'Jost',sans-serif; font-size:14px; width:100%; border-collapse:collapse;">
      <tr><td style="padding:6px 0; color:#6B6B6B;">Wedding</td><td style="padding:6px 0; text-align:right;">${opts.weddingName}</td></tr>
      <tr><td style="padding:6px 0; color:#6B6B6B;">Guest</td><td style="padding:6px 0; text-align:right;">${opts.guestName}</td></tr>
      ${opts.secondaryGuestName ? `<tr><td style="padding:6px 0; color:#6B6B6B;">Covering</td><td style="padding:6px 0; text-align:right;">${opts.secondaryGuestName}</td></tr>` : ""}
      <tr><td style="padding:6px 0; color:#6B6B6B;">Section</td><td style="padding:6px 0; text-align:right;">${opts.sectionName}</td></tr>
      ${opts.checkIn ? `<tr><td style="padding:6px 0; color:#6B6B6B;">Dates</td><td style="padding:6px 0; text-align:right;">${fmtDate(opts.checkIn)} → ${fmtDate(opts.checkOut)}</td></tr>` : ""}
      <tr><td style="padding:6px 0; color:#6B6B6B;">Type</td><td style="padding:6px 0; text-align:right;">${opts.paymentType === "deposit" ? "Deposit (50%)" : "Paid in full"}</td></tr>
      <tr><td style="padding:6px 0; color:#6B6B6B;">Amount</td><td style="padding:6px 0; text-align:right;">${fmtMoney(opts.amount)}</td></tr>
    </table>
  `;
  await getResend().emails.send({ from: FROM, to, subject: `[Lodging${opts.cotRequested ? " · COT" : ""}] ${opts.guestName} — ${opts.paymentType === "deposit" ? "Deposit" : "Paid"} ${fmtMoney(opts.amount)}`, html: wrap(body) });
}

export async function sendPaymentFailedEmail(opts: { to: string; guestName: string; weddingName: string }) {
  const body = `
    <h1 style="font-family:'Cormorant Garamond',serif; font-size:28px; font-weight:500; margin:0 0 16px;">A small hiccup with your reservation</h1>
    <p style="font-family:'Jost',sans-serif; font-size:16px; line-height:1.6;">Dear ${opts.guestName.split(" ")[0]},</p>
    <p style="font-family:'Jost',sans-serif; font-size:16px; line-height:1.6;">Your scheduled payment for <strong>${opts.weddingName}</strong> didn't go through. No action needed yet — please reach out to your planning team and we'll help you sort it out.</p>
  `;
  await getResend().emails.send({ from: FROM, to: opts.to, subject: "Action needed — payment issue with your Gilbertsville reservation", html: wrap(body) });
}