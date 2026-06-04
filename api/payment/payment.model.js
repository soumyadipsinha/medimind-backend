import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    paymentId: { type: String, required: true }, // Razorpay payment ID
    orderId: { type: String, required: true }, // Razorpay order ID
    signature: { type: String },
    status: {
      type: String,
      enum: ["Pending", "Success", "Failed"],
      default: "Pending",
    },
    type: { type: String, enum: ["Appointment", "Test"], required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true }, // refers to Appointment ID or Test Booking ID
  },
  {
    timestamps: true,
  }
);

const Payment = mongoose.model("Payment", PaymentSchema);
export default Payment;
