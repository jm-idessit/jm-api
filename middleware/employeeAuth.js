import jwt from "jsonwebtoken";
import Employee from "../models/employeeModel.js";

const employeeAuth = async (req, res, next) => {

  res.cookie("employeeToken", "test", {
    httpOnly: true,
    secure: true,        
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  try {
    const token = req.cookies.employeeToken;

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