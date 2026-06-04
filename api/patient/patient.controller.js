import Patient from "./patient.model.js";
import Appointment from "../appointment/appointment.model.js";
import Prescription from "../prescription/prescription.model.js";
import Report from "../report/report.model.js";
import Payment from "../payment/payment.model.js";

// Fetch all patients with user details
export const getPatients = async (req, res, next) => {
  try {
    const patients = await Patient.find({}).populate("user", "name email avatarUrl isActive lastSeen");
    res.json(patients);
  } catch (error) {
    next(error);
  }
};

// Search patients by name, email, or mobile number
export const searchPatients = async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    // Direct search matching Patient properties, or finding Users first
    const patients = await Patient.find({
      $or: [
        { mobileNumber: { $regex: query, $options: "i" } },
        { bloodGroup: { $regex: query, $options: "i" } }
      ]
    }).populate("user", "name email avatarUrl isActive");

    // Filter populated ones that match search
    const filtered = patients.filter((pat) => {
      return (
        pat.user &&
        (pat.user.name.toLowerCase().includes(query.toLowerCase()) ||
          pat.user.email.toLowerCase().includes(query.toLowerCase()))
      );
    });

    res.json(filtered);
  } catch (error) {
    next(error);
  }
};

// Fetch complete profile logs of a single patient
export const getPatientLogs = async (req, res, next) => {
  try {
    const { id } = req.params; // Patient Profile ID

    const patient = await Patient.findById(id).populate("user", "name email avatarUrl lastSeen");
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Gather records asynchronously
    const appointments = await Appointment.find({ patient: id })
      .populate("doctor", "specialization user")
      .populate("department", "name");
      
    const prescriptions = await Prescription.find({ patient: id })
      .populate("doctor", "specialization user");

    const reports = await Report.find({ patient: id })
      .populate("test", "name price department");

    const payments = await Payment.find({ user: patient.user?._id });

    res.json({
      patient,
      appointments,
      prescriptions,
      reports,
      payments,
    });
  } catch (error) {
    next(error);
  }
};
