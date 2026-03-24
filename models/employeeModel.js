import mongoose from "mongoose";

const EmployeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    department: String,
    position: String,
    phoneNumber: String,

    // Link employee to employer/company
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employer",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Employee", EmployeeSchema);