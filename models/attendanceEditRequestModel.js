import mongoose from "mongoose";

const AttendanceEditChangeSchema = new mongoose.Schema(
  {
    path: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const AttendanceEditRequestSchema = new mongoose.Schema(
  {
    attendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
      required: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    changes: {
      type: [AttendanceEditChangeSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one change is required.",
      },
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

AttendanceEditRequestSchema.index({ employeeId: 1, status: 1, createdAt: -1 });
AttendanceEditRequestSchema.index({ attendanceId: 1, status: 1 });

export default mongoose.model(
  "AttendanceEditRequest",
  AttendanceEditRequestSchema
);