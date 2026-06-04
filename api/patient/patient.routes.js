import express from "express";
import {
  getPatients,
  searchPatients,
  getPatientLogs,
} from "./patient.controller.js";
import { restrictTo } from "../../middleware/rbac.middleware.js";

const patientRouter = express.Router();

patientRouter.get("/", restrictTo("admin", "doctor"), getPatients);
patientRouter.get("/search", restrictTo("admin", "doctor"), searchPatients);
patientRouter.get("/:id/logs", restrictTo("admin", "doctor"), getPatientLogs);

export default patientRouter;
