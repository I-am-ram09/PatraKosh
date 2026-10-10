const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { OAuth2Client } = require("google-auth-library");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { wrap, fail } = require("../utils/http");

const router = express.Router();
const LANGS = ["en", "hi", "mr"];

function signToken(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, lang: u.lang || "en" });

router.post(
  "/signup",
  wrap(async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return fail(res, 400, "SIGNUP_FIELDS_REQUIRED", "Name, email and password are all required.");
    }
    if (password.length < 6) {
      return fail(res, 400, "PASSWORD_SHORT", "Password must be at least 6 characters.");
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await db.one("SELECT id FROM users WHERE email = $1", [cleanEmail]);
    if (existing) {
      return fail(res, 409, "EMAIL_EXISTS", "An account with that email already exists.");
    }

    const id = uuidv4();
    const password_hash = await bcrypt.hash(password, 10);
    await db.run("INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)", [
      id,
      name.trim(),
      cleanEmail,
      password_hash,
    ]);

    const user = { id, name: name.trim(), email: cleanEmail, lang: "en" };
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

router.post(
  "/login",
  wrap(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return fail(res, 400, "LOGIN_FIELDS_REQUIRED", "Email and password are required.");
    }

    const user = await db.one("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (!user) return fail(res, 401, "INVALID_CREDENTIALS", "Invalid email or password.");

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return fail(res, 401, "INVALID_CREDENTIALS", "Invalid email or password.");

    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.get("/config", (req, res) => res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null }));

// Verifies the Google ID token server-side, then creates or links the account by verified email.
router.post(
  "/google",
  wrap(async (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return fail(res, 501, "GOOGLE_NOT_CONFIGURED", "Google sign-in isn't configured on the server.");
    }
    let p;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: req.body.credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      p = ticket.getPayload();
    } catch (err) {
      return fail(res, 401, "GOOGLE_FAILED", "Google sign-in failed. Please try again.");
    }
    if (!p.email || !p.email_verified) {
      return fail(res, 401, "GOOGLE_EMAIL_UNVERIFIED", "Your Google email isn't verified.");
    }

    const email = p.email.toLowerCase();
    const name = p.name || email.split("@")[0];
    let user = await db.one("SELECT * FROM users WHERE google_id = $1 OR email = $2", [p.sub, email]);
    if (!user) {
      const id = uuidv4();
      await db.run(
        "INSERT INTO users (id, name, email, password_hash, google_id, avatar_url) VALUES ($1, $2, $3, '', $4, $5)",
        [id, name, email, p.sub, p.picture || null]
      );
      user = { id, name, email, lang: "en" };
    } else if (!user.google_id) {
      await db.run("UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3", [
        p.sub,
        p.picture || null,
        user.id,
      ]);
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

router.get(
  "/me",
  requireAuth,
  wrap(async (req, res) => {
    const user = await db.one("SELECT id, name, email, lang FROM users WHERE id = $1", [req.user.id]);
    if (!user) return fail(res, 404, "USER_NOT_FOUND", "User not found.");
    res.json({ user: publicUser(user) });
  })
);

// Remembers the user's language so reminder emails arrive in English / Hindi / Marathi.
router.patch(
  "/language",
  requireAuth,
  wrap(async (req, res) => {
    const lang = LANGS.includes(req.body.lang) ? req.body.lang : "en";
    await db.run("UPDATE users SET lang = $1 WHERE id = $2", [lang, req.user.id]);
    res.json({ ok: true, lang });
  })
);

module.exports = router;
