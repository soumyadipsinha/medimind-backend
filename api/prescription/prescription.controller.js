import Prescription from "./prescription.model.js";
import Patient from "../patient/patient.model.js";
import Doctor from "../doctor/doctor.model.js";
import Appointment from "../appointment/appointment.model.js";

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
    const { appointmentId, diagnosis, advice, medicines, recommendedTests, followUpDate } = req.body;
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
      advice,
      medicines,
      recommendedTests: recommendedTests || [],
      followUpDate,
      pdfUrl: `/api/prescriptions/print/${appointmentId}` // Printable web URL format
    });

    // Mark appointment as Completed
    apt.status = "Completed";
    await apt.save();

    res.status(201).json({ message: "Prescription recorded successfully", prescription });
  } catch (error) {
    next(error);
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

        <h3>Diagnosis:</h3>
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
