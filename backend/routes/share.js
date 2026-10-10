const express = require("express");
const { pipeline } = require("stream");
const db = require("../db");
const storage = require("../utils/storage");
const { wrap, fail, contentDisposition } = require("../utils/http");

const router = express.Router();

async function getSharedDoc(req, res) {
  const doc = await db.one("SELECT * FROM documents WHERE share_token = $1", [req.params.token]);
  if (!doc) {
    fail(res, 404, "SHARE_INVALID", "This share link is invalid or has been revoked.");
    return null;
  }
  return doc;
}

async function sendShared(res, doc, disposition) {
  const file = await storage.getFile(doc.storage_key);
  if (!file) return fail(res, 404, "FILE_MISSING", "The file couldn't be found in storage.");
  res.setHeader("Content-Type", doc.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", contentDisposition(disposition, doc.original_filename));
  if (file.contentLength) res.setHeader("Content-Length", file.contentLength);
  pipeline(file.body, res, (err) => {
    if (err) console.error("[storage] stream error:", err.message);
  });
}

// Info about the shared document (for a simple share landing page)
router.get(
  "/:token",
  wrap(async (req, res) => {
    const doc = await getSharedDoc(req, res);
    if (!doc) return;
    res.json({
      name: doc.name,
      originalFilename: doc.original_filename,
      mimeType: doc.mime_type,
      sizeBytes: doc.size_bytes,
      expiryDate: doc.expiry_date,
    });
  })
);

router.get(
  "/:token/download",
  wrap(async (req, res) => {
    const doc = await getSharedDoc(req, res);
    if (doc) await sendShared(res, doc, "attachment");
  })
);

router.get(
  "/:token/preview",
  wrap(async (req, res) => {
    const doc = await getSharedDoc(req, res);
    if (doc) await sendShared(res, doc, "inline");
  })
);

module.exports = router;
