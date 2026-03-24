import express from "express";
import {
  registerEmployer,
  loginEmployer,
  logoutEmployer,
  getEmployerProfile,
} from "../controllers/employerController.js";
import employerAuth from "../middleware/employerAuth.js";

const router = express.Router();

router.post("/register", registerEmployer);
router.post("/login", loginEmployer);
router.post("/logout", logoutEmployer);
router.get("/profile", employerAuth, getEmployerProfile);

export default router;