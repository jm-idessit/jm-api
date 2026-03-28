import jwt from "jsonwebtoken";
import Employer from "../models/employerModel.js";
import { getBearerOrCookie } from "./authToken.js";

const employerAuth = async (req, res, next) => {
  try {
    const token = getBearerOrCookie(req, "employerToken");

    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.employer = await Employer.findById(decoded.id).select("-password");

    next();
  } catch (error) {
    res.status(401).json({ message: "Not authorized" });
  }
};

export default employerAuth;