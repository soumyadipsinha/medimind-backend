import Doctor from "./doctor.model.js";
import User from "../user/user.model.js";
import bcrypt from "bcryptjs";

export const getDoctors = async (req, res, next) => {
  try {
    const doctors = await Doctor.find({}).populate("user", "name email avatarUrl isActive lastSeen");
    res.json(doctors);
  } catch (error) {
    next(error);
  }
};

export const createDoctor = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      qualification,
      specialization,
      experience,
      registrationNumber,
      consultationFee,
      availableDays,
      scheduleType,
      startTime,
      endTime,
      maxPatientsPerDay,
      bio,
      avatarUrl,
      department
    } = req.body;

    if (!name || !email || !password || !qualification || !specialization || !experience || !registrationNumber || !startTime || !endTime) {
      return res.status(400).json({ message: "All professional and user fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already exists" });
    }

    // Create User credentials
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userObj = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "doctor",
      avatarUrl: avatarUrl || "",
    });

    // Create Doctor Profile
    const doctorProfile = await Doctor.create({
      user: userObj._id,
      qualification,
      specialization,
      experience,
      registrationNumber,
      consultationFee,
      scheduleType: scheduleType || "weekly",
      availableDays: availableDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      startTime,
      endTime,
      maxPatientsPerDay,
      bio,
      department: department || null,
    });

    res.status(201).json({
      message: "Doctor created successfully",
      doctor: doctorProfile,
      user: userObj
    });
  } catch (error) {
    next(error);
  }
};

export const updateDoctor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      isActive,
      qualification,
      specialization,
      experience,
      registrationNumber,
      consultationFee,
      availableDays,
      scheduleType,
      startTime,
      endTime,
      maxPatientsPerDay,
      bio,
      avatarUrl,
      department
    } = req.body;

    const doctorProfile = await Doctor.findById(id);
    if (!doctorProfile) {
      return res.status(404).json({ message: "Doctor profile not found" });
    }

    // Update User credentials
    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (avatarUrl) updates.avatarUrl = avatarUrl;
    if (isActive !== undefined) updates.isActive = isActive;

    await User.findByIdAndUpdate(doctorProfile.user, updates);

    // Update Doctor profile
    const updatedDoctor = await Doctor.findByIdAndUpdate(
      id,
      {
        qualification,
        specialization,
        experience,
        registrationNumber,
        consultationFee,
        availableDays,
        scheduleType,
        startTime,
        endTime,
        maxPatientsPerDay,
        bio,
        department: department !== undefined ? department : undefined,
      },
      { new: true }
    ).populate("user", "name email avatarUrl isActive");

    res.json({ message: "Doctor updated successfully", doctor: updatedDoctor });
  } catch (error) {
    next(error);
  }
};

export const deleteDoctor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doctorProfile = await Doctor.findById(id);
    if (!doctorProfile) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Delete both User and Doctor Profile
    await User.findByIdAndDelete(doctorProfile.user);
    await Doctor.findByIdAndDelete(id);

    res.json({ message: "Doctor account deleted successfully" });
  } catch (error) {
    next(error);
  }
};
