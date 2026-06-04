import express from "express";
import {
  getPrescriptions,
  createPrescription,
  getPrintablePrescription,
  generateAdvice,
  summarizePrescription,
} from "./prescription.controller.js";
import { verify } from "../../middleware/authentication.middleware.js";

const prescriptionRouter = express.Router();

prescriptionRouter.get("/", verify, getPrescriptions);
prescriptionRouter.post("/", verify, createPrescription);
prescriptionRouter.post("/generate-advice", verify, generateAdvice);
prescriptionRouter.post("/summarize", verify, summarizePrescription);
prescriptionRouter.get("/print/:id", getPrintablePrescription); // Renders printable HTML view

export default prescriptionRouter;
