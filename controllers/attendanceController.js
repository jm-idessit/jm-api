import Attendance from "../models/attendanceModel.js";
import AttendanceEditRequest from "../models/attendanceEditRequestModel.js";
import OjtRequirement from "../models/ojtRequirementModel.js";
import {
  getPHTNow,
  getPHTDateString,
  nowMinutes,
  toMinutes,
  SCHEDULE,
  BREAKS,
} from "../utils/timeUtils.js";
import { closeOpenBreaks, saveStats } from "../services/attendanceRecordUtils.js";
import mongoose from "mongoose";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Finds or creates today's attendance record for the authenticated employee.
 * Never throws on a duplicate key — returns the existing record instead.
 */
const findOrCreateToday = async (employeeId) => {
  const date = getPHTDateString();
  let record = await Attendance.findOne({ employeeId, date });
  if (!record) {
    try {
      record = await Attendance.create({ employeeId, date });
    } catch (err) {
      // Race condition: another request created it — fetch and return
      if (err.code === 11000) {
        record = await Attendance.findOne({ employeeId, date });
      } else {
        throw err;
      }
    }
  }
  return record;
};

// EDIT Attendance Record Helpers and for employer review of edit requests

const EDITABLE_FIELDS = new Set([
  "clockIn.time",
  "clockOut.time",
  "breaks.morning.start",
  "breaks.morning.end",
  "breaks.lunch.start",
  "breaks.lunch.end",
  "breaks.afternoon.start",
  "breaks.afternoon.end",
  "declaredAbsent",
  "overtimeEnabled",
]);

const getEmployeeIdFromReq = (req) => {
  return req.employee?._id || req.employee?.id || null;
};

const getEmployerIdFromReq = (req) => {
  return req.employer?._id || req.employer?.id || null;
};

const flattenObject = (obj, parentKey = "", result = {}) => {
  Object.entries(obj || {}).forEach(([key, value]) => {
    const fullKey = parentKey ? `${parentKey}.${key}` : key;

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      flattenObject(value, fullKey, result);
    } else {
      result[fullKey] = value;
    }
  });

  return result;
};

const normalizeRequestedChanges = (changes) => {
  const normalizedChanges = [];

  if (changes?.clockIn && "time" in changes.clockIn) {
    normalizedChanges.push({
      path: "clockIn.time",
      value: changes.clockIn.time,
    });
  }

  if (changes?.clockOut && "time" in changes.clockOut) {
    normalizedChanges.push({
      path: "clockOut.time",
      value: changes.clockOut.time,
    });
  }

  if (changes?.breaks?.morning && "start" in changes.breaks.morning) {
    normalizedChanges.push({
      path: "breaks.morning.start",
      value: changes.breaks.morning.start,
    });
  }

  if (changes?.breaks?.morning && "end" in changes.breaks.morning) {
    normalizedChanges.push({
      path: "breaks.morning.end",
      value: changes.breaks.morning.end,
    });
  }

  if (changes?.breaks?.lunch && "start" in changes.breaks.lunch) {
    normalizedChanges.push({
      path: "breaks.lunch.start",
      value: changes.breaks.lunch.start,
    });
  }

  if (changes?.breaks?.lunch && "end" in changes.breaks.lunch) {
    normalizedChanges.push({
      path: "breaks.lunch.end",
      value: changes.breaks.lunch.end,
    });
  }

  if (changes?.breaks?.afternoon && "start" in changes.breaks.afternoon) {
    normalizedChanges.push({
      path: "breaks.afternoon.start",
      value: changes.breaks.afternoon.start,
    });
  }

  if (changes?.breaks?.afternoon && "end" in changes.breaks.afternoon) {
    normalizedChanges.push({
      path: "breaks.afternoon.end",
      value: changes.breaks.afternoon.end,
    });
  }

  return normalizedChanges;
};

const minutesBetween = (start, end) => {
  if (!start || !end) return 0;
  const diff = Math.round((new Date(end) - new Date(start)) / 60000);
  return Math.max(0, diff);
};

const recalculateAttendanceTotals = (attendance) => {
  const grossMinutes = minutesBetween(
    attendance.clockIn?.time,
    attendance.clockOut?.time
  );

  const totalBreakMinutes =
    minutesBetween(
      attendance.breaks?.morning?.start,
      attendance.breaks?.morning?.end
    ) +
    minutesBetween(
      attendance.breaks?.lunch?.start,
      attendance.breaks?.lunch?.end
    ) +
    minutesBetween(
      attendance.breaks?.afternoon?.start,
      attendance.breaks?.afternoon?.end
    );

  attendance.totalWorkMinutes = Math.max(0, grossMinutes - totalBreakMinutes);

  // END
};

