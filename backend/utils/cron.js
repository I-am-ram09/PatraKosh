const cron = require("node-cron");
const db = require("../db");
const { sendExpiryWarningEmail } = require("./mailer");

const WARNING_DAYS = Number(process.env.EXPIRY_WARNING_DAYS || 21);

async function checkExpiringDocuments() {
  const now = new Date();

  const docs = await db.many(
    `SELECT documents.*, users.email AS user_email, users.name AS user_name, users.lang AS user_lang
     FROM documents
     JOIN users ON users.id = documents.user_id
     WHERE documents.expiry_date IS NOT NULL
       AND documents.reminder_sent = 0`
  );

  for (const doc of docs) {
    const daysLeft = Math.ceil((new Date(doc.expiry_date) - now) / (1000 * 60 * 60 * 24));

    if (daysLeft <= WARNING_DAYS && daysLeft >= 0) {
      try {
        await sendExpiryWarningEmail({
          to: doc.user_email,
          userName: doc.user_name,
          documentName: doc.name,
          expiryDate: doc.expiry_date,
          daysLeft,
          lang: doc.user_lang,
        });
        await db.run("UPDATE documents SET reminder_sent = 1 WHERE id = $1", [doc.id]);
        console.log(`[cron] Sent expiry reminder for "${doc.name}" to ${doc.user_email}`);
      } catch (err) {
        console.error(`[cron] Failed to send reminder for document ${doc.id}:`, err.message);
      }
    }
  }
}

function startExpiryCron() {
  const schedule = process.env.CRON_SCHEDULE || "0 * * * *"; // default: once an hour
  cron.schedule(schedule, () => {
    checkExpiringDocuments().catch((err) => console.error("[cron] Error while checking expiring documents:", err));
  });
  console.log(`[cron] Expiry reminder job scheduled (${schedule})`);

  // Also run once at startup so you don't have to wait for the first tick.
  checkExpiringDocuments().catch((err) => console.error("[cron] Error on startup expiry check:", err));
}

module.exports = { startExpiryCron, checkExpiringDocuments };
