import express from "express";
import {
  getDoctors,
  createDoctor,
  updateDoctor,
  deleteDoctor,
} from "./doctor.controller.js";
import { restrictTo } from "../../middleware/rbac.middleware.js";

const doctorRouter = express.Router();

doctorRouter.get("/", getDoctors);
doctorRouter.post("/", restrictTo("admin"), createDoctor);
doctorRouter.put("/:id", restrictTo("admin"), updateDoctor);
doctorRouter.delete("/:id", restrictTo("admin"), deleteDoctor);

export default doctorRouter;
