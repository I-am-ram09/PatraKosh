const express = require("express");
const multer = require("multer");
const path = require("path");
const { pipeline } = require("stream");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const storage = require("../utils/storage");
const { requireAuth } = require("../middleware/auth");
const { requirePin } = require("../middleware/pin");
const { wrap, fail, contentDisposition, fixFilename } = require("../utils/http");

const router = express.Router();

const WARNING_DAYS = Number(process.env.EXPIRY_WARNING_DAYS || 21);

// Files are held in memory just long enough to be sent to cloud storage - never written to this server's disk.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB cap

const DAY_MS = 1000 * 60 * 60 * 24;

function computeStatus(expiry_date) {
  if (!expiry_date) return "active";
  const daysLeft = Math.ceil((new Date(expiry_date) - new Date()) / DAY_MS);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= WARNING_DAYS) return "expiring_soon";
  return "active";
}

function toPublicDoc(doc) {
  const daysLeft = doc.expiry_date ? Math.ceil((new Date(doc.expiry_date) - new Date()) / DAY_MS) : null;
  return {
    id: doc.id,
    name: doc.name,
    credentials: doc.credentials,
    originalFilename: doc.original_filename,
    mimeType: doc.mime_type,
    sizeBytes: doc.size_bytes,
    expiryDate: doc.expiry_date,
    daysLeft,
    status: computeStatus(doc.expiry_date),
    shareToken: doc.share_token,
    createdAt: doc.created_at,
  };
}

// Streams a file from cloud storage to the browser.
async function sendFile(res, doc, disposition) {
  const file = await storage.getFile(doc.storage_key);
  if (!file) return fail(res, 404, "FILE_MISSING", "The file couldn't be found in storage.");
  res.setHeader("Content-Type", doc.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", contentDisposition(disposition, doc.original_filename));
  if (file.contentLength) res.setHeader("Content-Length", file.contentLength);
  pipeline(file.body, res, (err) => {
    if (err) console.error("[storage] stream error:", err.message);
  });
}

// --- Upload a new document ---
router.post(
  "/",
  requireAuth,
  upload.single("file"),
  wrap(async (req, res) => {
    if (!req.file) return fail(res, 400, "FILE_REQUIRED", "Please attach a file.");

    const { name, credentials, expiryDate } = req.body;
    if (!name || !name.trim()) return fail(res, 400, "NAME_REQUIRED", "Please give the document a name.");

    const id = uuidv4();
    const originalName = fixFilename(req.file.originalname);
    const storageKey = `${req.user.id}/${id}${path.extname(originalName).slice(0, 12)}`;

    // 1) file -> cloud storage, 2) details -> cloud database
    await storage.putFile(storageKey, req.file.buffer, req.file.mimetype);
    try {
      await db.run(
        `INSERT INTO documents
          (id, user_id, name, credentials, original_filename, storage_key, mime_type, size_bytes, expiry_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          req.user.id,
          name.trim(),
          credentials || null,
          originalName,
          storageKey,
          req.file.mimetype,
          req.file.size,
          expiryDate || null,
        ]
      );
    } catch (err) {
      await storage.deleteFile(storageKey).catch(() => {}); // don't leave an orphaned file behind
      throw err;
    }

    const doc = await db.one("SELECT * FROM documents WHERE id = $1", [id]);
    res.status(201).json({ document: toPublicDoc(doc) });
  })
);

// --- List my documents ---
router.get(
  "/",
  requireAuth,
  wrap(async (req, res) => {
    const docs = await db.many("SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC", [
      req.user.id,
    ]);
    res.json({ documents: docs.map(toPublicDoc) });
  })
);

// --- Dashboard stats ---
router.get(
  "/stats",
  requireAuth,
  wrap(async (req, res) => {
    const docs = await db.many("SELECT expiry_date FROM documents WHERE user_id = $1", [req.user.id]);
    const stats = { total: docs.length, active: 0, expiring_soon: 0, expired: 0 };
    for (const doc of docs) stats[computeStatus(doc.expiry_date)] += 1;
    res.json({ stats });
  })
);

async function findOwnedDoc(req, res) {
  const doc = await db.one("SELECT * FROM documents WHERE id = $1", [req.params.id]);
  if (!doc) {
    fail(res, 404, "DOC_NOT_FOUND", "Document not found.");
    return null;
  }
  if (doc.user_id !== req.user.id) {
    fail(res, 403, "DOC_FORBIDDEN", "You don't have access to this document.");
    return null;
  }
  return doc;
}

// --- Download (owner) ---
router.get(
  "/:id/download",
  requireAuth,
  requirePin,
  wrap(async (req, res) => {
    const doc = await findOwnedDoc(req, res);
    if (doc) await sendFile(res, doc, "attachment");
  })
);

// --- Preview (owner, inline) ---
router.get(
  "/:id/preview",
  requireAuth,
  requirePin,
  wrap(async (req, res) => {
    const doc = await findOwnedDoc(req, res);
    if (doc) await sendFile(res, doc, "inline");
  })
);

// --- Create / rotate a public share link ---
router.post(
  "/:id/share",
  requireAuth,
  requirePin,
  wrap(async (req, res) => {
    const doc = await findOwnedDoc(req, res);
    if (!doc) return;
    const token = uuidv4();
    await db.run("UPDATE documents SET share_token = $1 WHERE id = $2", [token, doc.id]);
    res.json({ shareToken: token, shareUrl: `/api/share/${token}` });
  })
);

// --- Revoke a public share link ---
router.delete(
  "/:id/share",
  requireAuth,
  wrap(async (req, res) => {
    const doc = await findOwnedDoc(req, res);
    if (!doc) return;
    await db.run("UPDATE documents SET share_token = NULL WHERE id = $1", [doc.id]);
    res.json({ ok: true });
  })
);

// --- Delete a document (file + database row) ---
router.delete(
  "/:id",
  requireAuth,
  wrap(async (req, res) => {
    const doc = await findOwnedDoc(req, res);
    if (!doc) return;
    await storage.deleteFile(doc.storage_key).catch((err) => console.error("[storage] delete failed:", err.message));
    await db.run("DELETE FROM documents WHERE id = $1", [doc.id]);
    res.json({ ok: true });
  })
);

module.exports = router;
