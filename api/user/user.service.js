import User from "./user.model.js";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return await bcrypt.hash(password, salt);
};

export const checkPassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

export const userExists = async (email) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.exists({ email: normalizedEmail }).lean();
  return !!user;
};

export const getUserByEmail = async (email, hidePassword = false) => {
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail })
    .select("-__v")
    .populate("company", "_id name")
    .lean();

  if (hidePassword && user) {
    delete user.password;
  }

  return user;
};

export const createUser = async ({ name, email, password, roles, company, avatarUrl, isAdmin }) => {
  const normalizedEmail = String(email).trim().toLowerCase();

  const hashedPassword = await hashPassword(password);
  const user = new User({
    name,
    email: normalizedEmail,
    password: hashedPassword,
    roles,
    company,
    avatarUrl,
    isAdmin,
  });

  const newUser = await user.save();
  return {
    id: newUser._id,
    name: newUser.name,
    email: newUser.email,
    roles: newUser.roles,
  };
};

export const updatePassword = async (userId, newPassword) => {
  const hashedPassword = await hashPassword(newPassword);
  return await User.findByIdAndUpdate(userId, { password: hashedPassword });
};

export const updatePin = async (userId, newPin) => {
  const hashedPin = await hashPassword(newPin); // Reusing password hashing for PIN
  return await User.findByIdAndUpdate(userId, { pin: hashedPin });
};

export const updateP12Pin = async (userId, newP12Pin) => {
  const hashedP12Pin = await hashPassword(newP12Pin);
  return await User.findByIdAndUpdate(userId, { p12Pin: hashedP12Pin });
};

export const verifyPin = async (userId, pin) => {
  const user = await User.findById(userId).select("pin");
  if (!user || !user.pin) return false;
  return await checkPassword(pin, user.pin);
};

export const verifyP12Pin = async (userId, p12Pin) => {
  const user = await User.findById(userId).select("p12Pin");
  if (!user || !user.p12Pin) return false;
  return await checkPassword(p12Pin, user.p12Pin);
};
