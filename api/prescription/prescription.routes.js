import express from "express";
import {
  getPrescriptions,
  createPrescription,
  getPrintablePrescription,
} from "./prescription.controller.js";
import { verify } from "../../middleware/authentication.middleware.js";

const prescriptionRouter = express.Router();

prescriptionRouter.get("/", verify, getPrescriptions);
prescriptionRouter.post("/", verify, createPrescription);
prescriptionRouter.get("/print/:id", getPrintablePrescription); // Renders printable HTML view

export default prescriptionRouter;
