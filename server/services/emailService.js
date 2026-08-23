const nodemailer = require("nodemailer");

const supportEmail = process.env.SUPPORT_EMAIL || "support@basera.pk";
const whatsapp = process.env.SUPPORT_WHATSAPP || "0300-BASERA";
const appUrl = (process.env.PUBLIC_APP_URL || process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");

const money = (amount) => `PKR ${Number(amount || 0).toLocaleString("en-PK")}`;

const branded = ({ subject, preview, body, ctaText, ctaUrl }) => {
  const action = ctaText && ctaUrl
    ? `<p style="margin:24px 0"><a href="${ctaUrl}" style="background:#0037b7;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">${ctaText}</a></p>`
    : "";
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.6;background:#f6f8ff;padding:24px">
      <div style="max-width:640px;margin:auto;background:#fff;border:1px solid #d8dfef;border-radius:12px;padding:28px">
        <p style="font-size:18px;font-weight:800;color:#0037b7;margin:0 0 20px">Basera</p>
        <p style="display:none;max-height:0;overflow:hidden">${preview}</p>
        ${body}
        ${action}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="font-size:12px;color:#64748b">Need help? Reply to this email, contact ${supportEmail}, or WhatsApp ${whatsapp}.</p>
      </div>
    </div>`;
  const text = `${subject}\n\n${preview}\n\n${body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}${ctaUrl ? `\n\n${ctaText}: ${ctaUrl}` : ""}`;
  return { subject, preview, html, text };
};

const templates = {
  "E-01": ({ studentName = "Student" } = {}) => branded({
    subject: "Welcome to Basera - Verify Your Email",
    preview: "Your account is ready. Verify your email to start booking verified accommodation.",
    body: `<p>Hi ${studentName},</p><p>Welcome to Basera. Verify your email and complete your student profile to book verified hostels and rooms with escrow protection.</p>`,
    ctaText: "Open Basera",
    ctaUrl: `${appUrl}/student/dashboard`
  }),
  "E-02": ({ hostName = "Host" } = {}) => branded({
    subject: "Welcome Host - Start Listing Your Property on Basera",
    preview: "Upload your identity proof, property proof, and sign the Host agreement.",
    body: `<p>Hi ${hostName},</p><p>Your Host account is created. Complete identity proof, property proof, payout details, and the digital Host agreement before your listing is reviewed.</p>`,
    ctaText: "Complete Onboarding",
    ctaUrl: `${appUrl}/landlord/onboarding`
  }),
  "E-03": ({ otp = "000000" } = {}) => branded({
    subject: `Your Basera Verification Code: ${otp}`,
    preview: "Use this OTP to finish your secure action.",
    body: `<p>Your Basera verification code is <strong>${otp}</strong>.</p><p>This code expires soon. Never share it with anyone.</p>`
  }),
  "E-04": ({ studentName = "A student", property = "your room" } = {}) => branded({
    subject: `New Booking Request - ${studentName} wants your room`,
    preview: "Review the request from your Host dashboard.",
    body: `<p>${studentName} has requested <strong>${property}</strong>.</p><p>Review student details, stay dates, and payment status before accepting.</p>`,
    ctaText: "Review Request",
    ctaUrl: `${appUrl}/host/dashboard`
  }),
  "E-05": ({ studentName = "Student", property = "Basera property", moveIn = "", hostName = "Host", hostPhone = "" } = {}) => branded({
    subject: `Your Booking is Confirmed! Move-in: ${moveIn}`,
    preview: "Everything is ready. Here are your move-in details and Host contact.",
    body: `<p>Hi ${studentName},</p><p>Your booking at <strong>${property}</strong> is confirmed.</p><p><strong>Host contact:</strong> ${hostName} ${hostPhone}</p><p><strong>What to bring:</strong> Original CNIC, one CNIC copy, two passport photos, and your confirmation letter.</p>`,
    ctaText: "Download Confirmation Letter",
    ctaUrl: `${appUrl}/student/bookings`
  }),
  "E-06": ({ studentName = "Student", property = "the selected room" } = {}) => branded({
    subject: "Booking Update - We'll Help You Find Another Room",
    preview: "Your booking request was not accepted. Similar verified options are available.",
    body: `<p>Hi ${studentName},</p><p>Your request for <strong>${property}</strong> was declined or expired. Your payment hold, if any, will be released according to policy.</p>`,
    ctaText: "Find Another Room",
    ctaUrl: `${appUrl}/rooms`
  }),
  "E-07": ({ amount = 0, property = "your booking" } = {}) => branded({
    subject: `Payment Confirmed - ${money(amount)} Received for ${property}`,
    preview: "Your receipt is available in your dashboard.",
    body: `<p>We received your payment of <strong>${money(amount)}</strong> for ${property}.</p><p>Your funds are protected under Basera escrow rules.</p>`,
    ctaText: "Download Receipt",
    ctaUrl: `${appUrl}/student/payments`
  }),
  "E-08": ({ hostName = "Host", amount = 0, property = "property" } = {}) => branded({
    subject: `Payout Sent - ${money(amount)} Transferred to Your Account`,
    preview: `Your rent payout for ${property} has been processed.`,
    body: `<p>Hi ${hostName},</p><p>Your payout for <strong>${property}</strong> has been sent.</p><p><strong>Net payout:</strong> ${money(amount)}</p>`,
    ctaText: "Download Payout Statement",
    ctaUrl: `${appUrl}/host/dashboard`
  }),
  "E-09": ({ amount = 0, property = "your room", dueDate = "" } = {}) => branded({
    subject: "Rent Due in 7 Days - Pay Easily on Basera",
    preview: `Your rent of ${money(amount)} is due on ${dueDate}.`,
    body: `<p>Your rent for <strong>${property}</strong> is due on ${dueDate}.</p><p><strong>Amount:</strong> ${money(amount)}. Pay through Basera to keep escrow and dispute protection active.</p>`,
    ctaText: "Pay Rent",
    ctaUrl: `${appUrl}/student/payments`
  }),
  "E-10": ({ amount = 0, dueDate = "" } = {}) => branded({
    subject: "Rent Due Tomorrow - Avoid Late Fees",
    preview: `Your rent of ${money(amount)} is due tomorrow.`,
    body: `<p>Your rent payment is due on ${dueDate || "tomorrow"}.</p><p>Pay before the grace period ends to avoid late fees and booking restrictions.</p>`,
    ctaText: "Pay Now",
    ctaUrl: `${appUrl}/student/payments`
  }),
  "E-11": ({ property = "your property", tenantName = "a tenant" } = {}) => branded({
    subject: "Host Alert - Tenant Payment Due Tomorrow",
    preview: "A tenant has rent due soon.",
    body: `<p>${tenantName} has a rent payment due soon for <strong>${property}</strong>.</p><p>Please do not request off-platform payment. Basera will continue automated reminders.</p>`,
    ctaText: "View Tenant Ledger",
    ctaUrl: `${appUrl}/host/dashboard`
  }),
  "E-12": ({ amount = 0, property = "your room" } = {}) => branded({
    subject: `Late Fee Invoice - ${money(amount)} Added to Your Account`,
    preview: "A late fee was added after the configured grace period.",
    body: `<p>A late fee of <strong>${money(amount)}</strong> has been added for ${property}.</p><p>The invoice is available in your payments dashboard.</p>`,
    ctaText: "View Invoice",
    ctaUrl: `${appUrl}/student/payments`
  }),
  "E-13": ({ amount = 0, status = "released" } = {}) => branded({
    subject: "Security Deposit Update",
    preview: `Your deposit has been ${status}.`,
    body: `<p>Your security deposit status is <strong>${status}</strong>.</p><p>Amount: ${money(amount)}. You can dispute deductions within the policy window.</p>`,
    ctaText: "View Deposit Case",
    ctaUrl: `${appUrl}/student/payments`
  }),
  "E-14": ({ hostName = "Host", property = "your listing" } = {}) => branded({
    subject: "Verification Approved - Your Basera Listing is Ready",
    preview: "Your verification approval letter is available.",
    body: `<p>Hi ${hostName},</p><p>Your listing <strong>${property}</strong> has been approved. Keep availability and prices accurate to maintain your verified status.</p>`,
    ctaText: "Open Host Dashboard",
    ctaUrl: `${appUrl}/host/dashboard`
  }),
  "E-15": ({ caseId = "HH-DSP", title = "Dispute opened" } = {}) => branded({
    subject: `Dispute Opened - ${caseId}`,
    preview: "A dispute case has been opened and escrow is protected until resolution.",
    body: `<p>A dispute has been opened: <strong>${title}</strong>.</p><p>Case ID: ${caseId}. Upload evidence and wait for Admin review.</p>`,
    ctaText: "View Case",
    ctaUrl: `${appUrl}/student/disputes`
  }),
  "E-16": ({ caseId = "HH-DSP", outcome = "Resolved" } = {}) => branded({
    subject: `Dispute Resolved - ${caseId}`,
    preview: "The dispute decision and resolution letter are available.",
    body: `<p>Dispute <strong>${caseId}</strong> has been resolved.</p><p>Outcome: ${outcome}. The financial decision will be reflected in the ledger.</p>`,
    ctaText: "Download Resolution Letter",
    ctaUrl: `${appUrl}/student/disputes`
  })
};

const aliases = {
  STUDENT_WELCOME: "E-01",
  HOST_WELCOME: "E-02",
  OTP: "E-03",
  BOOKING_REQUEST: "E-04",
  BOOKING_CONFIRMED: "E-05",
  BOOKING_DECLINED: "E-06",
  PAYMENT_RECEIVED: "E-07",
  PAYOUT_SENT: "E-08",
  RENT_REMINDER_7D: "E-09",
  RENT_REMINDER_1D: "E-10",
  HOST_RENT_ALERT: "E-11",
  LATE_FEE_INVOICE: "E-12",
  DEPOSIT_UPDATE: "E-13",
  VERIFICATION_APPROVED: "E-14",
  DISPUTE_OPENED: "E-15",
  DISPUTE_RESOLVED: "E-16"
};

const resolveTemplate = (template) => aliases[template] || template;

const renderEmail = (template, data) => {
  const key = resolveTemplate(template);
  const builder = templates[key];
  if (!builder) throw new Error(`Unknown email template: ${template}`);
  return { template: key, ...builder(data) };
};

const createTransport = () => {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });
  }

  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      auth: { user: "apikey", pass: process.env.SENDGRID_API_KEY }
    });
  }

  return null;
};

const sendEmail = async ({ to, template, data, attachments = [] }) => {
  const rendered = renderEmail(template, data);
  const transport = createTransport();
  const from = process.env.EMAIL_FROM || process.env.GMAIL_USER || "Basera <no-reply@basera.pk>";

  if (!transport) {
    return { queued: true, mode: "demo", to, from, attachments: attachments.length, ...rendered };
  }

  const info = await transport.sendMail({
    from,
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    attachments
  });

  return { queued: true, mode: "smtp", to, from, messageId: info.messageId, template: rendered.template };
};

module.exports = { renderEmail, sendEmail, templates, aliases };
