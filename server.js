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

app.use(
  cors({
    origin: ["http://localhost:3000", "https://jmdtr.onrender.com"], // Next.js frontend
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