// ─── Clock In ────────────────────────────────────────────────────────────────

// POST /api/attendance/clock-in  (manual)
export const clockIn = async (req, res) => {
  try {
    const now = getPHTNow();
    const minutes = nowMinutes();

    // Manual clock-in allowed up to 30 minutes before official start.
    if (minutes < SCHEDULE.clockInStart - 30) {
      return res.status(400).json({
        message: "Clock-in is not yet available before 7:30 AM.",
      });
    }

    const record = await findOrCreateToday(req.employee._id);

    if (record.declaredAbsent) {
      return res.status(400).json({
        message: "You marked yourself absent today. You cannot clock in unless your supervisor clears this.",
      });
    }

    if (record.clockIn?.time) {
      return res.status(400).json({ message: "You have already clocked in today." });
    }

    record.clockIn = { time: now, isAutomatic: false };
    await record.save();

    return res.json({ message: "Clocked in successfully.", attendance: record });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST /api/attendance/auto-clock-in  (legacy — no longer used by client; kept for compatibility)
export const autoClockIn = async (req, res) => {
  try {
    const now = getPHTNow();
    const record = await findOrCreateToday(req.employee._id);

    if (record.declaredAbsent) {
      return res.status(200).json({ message: "Declared absent — skipping auto clock-in.", attendance: record });
    }

    if (record.clockIn?.time) {
      return res.status(200).json({ message: "Already clocked in.", attendance: record });
    }

    record.clockIn = { time: now, isAutomatic: true };
    await record.save();

    return res.json({ message: "Auto clock-in recorded.", attendance: record });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST /api/attendance/mark-absent  (explicit absent — blocks clock-in for the day)
export const markAbsent = async (req, res) => {
  try {
    const minutes = nowMinutes();
    if (minutes < SCHEDULE.clockInStart - 30) {
      return res.status(400).json({
        message: "Mark absent is available from 7:30 AM (PHT) onward.",
      });
    }

    const record = await findOrCreateToday(req.employee._id);

    if (record.clockIn?.time) {
      return res.status(400).json({ message: "You already clocked in today — you cannot mark absent." });
    }
    if (record.declaredAbsent) {
      return res.status(200).json({ message: "Already marked absent for today.", attendance: record });
    }

    record.declaredAbsent = true;
    await record.save();

    return res.json({ message: "Marked absent for today.", attendance: record });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── Clock Out ───────────────────────────────────────────────────────────────

// POST /api/attendance/clock-out  (manual)
export const clockOut = async (req, res) => {
  try {
    const now = getPHTNow();
    const date = getPHTDateString();
    let record = await Attendance.findOne({ employeeId: req.employee._id, date });

    if (!record || !record.clockIn?.time) {
      return res.status(400).json({ message: "You have not clocked in today." });
    }
    if (record.clockOut?.time) {
      return res.status(400).json({ message: "You have already clocked out today." });
    }

    const minutes = nowMinutes();
    const manualClockOutLatest = record.overtimeEnabled
      ? SCHEDULE.overtimeEndManual // 22:00
      : SCHEDULE.clockOutStd + 15; // 17:15

    // Prevent manual clock-out after the latest allowed time.
    if (minutes > manualClockOutLatest) {
      return res.status(400).json({
        message: record.overtimeEnabled
          ? "Overtime clock-out is only allowed up to 10:00 PM."
          : "Clock-out is only allowed up to 5:15 PM. Auto clock-out will take effect.",
      });
    }

    // Close any open break automatically before clocking out
    record = await closeOpenBreaks(record, now, true);

    record.clockOut = { time: now, isAutomatic: false };
    await saveStats(record);

    return res.json({ message: "Clocked out successfully.", attendance: record });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST /api/attendance/auto-clock-out  (triggered by frontend at 5:30 PM)
export const autoClockOut = async (req, res) => {
  try {
    const now = getPHTNow();
    const date = getPHTDateString();
    let record = await Attendance.findOne({ employeeId: req.employee._id, date });

    if (!record || !record.clockIn?.time) {
      return res.status(200).json({ message: "No clock-in record to close." });
    }
    if (record.clockOut?.time) {
      return res.status(200).json({ message: "Already clocked out.", attendance: record });
    }

    const minutes = nowMinutes();
    const targetAutoEnd = record.overtimeEnabled ? SCHEDULE.overtimeAutoEnd : SCHEDULE.clockOutStd + 15;

    // Only apply auto clock-out once the correct time is reached.
    if (minutes < targetAutoEnd) {
      return res.status(200).json({ message: "Auto clock-out is not ready yet.", attendance: record });
    }

    record = await closeOpenBreaks(record, now, true);

    record.clockOut = { time: now, isAutomatic: true };
    await saveStats(record);

    return res.json({ message: "Auto clock-out recorded.", attendance: record });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST /api/attendance/overtime/enable
export const enableOvertime = async (req, res) => {
  try {
    const now = getPHTNow();
    const date = getPHTDateString();
    const record = await Attendance.findOne({ employeeId: req.employee._id, date });

    if (!record || !record.clockIn?.time) {
      return res.status(400).json({ message: "Clock in first before enabling overtime." });
    }

    if (record.clockOut?.time) {
      return res.status(400).json({ message: "You have already clocked out today." });
    }

    if (record.overtimeEnabled) {
      return res.status(200).json({ message: "Overtime already enabled.", attendance: record });
    }

    record.overtimeEnabled = true;
    record.overtimeEnabledAt = now;
    await record.save();

    return res.json({ message: "Overtime enabled.", attendance: record });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── Breaks ──────────────────────────────────────────────────────────────────

/**
 * Determines which break window is currently active or within windowOpen time.
 * Returns "morning" | "lunch" | "afternoon" | null
 */
const getCurrentBreakType = (minutes) => {
  if (minutes >= BREAKS.morning.windowOpen && minutes < BREAKS.morning.end) return "morning";
  if (minutes >= BREAKS.lunch.windowOpen && minutes < BREAKS.lunch.autoEnd) return "lunch";
  if (minutes >= BREAKS.afternoon.windowOpen && minutes < BREAKS.afternoon.end) return "afternoon";
  return null;
};

// POST /api/attendance/break/start  (manual)
export const startBreak = async (req, res) => {
  try {
    const now = getPHTNow();
    const minutes = nowMinutes();
    const date = getPHTDateString();
    const { breakType } = req.body; // "morning" | "lunch" | "afternoon"

    if (!["morning", "lunch", "afternoon"].includes(breakType)) {
      return res.status(400).json({ message: "Invalid break type." });
    }

    const record = await Attendance.findOne({ employeeId: req.employee._id, date });
    if (!record || !record.clockIn?.time) {
      return res.status(400).json({ message: "You must be clocked in to start a break." });
    }
    if (record.clockOut?.time) {
      return res.status(400).json({ message: "You have already clocked out." });
    }

    const brk = BREAKS[breakType];
    if (minutes < brk.windowOpen) {
      return res.status(400).json({
        message: `${breakType} break is not yet available. It opens at ${Math.floor(brk.windowOpen / 60)}:${String(brk.windowOpen % 60).padStart(2, "0")}.`,
      });
    }

    if (record.breaks[breakType]?.start) {
      return res.status(400).json({ message: `${breakType} break has already been started.` });
    }

    // Check no other break is currently open
    const anyOpen = ["morning", "lunch", "afternoon"].some(
      (k) => record.breaks[k]?.start && !record.breaks[k]?.end
    );
    if (anyOpen) {
      return res.status(400).json({ message: "A break is already in progress. End it before starting another." });
    }

    record.breaks[breakType] = { start: now, isAutomatic: false };
    await record.save();

    return res.json({ message: `${breakType} break started.`, attendance: record });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST /api/attendance/break/auto-start
export const autoStartBreak = async (req, res) => {
  try {
    const now = getPHTNow();
    const date = getPHTDateString();
    const { breakType } = req.body;

    if (!["morning", "lunch", "afternoon"].includes(breakType)) {
      return res.status(400).json({ message: "Invalid break type." });
    }

    const record = await Attendance.findOne({ employeeId: req.employee._id, date });
    if (!record || !record.clockIn?.time || record.clockOut?.time) {
      return res.status(200).json({ message: "Skipping auto break start — not in a valid state." });
    }

    if (record.breaks[breakType]?.start) {
      return res.status(200).json({ message: `${breakType} break already started.`, attendance: record });
    }

    record.breaks[breakType] = { start: now, isAutomatic: true };
    await record.save();

    return res.json({ message: `Auto ${breakType} break started.`, attendance: record });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST /api/attendance/break/end  (manual — lunch only)
export const endBreak = async (req, res) => {
  try {
    const now = getPHTNow();
    const minutes = nowMinutes();
    const date = getPHTDateString();

    const record = await Attendance.findOne({ employeeId: req.employee._id, date });
    if (!record || !record.clockIn?.time) {
      return res.status(400).json({ message: "You have not clocked in today." });
    }

    // Find which break is currently open
    const openBreak = ["morning", "lunch", "afternoon"].find(
      (k) => record.breaks[k]?.start && !record.breaks[k]?.end
    );

    if (!openBreak) {
      return res.status(400).json({ message: "No break is currently in progress." });
    }

    // Only lunch can be manually ended
    if (openBreak !== "lunch") {
      return res.status(400).json({
        message: `The ${openBreak} break ends automatically and cannot be manually ended.`,
      });
    }

    // Lunch manual end: allowed from 12:00 PM onward
    if (minutes < BREAKS.lunch.start) {
      return res.status(400).json({ message: "Lunch break has not started yet." });
    }

    record.breaks.lunch.end = now;
    record.breaks.lunch.isAutomatic = false;
    await record.save();

    return res.json({ message: "Lunch break ended.", attendance: record });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// POST /api/attendance/break/auto-end
export const autoEndBreak = async (req, res) => {
  try {
    const now = getPHTNow();
    const date = getPHTDateString();
    const { breakType } = req.body;

    if (!["morning", "lunch", "afternoon"].includes(breakType)) {
      return res.status(400).json({ message: "Invalid break type." });
    }

    const record = await Attendance.findOne({ employeeId: req.employee._id, date });
    if (!record) {
      return res.status(200).json({ message: "No attendance record found." });
    }

    const brk = record.breaks[breakType];
    if (!brk?.start || brk?.end) {
      return res.status(200).json({ message: `${breakType} break already ended or not started.`, attendance: record });
    }

    record.breaks[breakType].end = now;
    record.breaks[breakType].isAutomatic = true;
    await record.save();

    return res.json({ message: `Auto ${breakType} break ended.`, attendance: record });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ─── Read Endpoints ───────────────────────────────────────────────────────────

// GET /api/attendance/server-time  (public)
export const getServerTime = (req, res) => {
  return res.json({ now: new Date().toISOString(), timezone: "Asia/Manila (UTC+8)" });
};

// GET /api/attendance/today
export const getTodayAttendance = async (req, res) => {
  try {
    const date = getPHTDateString();
    const record = await Attendance.findOne({ employeeId: req.employee._id, date });
    return res.json({ attendance: record || null, date });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// GET /api/attendance/weekly
export const getEmployeeAttendanceRecords = async (req, res) => {
  try {
    const records = await Attendance.find({
      employeeId: req.employee._id,
    }).sort({ date: -1 });

    const totalWorkMinutes = records.reduce(
      (sum, record) => sum + (record.totalWorkMinutes || 0),
      0
    );

    return res.status(200).json({
      success: true,
      totalRecords: records.length,
      totalWorkMinutes,
      records,
    });
  } catch (error) {
    console.error("getEmployeeAttendanceRecords error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// POST /api/attendance/ojt/required-hours
export const setRequiredWeeklyHours = async (req, res) => {
  try {
    const { requiredHours } = req.body;

    const n = Number(requiredHours);
    if (!Number.isFinite(n) || n < 0.5) {
      return res.status(400).json({ message: "requiredHours must be a number >= 0.5" });
    }

    // Compute Monday of the current PHT week (so requirement is tied to the same week view)
    const now = new Date();
    const phtNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const dayOfWeek = phtNow.getUTCDay(); // 0=Sun … 6=Sat
    const monday = new Date(phtNow);
    monday.setUTCDate(phtNow.getUTCDate() - ((dayOfWeek + 6) % 7));

    const weekStartStr = monday.toISOString().slice(0, 10);

    const upserted = await OjtRequirement.findOneAndUpdate(
      { employeeId: req.employee._id, weekStart: weekStartStr },
      { $set: { requiredHours: n } },
      { upsert: true, new: true }
    );

    return res.json({
      message: "Required OJT hours saved.",
      requiredWeeklyHours: upserted.requiredHours,
      weekStart: upserted.weekStart,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// GET /api/attendance/all  (employer only)
export const getAllAttendance = async (req, res) => {
  try {
    const { employeeId, date, weekStart } = req.query;
    const filter = {};

    if (employeeId) filter.employeeId = employeeId;

    if (date) {
      filter.date = date;
    } else if (weekStart) {
      // weekStart = "YYYY-MM-DD" (Monday of desired week)
      const start = new Date(weekStart + "T00:00:00Z");
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);
      filter.date = {
        $gte: weekStart,
        $lte: end.toISOString().slice(0, 10),
      };
    }

    const records = await Attendance.find(filter)
      .populate("employeeId", "employeeId name department position email")
      .sort({ date: -1, createdAt: -1 });

    return res.json({ records, total: records.length });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE Attendance Record (Employee only)
export const deleteAttendanceRecord = async (req, res) => {
  try {
    const { attendanceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance record ID",
      });
    }

    const deletedAttendance = await Attendance.findByIdAndDelete(attendanceId);

    if (!deletedAttendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    console.error("deleteAttendanceRecord error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete attendance record",
    });
  }
};

// Edit and emloyers approval of requests

export const submitAttendanceEditRequest = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const employeeId = getEmployeeIdFromReq(req);
    const { changes, reason = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance record ID.",
      });
    }

    if (!employeeId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized employee request.",
      });
    }

    if (!changes || typeof changes !== "object") {
      return res.status(400).json({
        success: false,
        message: "Changes payload is required.",
      });
    }

    const attendance = await Attendance.findById(attendanceId);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found.",
      });
    }

    if (attendance.employeeId.toString() !== employeeId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only request edits for your own attendance record.",
      });
    }

    const existingPending = await AttendanceEditRequest.findOne({
      attendanceId,
      employeeId,
      status: "pending",
    });

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: "There is already a pending edit request for this record.",
      });
    }

    const normalizedChanges = normalizeRequestedChanges(changes);

    if (!normalizedChanges.length) {
      return res.status(400).json({
        success: false,
        message: "No valid changes were submitted.",
      });
    }

    const editRequest = await AttendanceEditRequest.create({
      attendanceId,
      employeeId,
      changes: normalizedChanges,
      reason,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Attendance edit request submitted for approval.",
      data: editRequest,
    });
  } catch (error) {
    console.error("submitAttendanceEditRequest error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit attendance edit request.",
    });
  }
};

export const getMyAttendanceEditRequests = async (req, res) => {
  try {
    const employeeId = getEmployeeIdFromReq(req);

    const requests = await AttendanceEditRequest.find({
      employeeId,
    })
      .populate("attendanceId")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error("getMyAttendanceEditRequests error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch edit requests.",
    });
  }
};

export const getAttendanceEditRequests = async (req, res) => {
  try {
    const { status } = req.query;

    const filter = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    const requests = await AttendanceEditRequest.find(filter)
      .populate("attendanceId")
      .populate("employeeId")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error("getAttendanceEditRequests error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch attendance edit requests.",
    });
  }
};

export const approveAttendanceEditRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const employerId = getEmployerIdFromReq(req);

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid edit request ID.",
      });
    }

    const editRequest = await AttendanceEditRequest.findById(requestId);

    if (!editRequest) {
      return res.status(404).json({
        success: false,
        message: "Edit request not found.",
      });
    }

    if (editRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending requests can be approved.",
      });
    }

    const attendance = await Attendance.findById(editRequest.attendanceId);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Original attendance record not found.",
      });
    }

    for (const change of editRequest.changes) {
      attendance.set(change.path, change.value);
    }

    recalculateAttendanceTotals(attendance);
    await attendance.save();

    editRequest.status = "approved";
    editRequest.reviewedBy = employerId;
    editRequest.reviewedAt = new Date();
    editRequest.rejectionReason = "";
    await editRequest.save();

    return res.status(200).json({
      success: true,
      message: "Attendance edit request approved successfully.",
      data: {
        attendance,
        editRequest,
      },
    });
  } catch (error) {
    console.error("approveAttendanceEditRequest error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to approve edit request.",
    });
  }
};

export const rejectAttendanceEditRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const employerId = getEmployerIdFromReq(req);
    const { rejectionReason = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid edit request ID.",
      });
    }

    const editRequest = await AttendanceEditRequest.findById(requestId);

    if (!editRequest) {
      return res.status(404).json({
        success: false,
        message: "Edit request not found.",
      });
    }

    if (editRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending requests can be rejected.",
      });
    }

    editRequest.status = "rejected";
    editRequest.reviewedBy = employerId;
    editRequest.reviewedAt = new Date();
    editRequest.rejectionReason = rejectionReason;

    await editRequest.save();

    return res.status(200).json({
      success: true,
      message: "Attendance edit request rejected successfully.",
      data: editRequest,
    });
  } catch (error) {
    console.error("rejectAttendanceEditRequest error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to reject edit request.",
    });
  }
};