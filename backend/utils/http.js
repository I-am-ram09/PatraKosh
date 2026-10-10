// Small helpers shared by the routes.

// Express 4 doesn't catch rejected promises from async handlers - this does.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Every error carries a machine-readable `code` so the frontend can show it in the
// user's language (English / Hindi / Marathi). `error` stays as an English fallback.
const fail = (res, status, code, message) => res.status(status).json({ error: message, code });

// Safe Content-Disposition for any filename, including Hindi/Marathi (Devanagari) names.
function contentDisposition(type, filename) {
  const fallback = String(filename).replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

// multer reads filenames as latin1; this restores the real UTF-8 name (e.g. "आधार.pdf").
const fixFilename = (name) => Buffer.from(name, "latin1").toString("utf8");

module.exports = { wrap, fail, contentDisposition, fixFilename };
