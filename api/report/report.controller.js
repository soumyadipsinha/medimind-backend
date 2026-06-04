import Report from "./report.model.js";
import Service from "../service/service.model.js";
import Patient from "../patient/patient.model.js";
import sharepointService from "../../utils/sharepointServices.js";
import fs from "fs";
import path from "path";
import axios from "axios";

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

// Pure JS PDF Text Extractor (Matches plain ASCII strings from PDF chunks)
const extractTextFromPDF = (pdfBuffer) => {
  try {
    const content = pdfBuffer.toString("binary");
    const regex = /\(([^)]+)\)\s*Tj/g; // Tj operator holds text strings
    let matches;
    let text = "";
    while ((matches = regex.exec(content)) !== null) {
      text += matches[1] + " ";
    }
    if (text.length < 50) {
      const regexTJ = /\[([^\]]+)\]\s*TJ/g;
      while ((matches = regexTJ.exec(content)) !== null) {
        const parts = matches[1].match(/\(([^)]+)\)/g);
        if (parts) {
          text += parts.map(p => p.slice(1, -1)).join("") + " ";
        }
      }
    }
    return text.replace(/\\([\d()])/g, "$1").trim();
  } catch (err) {
    console.error("PDF text extraction warning:", err.message);
    return "";
  }
};

// Summarize lab report PDF or image in English, Hindi, or Bengali using OpenAI API
export const summarizeReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { language } = req.body;
    const report = await Report.findById(id).populate("test");
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    let fileBuffer = null;
    let fileName = "";

    // 1. Fetch file content
    if (report.sharepointItemId) {
      const driveId = process.env.SHAREPOINT_DATA_STORE_DRIVE_ID;
      const token = await sharepointService.getAccessToken();
      const spResponse = await axios.get(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${report.sharepointItemId}/content`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "arraybuffer"
        }
      );
      fileBuffer = Buffer.from(spResponse.data);
      
      const metaResponse = await axios.get(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${report.sharepointItemId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fileName = metaResponse.data.name || "report.pdf";
    } else {
      // Local fallback
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        const match = files.find(f => f.startsWith(`report-${id}`));
        if (match) {
          fileName = match;
          fileBuffer = fs.readFileSync(path.join(uploadDir, match));
        }
      }
    }

    if (!fileBuffer) {
      return res.status(404).json({ message: "Physical report file not found on server" });
    }

    const ext = path.extname(fileName).toLowerCase();
    const isImage = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext);
    const targetLang = language || "English";
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      const fallback = `[Report Summary in ${targetLang}]\n• Service: ${report.test?.name}\n• Notes: ${report.notes || "No notes provided"}\n• Warning: OpenAI API key is not set. Unable to scan report file contents.`;
      return res.json({ summary: fallback, warning: "OpenAI API key not set on backend. Showing fallback notes summary." });
    }

    let summaryText = "";

    if (isImage) {
      // Send image as base64 to OpenAI Chat Completions (supporting vision capability)
      const base64Image = fileBuffer.toString("base64");
      const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
      
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an expert clinical pathologist and medical imaging analyzer. You are helping to summarize diagnostic reports (lab tests, MRIs, X-rays) for patients to understand their health better.
This is for educational and helper purposes. A clear medical disclaimer is already shown to the patient.
Analyze the attached lab report/X-ray/MRI image and write a patient-friendly summary in the language: "${targetLang}" (use native script: Bengali script for Bengali, Devanagari for Hindi).
You must analyze the image, diagnose the potential condition or disease indicated in the text/scan, and explain the findings in simple terms. Do not refuse to analyze this medical information.
Include:
1. What the test/imaging is for and the potential diseases/conditions indicated.
2. The key findings/results shown in the image.
3. Lifestyle/medical recommendations based on these findings.
4. Keep the summary bullet-pointed, direct, and clear.
5. End with a standard medical disclaimer.`
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Please analyze this medical report image and write the summary." },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.4
        },
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      summaryText = response.data.choices[0].message.content.trim();
    } else {
      // Assume PDF - extract text using our regex parser
      let extractedText = extractTextFromPDF(fileBuffer);
      if (extractedText.length < 20) {
        extractedText = `Service Name: ${report.test?.name}. Doctor notes: ${report.notes || "None"}`;
      }

      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an expert clinical pathologist. You are helping to summarize diagnostic reports (lab tests, MRIs, X-rays) for patients to understand their health better.
This is for educational and helper purposes. A clear medical disclaimer is already shown to the patient.
Analyze the extracted text from the lab/radiology report and provide a patient-friendly summary in the language: "${targetLang}" (use native script: Bengali script for Bengali, Devanagari for Hindi).
You must explain what the report is about, the potential diseases/conditions indicated by the findings, and the results in simple terms. Do not refuse to analyze this medical text.
Include:
1. What the test is and the potential diseases/conditions indicated.
2. The key findings/results.
3. Lifestyle/dietary recommendations.
4. Keep the summary bullet-pointed, direct, and clear.
5. End with a standard medical disclaimer.`
            },
            {
              role: "user",
              content: `Report text content:\n${extractedText}\n\nPlease summarize this report.`
            }
          ],
          max_tokens: 500,
          temperature: 0.4
        },
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      summaryText = response.data.choices[0].message.content.trim();
    }

    res.json({ summary: summaryText });
  } catch (error) {
    console.error("Report summarization error:", error.response?.data || error.message);
    res.status(500).json({ message: "Failed to summarize report", error: error.message });
  }
};
