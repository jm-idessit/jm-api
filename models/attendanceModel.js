import mongoose from "mongoose";

const TimeEntrySchema = new mongoose.Schema(
  {
    time: { type: Date, default: null },
    isAutomatic: { type: Boolean, default: false },
  },
  { _id: false }
);

const BreakEntrySchema = new mongoose.Schema(
  {
    start: { type: Date, default: null },
    end: { type: Date, default: null },
    isAutomatic: { type: Boolean, default: false },
  },
  { _id: false }
);

const AttendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    // Date in PHT, string format "YYYY-MM-DD" for easy daily lookups
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    clockIn: { type: TimeEntrySchema, default: () => ({}) },
    clockOut: { type: TimeEntrySchema, default: () => ({}) },

    breaks: {
      morning: { type: BreakEntrySchema, default: () => ({}) },
      lunch: { type: BreakEntrySchema, default: () => ({}) },
      afternoon: { type: BreakEntrySchema, default: () => ({}) },
    },

    // Employee explicitly marked absent for the day (no auto / surprise clock-in)
    declaredAbsent: { type: Boolean, default: false },

    // Computed and stored on clock-out
    totalWorkMinutes: { type: Number, default: 0 },
    lateMinutes: { type: Number, default: 0 },
    undertimeMinutes: { type: Number, default: 0 },

    // Used for clock-out time validation / availability (rendered-hours computation uses rounding rules).
    overtimeEnabled: { type: Boolean, default: false },
    overtimeEnabledAt: { type: Date },
  },
  { timestamps: true }
);

// One attendance record per employee per day — enforced at DB level
AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", AttendanceSchema);
