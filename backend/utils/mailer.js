const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(
      "[mailer] SMTP is not configured (see backend/.env.example). Expiry emails will be logged to the console instead of sent."
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  return transporter;
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Reminder email text in each supported language.
const COPY = {
  en: {
    subject: ({ doc, n }) => `"${doc}" expires in ${n} day${n === 1 ? "" : "s"} - PatraKosh`,
    heading: "PatraKosh expiry reminder",
    hi: (u) => `Hi ${u},`,
    body: ({ doc, date, n }) =>
      `Your document "${doc}" on PatraKosh is set to expire on ${date} (${n} day${n === 1 ? "" : "s"} from now).`,
    action: "Log in to PatraKosh to renew, re-upload, or download it before it expires.",
    footer: "This is an automated reminder from PatraKosh.",
  },
  hi: {
    subject: ({ doc, n }) => `"${doc}" ${n} दिन में समाप्त हो रहा है - PatraKosh`,
    heading: "PatraKosh समाप्ति अनुस्मारक",
    hi: (u) => `नमस्ते ${u},`,
    body: ({ doc, date, n }) => `PatraKosh पर आपका दस्तावेज़ "${doc}" ${date} को समाप्त हो रहा है (${n} दिन बाकी)।`,
    action: "इसे नवीनीकृत करने, दोबारा अपलोड करने या समाप्त होने से पहले डाउनलोड करने के लिए PatraKosh में लॉग इन करें।",
    footer: "यह PatraKosh की ओर से एक स्वचालित अनुस्मारक है।",
  },
  mr: {
    subject: ({ doc, n }) => `"${doc}" ${n} दिवसांत संपत आहे - PatraKosh`,
    heading: "PatraKosh मुदत स्मरणपत्र",
    hi: (u) => `नमस्कार ${u},`,
    body: ({ doc, date, n }) => `PatraKosh वरील तुमचे दस्तऐवज "${doc}" ${date} रोजी संपत आहे (${n} दिवस शिल्लक).`,
    action: "ते नूतनीकरण करण्यासाठी, पुन्हा अपलोड करण्यासाठी किंवा मुदत संपण्यापूर्वी डाउनलोड करण्यासाठी PatraKosh मध्ये लॉग इन करा.",
    footer: "हे PatraKosh कडून आलेले स्वयंचलित स्मरणपत्र आहे.",
  },
};

async function sendExpiryWarningEmail({ to, userName, documentName, expiryDate, daysLeft, lang }) {
  const c = COPY[lang] || COPY.en;
  const vars = { doc: documentName, date: expiryDate, n: daysLeft };

  const subject = c.subject(vars);
  const text = `${c.hi(userName)}\n\n${c.body(vars)}\n\n${c.action}\n\n- PatraKosh`;
  const html = `
    <div style="font-family: 'Noto Sans Devanagari', Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#000082;">${esc(c.heading)}</h2>
      <p>${esc(c.hi(userName))}</p>
      <p>${esc(c.body(vars))}</p>
      <p>${esc(c.action)}</p>
      <p style="color:#888; font-size: 12px; margin-top: 24px;">${esc(c.footer)}</p>
    </div>
  `;

  const t = getTransporter();
  if (!t) {
    console.log(`[mailer] (SMTP not set up) Would email ${to}:\nSubject: ${subject}\n${text}\n`);
    return { simulated: true };
  }

  return t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html });
}

module.exports = { sendExpiryWarningEmail };
