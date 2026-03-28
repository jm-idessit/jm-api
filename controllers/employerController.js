import Employer from "../models/employerModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Generate Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

// REGISTER
export const registerEmployer = async (req, res) => {
  try {
    const { name, companyName, email, password, phoneNumber } = req.body;

    const employerExists = await Employer.findOne({ email });
    if (employerExists) {
      return res.status(400).json({ message: "Employer already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const employer = await Employer.create({
      name,
      companyName,
      email,
      password: hashedPassword,
      phoneNumber,
    });

    return res.status(201).json({
      message: "Employer registered successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// LOGIN (Set Cookie)
export const loginEmployer = async (req, res) => {
  try {
    const { email, password } = req.body;

    const isProduction = process.env.NODE_ENV === "production";
    const employer = await Employer.findOne({ email });
    if (!employer) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, employer.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = generateToken(employer._id);

    // Send token in cookie
    res.cookie("employerToken", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.json({
      message: "Login successful",
      token,
      employer: {
        id: employer._id,
        name: employer.name,
        email: employer.email,
        companyName: employer.companyName,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// LOGOUT (Clear Cookie)
export const logoutEmployer = (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("employerToken", "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    expires: new Date(0),
  });

  res.json({ message: "Logged out successfully" });
};

// GET PROFILE
export const getEmployerProfile = async (req, res) => {
  try {
    const employer = await Employer.findById(req.employer.id).select("-password");
    res.json(employer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};