import mongoose from "mongoose";
import checkRequiredFields from "../../utils/checkRequiredFields.js";
import User from "./user.model.js";
import { createUser, userExists, checkPassword, updatePassword, updatePin, updateP12Pin, hashPassword, verifyPin, verifyP12Pin } from "./user.service.js";
import ProjectMember from "../master-data/project-member/project-member.model.js";
import addActivityLog from "../../utils/activityLog.js";

export async function handleGetAllUsers(req, res, next) {
  try {
    const query = req.query || {};
    const users = await User.find(query)
      .select("-password -__v ")
      .populate("company", "_id name")
      .lean();
    return res.json(users);
  } catch (err) {
    return next(err);
  }
}

export async function handleCreateUser(req, res, next) {
  const { name, email, password, roles, company, avatarUrl, isAdmin } = req.body;

  checkRequiredFields({ name, email, password });

  if (await userExists(email)) {
    const error = new Error("User already exists");
    error.statusCode = 409;
    throw error;
  }

  const newUser = await createUser({ name, email, password, roles, company, avatarUrl, isAdmin });

  return res.status(201).json({
    message: "User created successfully",
    user: newUser,
  });
}

export async function handleUpdateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, isAdmin, company, avatarUrl, isActive, password, pin, p12Pin } = req.body;

    checkRequiredFields({ id });

    if (company && !mongoose.Types.ObjectId.isValid(company)) {
      const error = new Error("Invalid company ID");
      error.statusCode = 400;
      throw error;
    }

    const updates = { name, email, isAdmin, company, avatarUrl, isActive };
    if (password) updates.password = await hashPassword(password);
    if (pin) updates.pin = await hashPassword(pin);
    if (p12Pin) updates.p12Pin = await hashPassword(p12Pin);

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updates,
      { new: true },
    );

    const projects = await ProjectMember.updateMany(
      { userId: id },
      { company },
    );

    if (!updatedUser) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    await addActivityLog(req, "Updated user profile");

    return res.json({ message: "User updated successfully" });
  } catch (err) {
    return next(err);
  }
}

export async function softDeleteUser(req, res, next) {
  try {
    const { id } = req.params;
    checkRequiredFields({ id });
    const deletedUser = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );
    if (!deletedUser) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    // TODO : need to update project member records as well

    const projects = await ProjectMember.updateMany(
      { userId: id },
      { isActive: false },
    );

    return res.json({ message: "User deleted successfully" });
  } catch (err) {
    return next(err);
  }
}

export async function hardDeleteUser(req, res, next) {
  try {
    const { id } = req.params;
    checkRequiredFields({ id });

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const projects = await ProjectMember.deleteMany({ userId: id });

    return res.json({ message: "User hard deleted successfully" });
  } catch (err) {
    return next(err);
  }
}

export async function handleUpdatePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    checkRequiredFields({ currentPassword, newPassword });

    const user = await User.findById(req.user.id);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const isMatch = await checkPassword(currentPassword, user.password);
    if (!isMatch) {
      const error = new Error("Incorrect current password");
      error.statusCode = 401;
      throw error;
    }

    await updatePassword(user._id, newPassword);
    await addActivityLog(req, "Changed password");

    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    return next(err);
  }
}

export async function handleUpdatePin(req, res, next) {
  try {
    const { currentPin, newPin } = req.body;
    checkRequiredFields({ newPin });

    const user = await User.findById(req.user.id);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    // Only check current PIN if it exists in the database
    if (user.pin) {
      if (!currentPin) {
        const error = new Error("Current PIN is required to change it");
        error.statusCode = 400;
        throw error;
      }
      const isMatch = await checkPassword(currentPin, user.pin);
      if (!isMatch) {
        const error = new Error("Incorrect current PIN");
        error.statusCode = 401;
        throw error;
      }
    }

    await updatePin(user._id, newPin);
    await addActivityLog(req, "Updated user PIN");

    return res.json({ message: "User PIN updated successfully" });
  } catch (err) {
    return next(err);
  }
}

export async function handleUpdateP12Pin(req, res, next) {
  try {
    const { currentP12Pin, newP12Pin } = req.body;
    checkRequiredFields({ newP12Pin });

    const user = await User.findById(req.user.id);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    if (user.p12Pin) {
      if (!currentP12Pin) {
        const error = new Error("Current P12 PIN is required to change it");
        error.statusCode = 400;
        throw error;
      }
      const isMatch = await checkPassword(currentP12Pin, user.p12Pin);
      if (!isMatch) {
        const error = new Error("Incorrect current P12 PIN");
        error.statusCode = 401;
        throw error;
      }
    }

    await updateP12Pin(user._id, newP12Pin);
    await addActivityLog(req, "Updated P12 Signature PIN");

    return res.json({ message: "P12 Signature PIN updated successfully" });
  } catch (err) {
    return next(err);
  }
}

export async function handleVerifyPin(req, res, next) {
  try {
    const { pin } = req.body;
    checkRequiredFields({ pin });

    const isMatch = await verifyPin(req.user.id, pin);
    if (!isMatch) {
      const error = new Error("Incorrect PIN");
      error.statusCode = 401;
      throw error;
    }

    return res.json({ message: "PIN verified successfully" });
  } catch (err) {
    return next(err);
  }
}

export async function handleVerifyP12Pin(req, res, next) {
  try {
    const { p12Pin } = req.body;
    checkRequiredFields({ p12Pin });

    const isMatch = await verifyP12Pin(req.user.id, p12Pin);
    if (!isMatch) {
      const error = new Error("Incorrect P12 PIN");
      error.statusCode = 401;
      throw error;
    }

    return res.json({ message: "P12 PIN verified successfully" });
  } catch (err) {
    return next(err);
  }
}
