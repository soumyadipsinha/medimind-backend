import express from "express";
import {
  getReports,
  bookTest,
  uploadReportFile,
  viewReportFile,
} from "./report.controller.js";
import { restrictTo } from "../../middleware/rbac.middleware.js";
import multer from "multer";

const reportRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

reportRouter.get("/", getReports);
reportRouter.post("/book", bookTest);
reportRouter.post("/:id/upload", restrictTo("admin"), upload.single("file"), uploadReportFile);
reportRouter.get("/:id/view", viewReportFile);

export default reportRouter;
