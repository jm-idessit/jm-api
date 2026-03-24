import mongoose from "mongoose";

const EmployerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    companyName: {
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
    phoneNumber: String,
    role: {
      type: String,
      default: "employer",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Employer", EmployerSchema);