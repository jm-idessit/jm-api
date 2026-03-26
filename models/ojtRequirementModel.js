import mongoose from "mongoose";

// Stores how many "required OJT hours" a student/employee needs for a given PHT week.
// Used for rendered/remaining hours UI calculations.
const OjtRequirementSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    // Monday of the PHT week in "YYYY-MM-DD"
    weekStart: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    requiredHours: {
      type: Number,
      required: true,
      min: 0.5,
    },
  },
  { timestamps: true }
);

// One requirement record per employee per week.
OjtRequirementSchema.index({ employeeId: 1, weekStart: 1 }, { unique: true });

export default mongoose.model("OjtRequirement", OjtRequirementSchema);

