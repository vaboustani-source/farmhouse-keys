// ─────────────────────────────────────────────────────────────
// Gilbertsville Farmhouse — Branded Email Template System
// Used by all Resend transactional emails in the lodging app
// ─────────────────────────────────────────────────────────────

// ── Shared base wrapper ───────────────────────────────────────

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>Gilbertsville Farmhouse</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings>
  <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Jost:wght@300;400;500&display=swap');
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #F5F0EB; }
    * { box-sizing: border-box; }
    a { color: #2C3E2D; }
    .preheader { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F5F0EB;font-family:'Jost',Helvetica,Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F0EB;">
    <tr>
      <td align="center" style="padding:40px 16px 24px;">

        <!-- Email card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                style="background-color:#2C3E2D;border-radius:4px 4px 0 0;">
                <tr>
                  <td align="center" style="padding:36px 40px 28px;">
                    <!-- Wordmark -->
                    <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:11px;
                      letter-spacing:4px;text-transform:uppercase;color:#C9A84C;font-weight:500;">
                      GILBERTSVILLE FARMHOUSE
                    </p>
                    <!-- Gold rule -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr><td style="padding:14px 0 0;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0"
                          align="center" width="40" style="border-top:1px solid #C9A84C;">
                          <tr><td style="font-size:0;line-height:0;">&nbsp;</td></tr>
                        </table>
                      </td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td style="background-color:#FFFFFF;border-radius:0 0 4px 4px;
              padding:48px 48px 40px;border:1px solid #E8E2D9;border-top:none;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:32px 40px 48px;">
              <p style="margin:0 0 8px;font-family:'Jost',Helvetica,Arial,sans-serif;
                font-size:11px;color:#9A9188;letter-spacing:1px;text-transform:uppercase;">
                South New Berlin, NY · Otsego County
              </p>
              <p style="margin:0;font-family:'Jost',Helvetica,Arial,sans-serif;
                font-size:11px;color:#B8AFA6;">
                <a href="https://gilbertsvillefarmhouse.com"
                  style="color:#9A9188;text-decoration:none;">gilbertsvillefarmhouse.com</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Email card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ── Shared UI primitives ──────────────────────────────────────

function heading(text: string): string {
  return `<h1 style="margin:0 0 8px;font-family:'Cormorant Garamond',Georgia,serif;
    font-size:32px;font-weight:400;color:#1A1A1A;line-height:1.2;">${text}</h1>`;
}

function subheading(text: string): string {
  return `<p style="margin:0 0 32px;font-family:'Cormorant Garamond',Georgia,serif;
    font-size:18px;font-weight:400;color:#6B6B6B;font-style:italic;">${text}</p>`;
}

function body(text: string): string {
  return `<p style="margin:0 0 20px;font-family:'Jost',Helvetica,Arial,sans-serif;
    font-size:15px;line-height:1.7;color:#3A3A3A;font-weight:300;">${text}</p>`;
}

function rule(): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
    style="margin:28px 0;">
    <tr><td style="border-top:1px solid #E8E2D9;font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>`;
}

function goldRule(): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
    style="margin:28px 0;">
    <tr><td style="border-top:1px solid #C9A84C;font-size:0;line-height:0;opacity:0.4;">&nbsp;</td></tr>
  </table>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;font-family:'Jost',Helvetica,Arial,sans-serif;
      font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#9A9188;
      width:40%;vertical-align:top;">${label}</td>
    <td style="padding:10px 0;font-family:'Jost',Helvetica,Arial,sans-serif;
      font-size:14px;color:#1A1A1A;font-weight:400;vertical-align:top;">${value}</td>
  </tr>`;
}

function detailTable(rows: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
    style="margin:0 0 28px;">
    ${rows}
  </table>`;
}

function lineItemRow(label: string, amount: string, muted = false): string {
  const color = muted ? '#9A9188' : '#3A3A3A';
  const weight = muted ? '300' : '400';
  return `<tr>
    <td style="padding:6px 0;font-family:'Jost',Helvetica,Arial,sans-serif;
      font-size:13px;color:${color};font-weight:${weight};">${label}</td>
    <td align="right" style="padding:6px 0;font-family:'Jost',Helvetica,Arial,sans-serif;
      font-size:13px;color:${color};font-weight:${weight};">${amount}</td>
  </tr>`;
}

