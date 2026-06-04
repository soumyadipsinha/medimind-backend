import Report from "./report.model.js";
import Service from "../service/service.model.js";
import Patient from "../patient/patient.model.js";
import sharepointService from "../../utils/sharepointServices.js";
import fs from "fs";
import path from "path";

// List all reports
export const getReports = async (req, res, next) => {
  try {
    const { id, role } = req.user;

    let query = {};
    if (role === "patient") {
      const patient = await Patient.findOne({ user: id });
      if (!patient) return res.json([]);
      query = { patient: patient._id };
    }

    const reports = await Report.find(query)
      .populate({
        path: "patient",
        populate: { path: "user", select: "name email" }
      })
      .populate("test", "name price departments");

    res.json(reports);
  } catch (error) {
    next(error);
  }
};

// Book a lab test/imaging
export const bookTest = async (req, res, next) => {
  try {
    const { testId, appointmentId } = req.body;
    const userId = req.user.id;

    if (!testId) {
      return res.status(400).json({ message: "Test ID is required" });
    }

    const patient = await Patient.findOne({ user: userId });
    if (!patient) {
      return res.status(403).json({ message: "Patient profile not found." });
    }

    const serviceObj = await Service.findById(testId);
    if (!serviceObj) {
      return res.status(404).json({ message: "Medical test not found" });
    }

    const report = await Report.create({
      patient: patient._id,
      test: testId,
      appointment: appointmentId || null,
      price: serviceObj.price,
      paymentStatus: "Pending"
    });

    res.status(201).json({ message: "Test booked successfully", report });
  } catch (error) {
    next(error);
  }
};

// Upload report file and complete (Admin/Lab role)
export const uploadReportFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ message: "Test report record not found" });
    }

    let fileUrl = `/api/reports/${id}/view`;
    let sharepointItemId = null;

    if (req.file) {
      const fileName = `report-${id}-${Date.now()}${path.extname(req.file.originalname)}`;
      const driveId = process.env.SHAREPOINT_DATA_STORE_DRIVE_ID;

      // Try uploading to SharePoint if configured
      if (driveId && process.env.SHAREPOINT_CLIENT_ID && process.env.SHAREPOINT_TENANT_ID) {
        try {
          const folderPath = "MediMindReports";
          const uploadRes = await sharepointService.uploadSmallFile(
            driveId,
            folderPath,
            fileName,
            req.file.buffer
          );
          
          sharepointItemId = uploadRes.id;
        } catch (spError) {
          console.error("SharePoint upload failed, falling back to local file path: ", spError.message);
          // Save locally
          const uploadDir = path.join(process.cwd(), "public", "uploads");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          fs.writeFileSync(path.join(uploadDir, fileName), req.file.buffer);
        }
      } else {
        // Fallback to saving report locally
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        fs.writeFileSync(path.join(uploadDir, fileName), req.file.buffer);
      }
    } else {
      return res.status(400).json({ message: "Report PDF file is required" });
    }

    report.fileUrl = fileUrl;
    if (sharepointItemId) {
      report.sharepointItemId = sharepointItemId;
    }
    report.notes = notes || "";
    report.isCompleted = true;
    report.completedAt = new Date();
    report.paymentStatus = "Paid"; // Assuming payment completed
    
    await report.save();

    res.json({ message: "Report uploaded and marked completed successfully", report });
  } catch (error) {
    next(error);
  }
};

// Stream/View Report file
export const viewReportFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (report.sharepointItemId) {
      const driveId = process.env.SHAREPOINT_DATA_STORE_DRIVE_ID;
      await sharepointService.streamFile(
        driveId,
        report.sharepointItemId,
        req,
        res,
        "application/pdf"
      );
    } else {
      // Local fallback: search public/uploads for files starting with report-[id]
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        const match = files.find(f => f.startsWith(`report-${id}`));
        if (match) {
          const filePath = path.join(uploadDir, match);
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", "inline");
          return res.sendFile(filePath);
        }
      }
      res.status(404).json({ message: "Physical report file not found on server" });
    }
  } catch (error) {
    next(error);
  }
};
