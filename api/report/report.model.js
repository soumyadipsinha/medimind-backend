import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    test: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" }, // optional if booked independently
    fileUrl: { type: String }, // SharePoint uploaded report PDF URL
    notes: { type: String },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
    price: { type: Number, required: true },
    paymentStatus: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
  },
  {
    timestamps: true,
  }
);

const Report = mongoose.model("Report", ReportSchema);
export default Report;
