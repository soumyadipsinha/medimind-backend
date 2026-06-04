import mongoose from "mongoose";

const PrescriptionSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true },
    diagnosis: { type: String, required: true },
    advice: { type: String, required: true },
    medicines: [
      {
        name: { type: String, required: true },
        dosage: { type: String, required: true }, // e.g. "500mg"
        frequency: { type: String, required: true }, // e.g. "Twice a day"
        duration: { type: String, required: true }, // e.g. "5 Days"
      },
    ],
    recommendedTests: [{ type: String }],
    followUpDate: { type: Date },
    pdfUrl: { type: String }, // SharePoint link for prescription PDF
  },
  {
    timestamps: true,
  }
);

const Prescription = mongoose.model("Prescription", PrescriptionSchema);
export default Prescription;
