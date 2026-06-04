import Prescription from "./prescription.model.js";
import Patient from "../patient/patient.model.js";
import Doctor from "../doctor/doctor.model.js";
import Appointment from "../appointment/appointment.model.js";
import { associateDoctorAndPatient } from "../../utils/consultationHelper.js";
import axios from "axios";

// Fetch prescriptions list
export const getPrescriptions = async (req, res, next) => {
  try {
    const { id, role } = req.user;

    let query = {};
    if (role === "patient") {
      const patient = await Patient.findOne({ user: id });
      if (!patient) return res.json([]);
      query = { patient: patient._id };
    } else if (role === "doctor") {
      const doctor = await Doctor.findOne({ user: id });
      if (!doctor) return res.json([]);
      query = { doctor: doctor._id };
    }

    const prescriptions = await Prescription.find(query)
      .populate({
        path: "patient",
        populate: { path: "user", select: "name email" }
      })
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" }
      })
      .populate("appointment");

    res.json(prescriptions);
  } catch (error) {
    next(error);
  }
};

// Create a Digital Prescription
export const createPrescription = async (req, res, next) => {
  try {
    const { appointmentId, diagnosis, symptoms, advice, medicines, recommendedTests, followUpDate } = req.body;
    const userId = req.user.id;

    if (!appointmentId || !diagnosis || !advice || !medicines) {
      return res.status(400).json({ message: "Appointment, diagnosis, advice, and medicines are required" });
    }

    const doctorProfile = await Doctor.findOne({ user: userId });
    if (!doctorProfile) {
      return res.status(403).json({ message: "Only registered doctors can create prescriptions" });
    }

    const apt = await Appointment.findById(appointmentId);
    if (!apt) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    const prescription = await Prescription.create({
      patient: apt.patient,
      doctor: doctorProfile._id,
      appointment: appointmentId,
      diagnosis,
      symptoms,
      advice,
      medicines,
      recommendedTests: recommendedTests || [],
      followUpDate,
      pdfUrl: `/api/prescriptions/print/${appointmentId}` // Printable web URL format
    });

    // Mark appointment as Completed
    apt.status = "Completed";
    await apt.save();

    await associateDoctorAndPatient(doctorProfile._id, apt.patient);

    res.status(201).json({ message: "Prescription recorded successfully", prescription });
  } catch (error) {
    next(error);
  }
};

// Generate EMR Lifestyle/Clinical Advice using OpenAI API
export const generateAdvice = async (req, res, next) => {
  try {
    const { disease, symptoms } = req.body;
    if (!disease) {
      return res.status(400).json({ message: "Disease name (diagnosis) is required" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Return a clean fallback message if the OpenAI key is not configured
      const fallback = `1. Stay hydrated and get adequate rest.\n2. Monitor symptoms closely and avoid triggers.\n3. Follow up with your doctor if symptoms persist or worsen.\n4. Maintain a light, balanced diet tailored for ${disease}.`;
      return res.json({ advice: fallback, warning: "OpenAI API key not set on backend. Showing fallback advice." });
    }

    const prompt = `You are a helpful medical assistant. A patient is diagnosed with "${disease}" presenting with symptoms: "${symptoms || "none specified"}". Write a concise, bullet-pointed, clinical and lifestyle advice (dietary guidelines, habits, warning signs) for the patient. Do not include introductory text, headers, or concluding conversational phrases, just the points. Keep it clear, practical, and list-format.`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert clinical assistant." },
          { role: "user", content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.7
      },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const generatedText = response.data.choices[0].message.content.trim();
    res.json({ advice: generatedText });
  } catch (error) {
    console.error("OpenAI generation failed:", error.response?.data || error.message);
    res.status(500).json({ message: "AI Advice generation failed", error: error.message });
  }
};

// Summarize EMR Prescription in Local Language (Hindi, Bengali, Punjabi) using OpenAI API
export const summarizePrescription = async (req, res, next) => {
  try {
    const { prescriptionId, language } = req.body;
    if (!prescriptionId || !language) {
      return res.status(400).json({ message: "Prescription ID and Language are required" });
    }

    const pres = await Prescription.findById(prescriptionId)
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name" }
      });

    if (!pres) {
      return res.status(404).json({ message: "Prescription not found" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const fallback = `[Summary in ${language}]\n• Diagnosis: ${pres.diagnosis}\n• Advice: ${pres.advice}\n• Warning: OpenAI API key is not set. Showing fallback original details.`;
      return res.json({ summary: fallback, warning: "OpenAI API key not set on backend. Showing fallback summary." });
    }

    const medicinesStr = pres.medicines.map((m) => `- ${m.name}: Dosage: ${m.dosage}, Frequency: ${m.frequency}, Duration: ${m.duration}`).join("\n");
    const prompt = `You are a helpful medical translator and clinic assistant. Provide a patient-friendly summary of the following prescription details in the language: "${language}" (Hindi, Bengali, or Punjabi using its respective script).

Prescription Details:
- Doctor: Dr. ${pres.doctor?.user?.name || "Practitioner"}
- Diagnosis/Disease: ${pres.diagnosis}
- Symptoms: ${pres.symptoms || "None reported"}
- Medicines list:
${medicinesStr}
- General Advice & Lifestyle Instructions: ${pres.advice}

CRITICAL RULES:
1. DO NOT translate the names of the medicines (e.g. Paracetamol, Ibuprofen, Amoxicillin, etc. MUST remain in English letters/spelling exactly as provided, like "Paracetamol", "Ibuprofen").
2. Translate/explain the instructions (dosage, frequency, duration, advice) and the diagnosis/symptoms into the target language (${language}).
3. Output a clear, bullet-pointed, patient-friendly summary in the target language script (Devanagari script for Hindi, Bengali script for Bengali, Gurmukhi script for Punjabi). Do not write transliterated English (e.g. do not write "apko paracetamol khani hai" in English characters. Write in the native script: "आपको Paracetamol खानी है").
4. Keep the output concise, clear, and direct. Do not include conversational headers or introductory lines. Just start with the summary.`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert multilingual medical translator." },
          { role: "user", content: prompt }
        ],
        max_tokens: 600,
        temperature: 0.3
      },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const generatedText = response.data.choices[0].message.content.trim();
    res.json({ summary: generatedText });
  } catch (error) {
    console.error("AI summarization failed:", error.response?.data || error.message);
    res.status(500).json({ message: "AI Summarization failed", error: error.message });
  }
};

