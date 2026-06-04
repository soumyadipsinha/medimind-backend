import express from "express";
import {
  initiatePayment,
  verifyPayment,
  getPaymentHistory,
} from "./payment.controller.js";

const paymentRouter = express.Router();

paymentRouter.get("/history", getPaymentHistory);
paymentRouter.post("/initiate", initiatePayment);
paymentRouter.post("/verify", verifyPayment);

export default paymentRouter;
