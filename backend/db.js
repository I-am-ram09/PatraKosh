const { Pool } = require("pg");

const useSsl = String(process.env.DATABASE_SSL ?? "true").toLowerCase() !== "false";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

pool.on("error", (err) => console.error("[db] Unexpected pool error:", err.message));

const many = async (text, params = []) => (await pool.query(text, params)).rows;
const one = async (text, params = []) => (await pool.query(text, params)).rows[0] || null;
const run = (text, params = []) => pool.query(text, params);

// Creates tables on first start. Safe to run every time.
async function init() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      google_id TEXT,
      avatar_url TEXT,
      lang TEXT NOT NULL DEFAULT 'en',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      credentials TEXT,
      original_filename TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      expiry_date TEXT,
      share_token TEXT,
      reminder_sent INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Document PIN (stored only as a bcrypt hash) + brute-force lockout
    ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_attempts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google ON users(google_id) WHERE google_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_docs_user ON documents(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_docs_share ON documents(share_token);
  `);
}

module.exports = { pool, many, one, run, init };
