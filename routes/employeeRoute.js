import express from "express";
import {
  registerEmployee,
  loginEmployee,
  logoutEmployee,
  getEmployeeProfile,
} from "../controllers/employeeController.js";
import employeeAuth from "../middleware/employeeAuth.js";

const router = express.Router();

router.post("/register", registerEmployee);
router.post("/login", loginEmployee);
router.post("/logout", logoutEmployee);
router.get("/profile", employeeAuth, getEmployeeProfile);

export default router;