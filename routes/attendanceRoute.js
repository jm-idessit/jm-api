import express from "express";
import {
  clockIn,
  autoClockIn,
  markAbsent,
  clockOut,
  autoClockOut,
  startBreak,
  autoStartBreak,
  endBreak,
  autoEndBreak,
  enableOvertime,
  getTodayAttendance,
  getEmployeeAttendanceRecords,
  getServerTime,
  getAllAttendance,
  setRequiredWeeklyHours,
  deleteAttendanceRecord,
  submitAttendanceEditRequest,
  getMyAttendanceEditRequests,
  getAttendanceEditRequests,
  approveAttendanceEditRequest,
  rejectAttendanceEditRequest,
} from "../controllers/attendanceController.js";
import employeeAuth from "../middleware/employeeAuth.js";
import employerAuth from "../middleware/employerAuth.js";

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get("/server-time", getServerTime);

// ── Employee — Clock In/Out ───────────────────────────────────────────────────
router.post("/clock-in", employeeAuth, clockIn);
router.post("/auto-clock-in", employeeAuth, autoClockIn);
router.post("/mark-absent", employeeAuth, markAbsent);
router.post("/overtime/enable", employeeAuth, enableOvertime);
router.post("/clock-out", employeeAuth, clockOut);
router.post("/auto-clock-out", employeeAuth, autoClockOut);

// ── Employee — Breaks ─────────────────────────────────────────────────────────
router.post("/break/start", employeeAuth, startBreak);
router.post("/break/auto-start", employeeAuth, autoStartBreak);
router.post("/break/end", employeeAuth, endBreak);
router.post("/break/auto-end", employeeAuth, autoEndBreak);
router.post("/ojt/required-hours", employeeAuth, setRequiredWeeklyHours);

// ── Employee — Record Reads ───────────────────────────────────────────────────
router.get("/today", employeeAuth, getTodayAttendance);
router.get("/records", employeeAuth, getEmployeeAttendanceRecords);

// ── Employer — Admin Read ─────────────────────────────────────────────────────
router.get("/all", employerAuth, getAllAttendance);

// ── Employee — Delete ───────────────────
router.delete("/record/:attendanceId", employeeAuth, deleteAttendanceRecord);

// ── Employee — Edit Requests ─────────────────────────────────────────────────
router.post("/edit-requests/:attendanceId", employeeAuth, submitAttendanceEditRequest);
router.get("/edit-requests/mine", employeeAuth, getMyAttendanceEditRequests);

// Employer review routes
router.get("/edit-requests", employerAuth, getAttendanceEditRequests);
router.patch("/edit-requests/:requestId/approve", employerAuth, approveAttendanceEditRequest);
router.patch("/edit-requests/:requestId/reject", employerAuth, rejectAttendanceEditRequest);

export default router;
