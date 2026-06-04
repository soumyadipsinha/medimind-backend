import mongoose from "mongoose";

const PatientSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    mobileNumber: { type: String, required: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
    dateOfBirth: { type: Date, required: true },
    age: { type: Number, required: true },
    address: { type: String, required: true },
    bloodGroup: { type: String, required: true },
    height: { type: Number, required: true }, // in cm
    weight: { type: Number, required: true }, // in kg
    allergies: { type: String, default: "None" },
    existingDiseases: { type: String, default: "None" },
    emergencyContact: {
      name: { type: String, required: true },
      relation: { type: String, required: true },
      mobileNumber: { type: String, required: true },
    },
    doctors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Doctor" }],
  },
  {
    timestamps: true,
  }
);

const Patient = mongoose.model("Patient", PatientSchema);
export default Patient;
