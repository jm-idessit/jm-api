import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import employerRoutes from "./routes/employerRoute.js";
import employeeRoutes from "./routes/employeeRoute.js";
import attendanceRoutes from "./routes/attendanceRoute.js";
import cookieParser from "cookie-parser";
import { runAutoClockOutJob } from "./jobs/autoClockOutJob.js";

dotenv.config({ quiet: true });

const app = express();
connectDB();

// Middleware
app.use(express.json());
app.use(cookieParser());

const defaultOrigins = ["http://localhost:3000", "http://127.0.0.1:3000", "https://jmdtr.onrender.com"];
const extraOrigins = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultOrigins, ...extraOrigins]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    credentials: true,
  })
);

// Cron-Job (legacy ping)
app.get("/api/cron-job", (req, res) => {
  console.log("Cron-Job Running");
  res.send("Cron-Job Running");
});

/**
 * Auto clock-out for all open shifts (no app required). In production, set CRON_SECRET
 * and call: GET /api/cron/auto-clock-out?key=<CRON_SECRET> on a schedule (e.g. Render Cron).
 */
app.get("/api/cron/auto-clock-out", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    if (!secret || req.query.key !== secret) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  } else if (secret && req.query.key !== secret) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const result = await runAutoClockOutJob();
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e?.message || "Job failed" });
  }
});

// Routes
app.get("/", (req, res) => {
  res.send("API Server Running");
});

// Employer Routes
app.use("/api/employers", employerRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);

const PORT = process.env.PORT || 5000;
const AUTO_CLOCK_OUT_INTERVAL_MS = 60 * 1000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  const tickAutoClockOut = () => {
    runAutoClockOutJob().catch((err) => console.error("[autoClockOutJob]", err));
  };
  setInterval(tickAutoClockOut, AUTO_CLOCK_OUT_INTERVAL_MS);
  tickAutoClockOut();
});