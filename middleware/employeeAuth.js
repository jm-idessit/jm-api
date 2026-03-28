import jwt from "jsonwebtoken";
import Employee from "../models/employeeModel.js";
import { getBearerOrCookie } from "./authToken.js";

const employeeAuth = async (req, res, next) => {
  try {
    const token = getBearerOrCookie(req, "employeeToken");

    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.employee = await Employee.findById(decoded.id).select("-password");

    next();
  } catch (error) {
    res.status(401).json({ message: "Not authorized" });
  }
};

export default employeeAuth;