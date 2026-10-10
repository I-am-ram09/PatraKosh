const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { wrap, fail } = require("../utils/http");

const router = express.Router();
router.use(requireAuth);

const MAX_ATTEMPTS = Number(process.env.PIN_MAX_ATTEMPTS || 5);
const LOCK_MINUTES = Number(process.env.PIN_LOCK_MINUTES || 15);
const SESSION_MINUTES = Number(process.env.PIN_SESSION_MINUTES || 5);
const REAUTH_WINDOW_SEC = 10 * 60;

const validPin = (pin) => typeof pin === "string" && /^\d{4,6}$/.test(pin);
const getUser = (id) => db.one("SELECT * FROM users WHERE id = $1", [id]);

function lockedMinutes(user) {
  if (!user.pin_locked_until) return 0;
  const ms = new Date(user.pin_locked_until) - new Date();
  return ms > 0 ? Math.ceil(ms / 60000) : 0;
}

function issueToken(user) {
  const token = jwt.sign({ sub: user.id, scope: "pin" }, process.env.JWT_SECRET, {
    expiresIn: `${SESSION_MINUTES}m`,
  });
  return { pinToken: token, expiresInSec: SESSION_MINUTES * 60 };
}

// Counts a wrong try and locks the PIN after too many.
async function registerFailure(res, user) {
  const attempts = (user.pin_attempts || 0) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await db.run(
      "UPDATE users SET pin_attempts = 0, pin_locked_until = now() + ($1 || ' minutes')::interval WHERE id = $2",
      [String(LOCK_MINUTES), user.id]
    );
    return res.status(429).json({ error: "Too many wrong tries.", code: "PIN_LOCKED", m: LOCK_MINUTES });
  }
  await db.run("UPDATE users SET pin_attempts = $1 WHERE id = $2", [attempts, user.id]);
  return res.status(401).json({ error: "Wrong PIN.", code: "PIN_WRONG", n: MAX_ATTEMPTS - attempts });
}

// Is a PIN set? (Also tells a locked-out user how long to wait.)
router.get(
  "/status",
  wrap(async (req, res) => {
    const user = await getUser(req.user.id);
    if (!user) return fail(res, 404, "USER_NOT_FOUND", "User not found.");
    res.json({ hasPin: !!user.pin_hash, lockedMinutes: lockedMinutes(user) });
  })
);

// First-time PIN setup. Returns a PIN token so the person can carry straight on.
router.post(
  "/set",
  wrap(async (req, res) => {
    const { pin } = req.body;
    if (!validPin(pin)) return fail(res, 400, "PIN_INVALID_FORMAT", "PIN must be 4 to 6 digits.");
    const user = await getUser(req.user.id);
    if (user.pin_hash) return fail(res, 409, "PIN_EXISTS", "A PIN is already set.");
    await db.run("UPDATE users SET pin_hash = $1, pin_attempts = 0, pin_locked_until = NULL WHERE id = $2", [
      await bcrypt.hash(pin, 10),
      user.id,
    ]);
    res.status(201).json(issueToken(user));
  })
);

// Check the PIN -> short-lived token.
router.post(
  "/verify",
  wrap(async (req, res) => {
    const { pin } = req.body;
    if (!validPin(pin)) return fail(res, 400, "PIN_INVALID_FORMAT", "PIN must be 4 to 6 digits.");
    const user = await getUser(req.user.id);
    if (!user.pin_hash) return fail(res, 404, "PIN_NOT_SET", "No PIN set yet.");
    const m = lockedMinutes(user);
    if (m) return res.status(429).json({ error: "PIN locked.", code: "PIN_LOCKED", m });

    if (!(await bcrypt.compare(pin, user.pin_hash))) return registerFailure(res, user);

    await db.run("UPDATE users SET pin_attempts = 0, pin_locked_until = NULL WHERE id = $1", [user.id]);
    res.json(issueToken(user));
  })
);

// Change PIN (needs the current one).
router.post(
  "/change",
  wrap(async (req, res) => {
    const { currentPin, newPin } = req.body;
    if (!validPin(currentPin) || !validPin(newPin)) {
      return fail(res, 400, "PIN_INVALID_FORMAT", "PIN must be 4 to 6 digits.");
    }
    const user = await getUser(req.user.id);
    if (!user.pin_hash) return fail(res, 404, "PIN_NOT_SET", "No PIN set yet.");
    const m = lockedMinutes(user);
    if (m) return res.status(429).json({ error: "PIN locked.", code: "PIN_LOCKED", m });
    if (!(await bcrypt.compare(currentPin, user.pin_hash))) return registerFailure(res, user);

    await db.run("UPDATE users SET pin_hash = $1, pin_attempts = 0, pin_locked_until = NULL WHERE id = $2", [
      await bcrypt.hash(newPin, 10),
      user.id,
    ]);
    res.json(issueToken(user));
  })
);

// Forgot PIN: prove it's you with the account password, then choose a new PIN.
// Google-only accounts (no password) must have signed in within the last 10 minutes.
router.post(
  "/reset",
  wrap(async (req, res) => {
    const { password, newPin } = req.body;
    if (!validPin(newPin)) return fail(res, 400, "PIN_INVALID_FORMAT", "PIN must be 4 to 6 digits.");
    const user = await getUser(req.user.id);

    if (user.password_hash) {
      const ok = password && (await bcrypt.compare(password, user.password_hash));
      if (!ok) return fail(res, 401, "PIN_RESET_BAD_PASSWORD", "That account password is not right.");
    } else {
      const fresh = req.user.iat && Date.now() / 1000 - req.user.iat < REAUTH_WINDOW_SEC;
      if (!fresh) return fail(res, 401, "REAUTH_REQUIRED", "Please log in again with Google, then reset your PIN.");
    }

    await db.run("UPDATE users SET pin_hash = $1, pin_attempts = 0, pin_locked_until = NULL WHERE id = $2", [
      await bcrypt.hash(newPin, 10),
      user.id,
    ]);
    res.json(issueToken(user));
  })
);

module.exports = router;
