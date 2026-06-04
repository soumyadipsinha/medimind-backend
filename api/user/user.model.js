import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "doctor", "patient"], default: "patient" },
    isActive: { type: Boolean, default: true },
    isAdmin: { type: Boolean, default: false },
    avatarUrl: { type: String },
    lastSeen: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model("User", UserSchema);

export default User;
