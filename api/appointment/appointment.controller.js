import Appointment from "./appointment.model.js";
import Patient from "../patient/patient.model.js";
import Doctor from "../doctor/doctor.model.js";
import { associateDoctorAndPatient } from "../../utils/consultationHelper.js";

// Fetch all appointments based on user role
export const getAppointments = async (req, res, next) => {
  try {
    const { id, role } = req.user;

    let query = {};
    if (role === "patient") {
      if (req.query.all !== "true") {
        const patient = await Patient.findOne({ user: id });
        if (!patient) return res.json([]);
        query = { patient: patient._id };
      }
    } else if (role === "doctor") {
      const doctor = await Doctor.findOne({ user: id });
      if (!doctor) return res.json([]);
      query = { doctor: doctor._id };
    }

    const appointments = await Appointment.find(query)
      .populate({
        path: "patient",
        populate: { path: "user", select: "name email avatarUrl" }
      })
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email avatarUrl" }
      })
      .populate("department", "name");

    res.json(appointments);
  } catch (error) {
    next(error);
  }
};

// Book an appointment (handles slot conflicts)
export const bookAppointment = async (req, res, next) => {
  try {
    const { doctorId, departmentId, date, timeSlot } = req.body;
    const userId = req.user.id;

    if (!doctorId || !departmentId || !date || !timeSlot) {
      return res.status(400).json({ message: "All booking details are required" });
    }

    const patient = await Patient.findOne({ user: userId });
    if (!patient) {
      return res.status(403).json({ message: "Patient profile not found. Complete registration." });
    }

    const doctorObj = await Doctor.findById(doctorId);
    if (!doctorObj) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Check slot conflicts (Double Booking prevention)
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    // Count existing active/confirmed appointments for this doctor on the selected day
    const doctorDailyApptsCount = await Appointment.countDocuments({
      doctor: doctorId,
      date: {
        $gte: bookingDate,
        $lt: new Date(bookingDate.getTime() + 24 * 60 * 60 * 1000)
      },
      status: { $in: ["Pending", "Confirmed"] }
    });

    const maxLimit = doctorObj.maxPatientsPerDay || 15;
    if (doctorDailyApptsCount >= maxLimit) {
      return res.status(429).json({ message: `Practitioner's consultation limit (${maxLimit} patients) has been reached for this date. Please choose another date.` });
    }

    const conflict = await Appointment.findOne({
      doctor: doctorId,
      date: {
        $gte: bookingDate,
        $lt: new Date(bookingDate.getTime() + 24 * 60 * 60 * 1000)
      },
      timeSlot,
      status: { $in: ["Pending", "Confirmed"] }
    });

    if (conflict) {
      return res.status(409).json({ message: "Time slot is already booked for this doctor. Choose another slot." });
    }

    const appointment = await Appointment.create({
      patient: patient._id,
      doctor: doctorId,
      department: departmentId,
      date: bookingDate,
      timeSlot,
      fee: doctorObj.consultationFee,
      status: "Pending",
      paymentStatus: "Pending"
    });

    res.status(201).json({
      message: "Appointment slot booked successfully",
      appointment
    });
  } catch (error) {
    next(error);
  }
};

// Update Appointment Status (Approve / Reject / Complete / Cancel)
export const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Approved, Confirmed, Completed, Cancelled

    const apt = await Appointment.findById(id);
    if (!apt) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    apt.status = status;
    await apt.save();

    if (status === "Confirmed" || status === "Completed") {
      await associateDoctorAndPatient(apt.doctor, apt.patient);
    }

    res.json({ message: `Appointment status updated to ${status}`, appointment: apt });
  } catch (error) {
    next(error);
  }
};

// Reschedule Appointment
export const rescheduleAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, timeSlot } = req.body;

    const apt = await Appointment.findById(id);
    if (!apt) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Conflict check for new date/slot
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    const conflict = await Appointment.findOne({
      _id: { $ne: id },
      doctor: apt.doctor,
      date: {
        $gte: bookingDate,
        $lt: new Date(bookingDate.getTime() + 24 * 60 * 60 * 1000)
      },
      timeSlot,
      status: { $in: ["Pending", "Confirmed"] }
    });

    if (conflict) {
      return res.status(409).json({ message: "Time slot is already booked. Select another time." });
    }

    apt.date = bookingDate;
    apt.timeSlot = timeSlot;
    apt.status = "Pending"; // Reset status for Admin approval
    await apt.save();

    res.json({ message: "Appointment rescheduled successfully, pending approval", appointment: apt });
  } catch (error) {
    next(error);
  }
};
