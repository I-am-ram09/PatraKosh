const jwt = require("jsonwebtoken");
const { fail } = require("../utils/http");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return fail(res, 401, "NOT_LOGGED_IN", "Not logged in.");

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return fail(res, 401, "SESSION_EXPIRED", "Session expired. Please log in again.");
  }
}

module.exports = { requireAuth };
