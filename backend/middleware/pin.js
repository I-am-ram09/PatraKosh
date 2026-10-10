const jwt = require("jsonwebtoken");
const { fail } = require("../utils/http");

// Opening, downloading or sharing a document needs a short-lived "PIN token",
// which the server only hands out after the correct PIN has been entered.
function requirePin(req, res, next) {
  const token = req.headers["x-pin-token"];
  if (!token) return fail(res, 403, "PIN_REQUIRED", "Enter your PIN to open documents.");
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    if (p.scope !== "pin" || p.sub !== req.user.id) throw new Error("wrong scope");
    next();
  } catch (err) {
    return fail(res, 403, "PIN_REQUIRED", "Enter your PIN to open documents.");
  }
}

module.exports = { requirePin };
