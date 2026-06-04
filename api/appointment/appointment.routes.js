import express from "express";
import {
  getAppointments,
  bookAppointment,
  updateAppointmentStatus,
  rescheduleAppointment,
} from "./appointment.controller.js";

const appointmentRouter = express.Router();

appointmentRouter.get("/", getAppointments);
appointmentRouter.post("/book", bookAppointment);
appointmentRouter.put("/:id/status", updateAppointmentStatus);
appointmentRouter.put("/:id/reschedule", rescheduleAppointment);

export default appointmentRouter;
