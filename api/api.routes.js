import { verify } from "../middleware/authentication.middleware.js";
import { healthCheck, notFound } from "./api.controller.js";
import authRouter from "./auth/auth.routes.js";
import departmentRouter from "./department/department.routes.js";
import serviceRouter from "./service/service.routes.js";
import doctorRouter from "./doctor/doctor.routes.js";
import patientRouter from "./patient/patient.routes.js";
import appointmentRouter from "./appointment/appointment.routes.js";
import prescriptionRouter from "./prescription/prescription.routes.js";
import reportRouter from "./report/report.routes.js";
import paymentRouter from "./payment/payment.routes.js";
import chatRouter from "./chat/chat.routes.js";
import analyticsRouter from "./analytics/analytics.routes.js";

export default function registerRoutes(app) {
  app.get("/api", healthCheck);
  app.use("/api/auth", authRouter);

  // Authenticated routes
  app.use(verify);

  app.use("/api/departments", departmentRouter);
  app.use("/api/services", serviceRouter);
  app.use("/api/doctors", doctorRouter);
  app.use("/api/patients", patientRouter);
  app.use("/api/appointments", appointmentRouter);
  app.use("/api/prescriptions", prescriptionRouter);
  app.use("/api/reports", reportRouter);
  app.use("/api/payments", paymentRouter);
  app.use("/api/chats", chatRouter);
  app.use("/api/analytics", analyticsRouter);

  app.use(notFound);
}