function totalRow(label: string, amount: string): string {
  return `<tr>
    <td style="padding:14px 0 6px;font-family:'Jost',Helvetica,Arial,sans-serif;
      font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#2C3E2D;
      font-weight:500;border-top:1px solid #E8E2D9;">${label}</td>
    <td align="right" style="padding:14px 0 6px;font-family:'Cormorant Garamond',Georgia,serif;
      font-size:20px;color:#2C3E2D;font-weight:500;border-top:1px solid #E8E2D9;">${amount}</td>
  </tr>`;
}

function ctaButton(text: string, url: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0"
    style="margin:32px 0 8px;">
    <tr>
      <td style="background-color:#2C3E2D;border-radius:2px;">
        <a href="${url}" target="_blank"
          style="display:inline-block;padding:16px 36px;font-family:'Jost',Helvetica,Arial,sans-serif;
          font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#FAF8F4;
          text-decoration:none;font-weight:500;">${text}</a>
      </td>
    </tr>
  </table>`;
}

function statusBadge(text: string, type: 'confirmed' | 'pending' | 'alert'): string {
  const colors = {
    confirmed: { bg: '#2C3E2D', text: '#C9A84C' },
    pending:   { bg: '#F5EDE6', text: '#9A9188' },
    alert:     { bg: '#FDF3F0', text: '#C0392B' },
  };
  const c = colors[type];
  return `<span style="display:inline-block;padding:4px 12px;background-color:${c.bg};
    border-radius:2px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:10px;
    letter-spacing:2px;text-transform:uppercase;color:${c.text};font-weight:500;">${text}</span>`;
}

function coveredGuestCard(guestName: string, sectionName: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
    style="margin:24px 0;background-color:#FAF8F4;border:1px solid #E8E2D9;
    border-left:3px solid #C9A84C;border-radius:2px;">
    <tr>
      <td style="padding:20px 24px;">
        <p style="margin:0 0 4px;font-family:'Jost',Helvetica,Arial,sans-serif;
          font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;">
          Also confirmed
        </p>
        <p style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;
          font-size:18px;color:#1A1A1A;">${guestName} · ${sectionName}</p>
      </td>
    </tr>
  </table>`;
}

function scheduleBlock(depositAmount: string, finalAmount: string, finalDate: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
    style="margin:24px 0;background-color:#FAF8F4;border:1px solid #E8E2D9;border-radius:2px;">
    <tr>
      <td style="padding:24px;">
        <p style="margin:0 0 16px;font-family:'Jost',Helvetica,Arial,sans-serif;
          font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9A9188;">
          Payment schedule
        </p>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="font-family:'Jost',Helvetica,Arial,sans-serif;font-size:13px;color:#3A3A3A;">
              Charged today</td>
            <td align="right" style="font-family:'Cormorant Garamond',Georgia,serif;
              font-size:18px;color:#2C3E2D;">${depositAmount}</td>
          </tr>
          <tr><td colspan="2" style="padding:4px 0;"></td></tr>
          <tr>
            <td style="font-family:'Jost',Helvetica,Arial,sans-serif;font-size:13px;color:#9A9188;">
              Due ${finalDate}</td>
            <td align="right" style="font-family:'Cormorant Garamond',Georgia,serif;
              font-size:18px;color:#9A9188;">${finalAmount}</td>
          </tr>
        </table>
        <p style="margin:14px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;
          font-size:12px;color:#B8AFA6;font-weight:300;">
          Your card will be charged automatically — no further action needed.
        </p>
      </td>
    </tr>
  </table>`;
}

// ─────────────────────────────────────────────────────────────
// EMAIL 1 — Booking Invitation (admin sends to guest)
// ─────────────────────────────────────────────────────────────

