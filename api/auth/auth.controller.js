import User from "../user/user.model.js";
import Patient from "../patient/patient.model.js";
import Doctor from "../doctor/doctor.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Helper to generate JWT Token
const generateToken = (res, user) => {
  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role, isAdmin: user.role === "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("accessToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return token;
};

// Register Patient
export async function registerPatient(req, res, next) {
  try {
    const {
      name,
      email,
      password,
      mobileNumber,
      gender,
      dateOfBirth,
      age,
      address,
      bloodGroup,
      height,
      weight,
      allergies,
      existingDiseases,
      emergencyContactName,
      emergencyContactRelation,
      emergencyContactPhone
    } = req.body;

    // Validation
    if (!name || !email || !password || !mobileNumber || !gender || !dateOfBirth || !age || !address) {
      return res.status(400).json({ message: "All personal fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create User
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "patient",
      isAdmin: false
    });

    // Create Patient Profile
    const newPatient = await Patient.create({
      user: newUser._id,
      mobileNumber,
      gender,
      dateOfBirth,
      age,
      address,
      bloodGroup: bloodGroup || "Unknown",
      height: height || 0,
      weight: weight || 0,
      allergies: allergies || "None",
      existingDiseases: existingDiseases || "None",
      emergencyContact: {
        name: emergencyContactName || "N/A",
        relation: emergencyContactRelation || "N/A",
        mobileNumber: emergencyContactPhone || "N/A",
      }
    });

    // Generate token & set cookie
    generateToken(res, newUser);

    return res.status(201).json({
      message: "Patient registered successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
      patient: newPatient,
    });
  } catch (error) {
    next(error);
  }
}

// Unified Login (Patient, Doctor, Admin)
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Your account is deactivated. Please contact support." });
    }

    // Find profile details if doctor or patient
    let profileDetails = null;
    if (user.role === "patient") {
      profileDetails = await Patient.findOne({ user: user._id });
    } else if (user.role === "doctor") {
      profileDetails = await Doctor.findOne({ user: user._id });
    }

    // Generate token
    const token = generateToken(res, user);

    return res.json({
      message: "Logged in successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        profile: profileDetails
      }
    });
  } catch (error) {
    next(error);
  }
}

// Get Current User Session
export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let profile = null;
    if (user.role === "patient") {
      profile = await Patient.findOne({ user: user._id });
    } else if (user.role === "doctor") {
      profile = await Doctor.findOne({ user: user._id });
    }

    return res.json({ user, profile });
  } catch (error) {
    next(error);
  }
}

// Logout
export async function logout(req, res) {
  res.cookie("accessToken", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  return res.json({ message: "Logged out successfully" });
}

// Register Admin (Development Helper)
export async function registerAdmin(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      isAdmin: true
    });

    generateToken(res, newUser);

    return res.status(201).json({
      message: "Admin created successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      }
    });
  } catch (error) {
    next(error);
  }
}
