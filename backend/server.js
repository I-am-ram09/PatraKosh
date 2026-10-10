require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Fail fast with a clear message instead of a confusing crash later.
const REQUIRED_ENV = [
  "JWT_SECRET",
  "DATABASE_URL",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    `[server] Missing required settings in backend/.env: ${missing.join(", ")}\n` +
      "         Copy .env.example to .env and fill them in (see README)."
  );
  process.exit(1);
}

const db = require("./db");
const authRoutes = require("./routes/auth");
const documentRoutes = require("./routes/documents");
const shareRoutes = require("./routes/share");
const pinRoutes = require("./routes/pin");
const { startExpiryCron } = require("./utils/cron");
const { fail } = require("./utils/http");

const app = express();

const allowedOrigins = (process.env.CLIENT_URL || "*").split(",").map((s) => s.trim());
app.use(
  cors({
    origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
    allowedHeaders: ["Content-Type", "Authorization", "X-Pin-Token"],
  })
);
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/pin", pinRoutes);
app.use("/api/share", shareRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === "LIMIT_FILE_SIZE") {
    return fail(res, 413, "FILE_TOO_LARGE", "File is too large (25MB max).");
  }
  fail(res, 500, "SERVER_ERROR", "Something went wrong on the server.");
});

const PORT = process.env.PORT || 4000;

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`PatraKosh API running on port ${PORT}`);
      startExpiryCron();
    });
  })
  .catch((err) => {
    console.error("[db] Could not connect to the database / create tables:", err.message);
    process.exit(1);
  });