// Print/Generate HTML View of Prescription
export const getPrintablePrescription = async (req, res, next) => {
  try {
    const { id } = req.params; // Prescription ID or Appointment ID

    const pres = await Prescription.findOne({
      $or: [{ _id: id }, { appointment: id }]
    })
      .populate({
        path: "patient",
        populate: { path: "user", select: "name email" }
      })
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" }
      });

    if (!pres) {
      return res.status(404).send("Prescription not found");
    }

    // Return HTML styled view for printing
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prescription - MediMind</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
          .header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; }
          .logo { font-size: 24px; font-weight: bold; color: #3b82f6; }
          .doctor-info { text-align: right; }
          .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f3f4f6; padding: 15px; border-radius: 8px; }
          .medicines { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .medicines th, .medicines td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
          .medicines th { background-color: #f3f4f6; }
          .footer { margin-top: 50px; border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 14px; text-align: center; color: #6b7280; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: right;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Print Prescription</button>
        </div>
        <div class="header">
          <div>
            <div class="logo">MEDIMIND CLINIC</div>
            <div>Your Health, Our Priority</div>
          </div>
          <div class="doctor-info">
            <div style="font-weight: bold; font-size: 18px;">Dr. ${pres.doctor.user.name}</div>
            <div>${pres.doctor.qualification} - ${pres.doctor.specialization}</div>
            <div>Reg No: ${pres.doctor.registrationNumber}</div>
          </div>
        </div>
        
        <div class="details">
          <div>
            <strong>Patient Name:</strong> ${pres.patient.user.name}<br>
            <strong>Gender / Age:</strong> ${pres.patient.gender} / ${pres.patient.age} years<br>
            <strong>Blood Group:</strong> ${pres.patient.bloodGroup}
          </div>
          <div style="text-align: right;">
            <strong>Date:</strong> ${new Date(pres.createdAt).toLocaleDateString()}<br>
            <strong>Prescription ID:</strong> ${pres._id}
          </div>
        </div>

        ${pres.symptoms ? `
          <h3>Symptoms:</h3>
          <p>${pres.symptoms}</p>
        ` : ''}

        <h3>Diagnosis (Disease):</h3>
        <p>${pres.diagnosis}</p>

        <h3>Rx (Medicines):</h3>
        <table class="medicines">
          <thead>
            <tr>
              <th>Medicine Name</th>
              <th>Dosage</th>
              <th>Frequency</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            ${pres.medicines.map(med => `
              <tr>
                <td><strong>${med.name}</strong></td>
                <td>${med.dosage}</td>
                <td>${med.frequency}</td>
                <td>${med.duration}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3>Advice / Instructions:</h3>
        <p>${pres.advice}</p>

        ${pres.recommendedTests.length > 0 ? `
          <h3>Recommended Laboratory Tests / Imaging:</h3>
          <ul>
            ${pres.recommendedTests.map(test => `<li>${test}</li>`).join('')}
          </ul>
        ` : ''}

        ${pres.followUpDate ? `
          <p><strong>Follow-Up Date:</strong> ${new Date(pres.followUpDate).toLocaleDateString()}</p>
        ` : ''}

        <div class="footer">
          This is a computer-generated digital prescription from MediMind SaaS.
        </div>
      </body>
      </html>
    `;
    res.send(html);
  } catch (error) {
    next(error);
  }
};
