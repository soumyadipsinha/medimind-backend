import mongoose from "mongoose";

const DoctorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    qualification: { type: String, required: true },
    specialization: { type: String, required: true },
    experience: { type: Number, required: true }, // in years
    registrationNumber: { type: String, required: true, unique: true },
    consultationFee: { type: Number, required: true, default: 0 },
    scheduleType: { type: String, enum: ["weekly", "monthly"], default: "weekly" },
    availableDays: [{ type: String }],
    startTime: { type: String, required: true }, // e.g. "09:00"
    endTime: { type: String, required: true }, // e.g. "17:00"
    maxPatientsPerDay: { type: Number, required: true, default: 15 },
    bio: { type: String },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
  },
  {
    timestamps: true,
  }
);

const Doctor = mongoose.model("Doctor", DoctorSchema);
export default Doctor;
