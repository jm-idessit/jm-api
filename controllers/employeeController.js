import Employee from "../models/employeeModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Generate Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

// REGISTER EMPLOYEE
export const registerEmployee = async (req, res) => {
  try {
    const {
      employeeId,
      name,
      email,
      password,
      department,
      position,
      phoneNumber,
      employerId,
    } = req.body;

    const employeeExists = await Employee.findOne({
      $or: [{ email }, { employeeId }],
    });

    if (employeeExists) {
      return res.status(400).json({ message: "Employee already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const employee = await Employee.create({
      employeeId,
      name,
      email,
      password: hashedPassword,
      department,
      position,
      phoneNumber,
      employerId,
    });

    res.status(201).json({
      message: "Employee registered successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// LOGIN EMPLOYEE
export const loginEmployee = async (req, res) => {
  try {
    const { email, password } = req.body;

    const isProduction = process.env.NODE_ENV === "production";
    const employee = await Employee.findOne({ email });
    if (!employee) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = generateToken(employee._id);

    res.cookie("employeeToken", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    }); 

    res.json({
      message: "Login successful",
      employee: {
        id: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// LOGOUT
export const logoutEmployee = (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("employeeToken", "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    expires: new Date(0),
  });

  res.json({ message: "Logged out successfully" });
};

// GET PROFILE
export const getEmployeeProfile = async (req, res) => {
  try {
    const employee = await Employee.findById(req.employee.id).select("-password");
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};