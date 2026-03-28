import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import employerRoutes from "./routes/employerRoute.js";
import employeeRoutes from "./routes/employeeRoute.js";
import attendanceRoutes from "./routes/attendanceRoute.js";
import cookieParser from "cookie-parser";

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

// Cron-Job
app.get("/api/cron-job", (req, res) => {
  console.log("Cron-Job Running");
  res.send("Cron-Job Running");
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});