export interface InvitationEmailProps {
  guestFirstName: string;
  coupleNames: string;
  weddingName: string;
  sectionName: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  guestNightlyRate: number;
  bookingUrl: string;
  rsvpDeadline?: string;
}

export function invitationEmail(p: InvitationEmailProps): { subject: string; html: string } {
  const subject = `Your room at ${p.weddingName} is waiting for you`;
  const total = (p.guestNightlyRate * p.nights).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const html = baseTemplate(`
    ${heading(`${p.guestFirstName},`)}
    ${subheading(`${p.coupleNames} have reserved a place for you.`)}

    ${body(`You're invited to stay on the estate for the weekend. A room has been held for you in <strong>${p.sectionName}</strong> — all that's left is to confirm your reservation.`)}

    ${rule()}

    ${detailTable(`
      ${detailRow('Wedding', p.weddingName)}
      ${detailRow('Arrival', p.checkInDate)}
      ${detailRow('Departure', p.checkOutDate)}
      ${detailRow('Lodging', p.sectionName)}
      ${detailRow('Rate', `${(p.guestNightlyRate).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}/night · ${p.nights} nights`)}
    `)}

    ${rule()}

    ${p.rsvpDeadline ? body(`Reserve by <strong>${p.rsvpDeadline}</strong> to secure your room.`) : ''}

    ${ctaButton('Reserve your room', p.bookingUrl)}

    ${body(`Questions? Reach out to your planning team — they'll take care of you.`)}
  `);

  return { subject, html };
}

// ─────────────────────────────────────────────────────────────
// EMAIL 2 — Deposit Confirmed (split 50/50)
// ─────────────────────────────────────────────────────────────

export interface DepositConfirmedEmailProps {
  guestFirstName: string;
  weddingName: string;
  sectionName: string;
  checkInDate: string;
  checkOutDate: string;
  baseAmount: number;
  addonAmount: number;
  resortFee: number;
  taxAmount: number;
  totalAmount: number;
  depositAmount: number;
  finalAmount: number;
  finalChargeDate: string;
  addonsSelected?: { name: string; price: number }[];
  coveredGuestName?: string;
  coveredGuestSection?: string;
}

export function depositConfirmedEmail(p: DepositConfirmedEmailProps): { subject: string; html: string } {
  const subject = `Your room at Gilbertsville Farmhouse is reserved`;
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const addonRows = (p.addonsSelected || [])
    .map(a => lineItemRow(a.name, fmt(a.price), true))
    .join('');

  const html = baseTemplate(`
    ${statusBadge('Deposit confirmed', 'confirmed')}
    <div style="margin-top:24px;">
      ${heading('Your room is reserved.')}
      ${subheading(p.weddingName)}
    </div>

    ${body(`Your deposit is in — your room in <strong>${p.sectionName}</strong> is held. The remaining balance will be charged automatically closer to the weekend.`)}

    ${rule()}

    ${detailTable(`
      ${detailRow('Lodging', p.sectionName)}
      ${detailRow('Arrival', p.checkInDate)}
      ${detailRow('Departure', p.checkOutDate)}
    `)}

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
      style="margin:0 0 28px;">
      ${lineItemRow('Lodging', fmt(p.baseAmount))}
      ${addonRows}
      ${lineItemRow('Resort Fee', fmt(p.resortFee), true)}
      ${lineItemRow('NY Sales Tax (8%)', fmt(p.taxAmount), true)}
      ${totalRow('Total', fmt(p.totalAmount))}
    </table>

    ${scheduleBlock(fmt(p.depositAmount), fmt(p.finalAmount), p.finalChargeDate)}

    ${p.coveredGuestName ? coveredGuestCard(p.coveredGuestName, p.coveredGuestSection || '') : ''}

    ${goldRule()}

    <p style="margin:0 0 8px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9A9188;">CANCELLATION POLICY</p>
    <p style="margin:0 0 20px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#9A9188;font-weight:300;">Cancellation is possible up to 45 days prior to the first check-in date of your stay. After that time, the reservation is fully non-refundable.</p>

    ${body('Your planning team will be in touch with arrival details as the weekend approaches.')}
  `);

  return { subject, html };
}

// ─────────────────────────────────────────────────────────────
// EMAIL 3 — Paid in Full Confirmation
// ─────────────────────────────────────────────────────────────

export interface PaidConfirmedEmailProps {
  guestFirstName: string;
  weddingName: string;
  sectionName: string;
  checkInDate: string;
  checkOutDate: string;
  baseAmount: number;
  addonAmount: number;
  resortFee: number;
  taxAmount: number;
  totalAmount: number;
  addonsSelected?: { name: string; price: number }[];
  coveredGuestName?: string;
  coveredGuestSection?: string;
}

export function paidConfirmedEmail(p: PaidConfirmedEmailProps): { subject: string; html: string } {
  const subject = `You're confirmed at Gilbertsville Farmhouse`;
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const addonRows = (p.addonsSelected || [])
    .map(a => lineItemRow(a.name, fmt(a.price), true))
    .join('');

  const html = baseTemplate(`
    ${statusBadge('Confirmed', 'confirmed')}
    <div style="margin-top:24px;">
      ${heading('You\'re confirmed.')}
      ${subheading(p.weddingName)}
    </div>

    ${body(`Everything is in order. Your room in <strong>${p.sectionName}</strong> is confirmed and paid — we look forward to welcoming you.`)}

    ${rule()}

    ${detailTable(`
      ${detailRow('Lodging', p.sectionName)}
      ${detailRow('Arrival', p.checkInDate)}
      ${detailRow('Departure', p.checkOutDate)}
    `)}

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
      style="margin:0 0 28px;">
      ${lineItemRow('Lodging', fmt(p.baseAmount))}
      ${addonRows}
      ${lineItemRow('Resort Fee', fmt(p.resortFee), true)}
      ${lineItemRow('NY Sales Tax (8%)', fmt(p.taxAmount), true)}
      ${totalRow('Total paid', fmt(p.totalAmount))}
    </table>

    ${p.coveredGuestName ? coveredGuestCard(p.coveredGuestName, p.coveredGuestSection || '') : ''}

    ${goldRule()}

    <p style="margin:0 0 8px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9A9188;">CANCELLATION POLICY</p>
    <p style="margin:0 0 20px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#9A9188;font-weight:300;">Cancellation is possible up to 45 days prior to the first check-in date of your stay. After that time, the reservation is fully non-refundable.</p>

    ${body('Your planning team will be in touch with arrival details as the weekend approaches.')}
  `);

  return { subject, html };
}

// ─────────────────────────────────────────────────────────────
// EMAIL 4 — Final Payment Confirmed (scheduled charge)
// ─────────────────────────────────────────────────────────────

export interface FinalPaymentEmailProps {
  guestFirstName: string;
  weddingName: string;
  sectionName: string;
  checkInDate: string;
  finalAmount: number;
  totalAmount: number;
}

export function finalPaymentEmail(p: FinalPaymentEmailProps): { subject: string; html: string } {
  const subject = `Your final payment is confirmed — see you soon`;
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const html = baseTemplate(`
    ${statusBadge('Fully settled', 'confirmed')}
    <div style="margin-top:24px;">
      ${heading('All settled.')}
      ${subheading(p.weddingName)}
    </div>

    ${body(`Your final payment of <strong>${fmt(p.finalAmount)}</strong> has been received. Your reservation in <strong>${p.sectionName}</strong> is fully confirmed.`)}

    ${rule()}

    ${detailTable(`
      ${detailRow('Lodging', p.sectionName)}
      ${detailRow('Arrival', p.checkInDate)}
      ${detailRow('Total paid', fmt(p.totalAmount))}
    `)}

    ${goldRule()}

    ${body(`We look forward to welcoming you. The estate will be ready.`)}
  `);

  return { subject, html };
}

// ─────────────────────────────────────────────────────────────
// EMAIL 5 — Covered Guest Notification
// ─────────────────────────────────────────────────────────────

export interface CoveredGuestEmailProps {
  guestFirstName: string;
  payerFirstName: string;
  weddingName: string;
  sectionName: string;
  checkInDate: string;
  checkOutDate: string;
}

export function coveredGuestEmail(p: CoveredGuestEmailProps): { subject: string; html: string } {
  const subject = `Your room at Gilbertsville Farmhouse is taken care of`;

  const html = baseTemplate(`
    ${statusBadge('Confirmed', 'confirmed')}
    <div style="margin-top:24px;">
      ${heading(`${p.guestFirstName},`)}
      ${subheading('Your room is taken care of.')}
    </div>

    ${body(`${p.payerFirstName} has reserved and paid for your room at the estate. You're confirmed — nothing further is needed from you.`)}

    ${rule()}

    ${detailTable(`
      ${detailRow('Wedding', p.weddingName)}
      ${detailRow('Lodging', p.sectionName)}
      ${detailRow('Arrival', p.checkInDate)}
      ${detailRow('Departure', p.checkOutDate)}
    `)}

    ${goldRule()}

    ${body('Your planning team will be in touch with arrival details as the weekend approaches.')}

    ${body('We look forward to welcoming you.')}
  `);

  return { subject, html };
}

// ─────────────────────────────────────────────────────────────
// EMAIL 6 — Payment Failed
// ─────────────────────────────────────────────────────────────

export interface PaymentFailedEmailProps {
  guestFirstName: string;
  weddingName: string;
  sectionName: string;
  failedAmount: number;
  retryUrl: string;
  retryDeadline: string;
}

export function paymentFailedEmail(p: PaymentFailedEmailProps): { subject: string; html: string } {
  const subject = `Action needed — payment issue with your Gilbertsville reservation`;
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const html = baseTemplate(`
    ${statusBadge('Attention needed', 'alert')}
    <div style="margin-top:24px;">
      ${heading('A payment didn\'t go through.')}
      ${subheading(p.weddingName)}
    </div>

    ${body(`Your scheduled payment of <strong>${fmt(p.failedAmount)}</strong> for <strong>${p.sectionName}</strong> was declined. No changes have been made to your reservation — your room is still held.`)}

    ${body(`Please update your payment method by <strong>${p.retryDeadline}</strong> to keep your reservation secure.`)}

    ${ctaButton('Update payment method', p.retryUrl)}

    ${rule()}

    ${body('If you have any questions, reach out to your planning team — they\'ll sort it out with you.')}
  `);

  return { subject, html };
}

// ─────────────────────────────────────────────────────────────
// EMAIL 7 — Admin Notification (new booking)
// ─────────────────────────────────────────────────────────────

export interface AdminNotificationEmailProps {
  guestName: string;
  guestEmail: string;
  weddingName: string;
  sectionName: string;
  paymentType: 'deposit' | 'full';
  amountCollected: number;
  scheduledChargeDate?: string;
  scheduledChargeAmount?: number;
  coveredGuestName?: string;
  coveredGuestSection?: string;
  adminEventUrl: string;
}

export function adminNotificationEmail(p: AdminNotificationEmailProps): { subject: string; html: string } {
  const subject = `New booking — ${p.guestName} · ${p.weddingName}`;
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const html = baseTemplate(`
    ${statusBadge(p.paymentType === 'deposit' ? 'Deposit received' : 'Paid in full', 'confirmed')}
    <div style="margin-top:24px;">
      ${heading('New reservation.')}
      ${subheading(p.weddingName)}
    </div>

    ${detailTable(`
      ${detailRow('Guest', p.guestName)}
      ${detailRow('Email', p.guestEmail)}
      ${detailRow('Section', p.sectionName)}
      ${detailRow('Collected', fmt(p.amountCollected))}
      ${p.scheduledChargeDate ? detailRow('Scheduled charge', `${fmt(p.scheduledChargeAmount || 0)} on ${p.scheduledChargeDate}`) : ''}
    `)}

    ${p.coveredGuestName ? coveredGuestCard(p.coveredGuestName, p.coveredGuestSection || '') : ''}

    ${ctaButton('View in admin', p.adminEventUrl)}
  `);

  return { subject, html };
}
