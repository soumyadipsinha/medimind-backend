import Payment from "./payment.model.js";
import Appointment from "../appointment/appointment.model.js";
import Report from "../report/report.model.js";

// Initiate a Mock Razorpay Payment
export const initiatePayment = async (req, res, next) => {
  try {
    const { amount, type, referenceId } = req.body;
    const userId = req.user.id;

    if (!amount || !type || !referenceId) {
      return res.status(400).json({ message: "Amount, type, and referenceId are required" });
    }

    // Generate a mock order ID (razorpay structure: order_XXXXXX)
    const mockOrderId = `order_${Math.random().toString(36).substring(2, 15)}`;

    res.json({
      message: "Mock payment initiated",
      amount,
      orderId: mockOrderId,
      key: "rzp_test_mockkey", // Dummy Razorpay key
      referenceId,
      type
    });
  } catch (error) {
    next(error);
  }
};

// Confirm/Verify Payment
export const verifyPayment = async (req, res, next) => {
  try {
    const { orderId, paymentId, signature, referenceId, type, amount } = req.body;
    const userId = req.user.id;

    if (!orderId || !paymentId || !referenceId || !type) {
      return res.status(400).json({ message: "Missing confirmation details" });
    }

    // Record the payment
    const payment = await Payment.create({
      user: userId,
      amount,
      paymentId,
      orderId,
      signature: signature || "mock_sig_verification",
      status: "Success",
      type,
      referenceId
    });

    // Update appointment or test payment status
    if (type === "Appointment") {
      await Appointment.findByIdAndUpdate(referenceId, {
        paymentStatus: "Paid",
        paymentId: paymentId
      });
    } else if (type === "Test") {
      await Report.findByIdAndUpdate(referenceId, {
        paymentStatus: "Paid",
        fileUrl: "" // Reset/prepare for upload
      });
    }

    res.json({
      message: "Payment verified and recorded successfully",
      payment
    });
  } catch (error) {
    next(error);
  }
};

// Get user payment history
export const getPaymentHistory = async (req, res, next) => {
  try {
    const history = await Payment.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(history);
  } catch (error) {
    next(error);
  }
};
