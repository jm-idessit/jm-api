import express from "express";
import {
  clockIn,
  autoClockIn,
  clockOut,
  autoClockOut,
  startBreak,
  autoStartBreak,
  endBreak,
  autoEndBreak,
  getTodayAttendance,
  getWeeklyAttendance,
  getServerTime,
  getAllAttendance,
} from "../controllers/attendanceController.js";
import employeeAuth from "../middleware/employeeAuth.js";
import employerAuth from "../middleware/employerAuth.js";

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get("/server-time", getServerTime);

// ── Employee — Clock In/Out ───────────────────────────────────────────────────
router.post("/clock-in", employeeAuth, clockIn);
router.post("/auto-clock-in", employeeAuth, autoClockIn);
router.post("/clock-out", employeeAuth, clockOut);
router.post("/auto-clock-out", employeeAuth, autoClockOut);

// ── Employee — Breaks ─────────────────────────────────────────────────────────
router.post("/break/start", employeeAuth, startBreak);
router.post("/break/auto-start", employeeAuth, autoStartBreak);
router.post("/break/end", employeeAuth, endBreak);
router.post("/break/auto-end", employeeAuth, autoEndBreak);

// ── Employee — Record Reads ───────────────────────────────────────────────────
router.get("/today", employeeAuth, getTodayAttendance);
router.get("/weekly", employeeAuth, getWeeklyAttendance);

// ── Employer — Admin Read ─────────────────────────────────────────────────────
router.get("/all", employerAuth, getAllAttendance);

export default router;
