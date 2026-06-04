import User from "../user/user.model.js";
import Doctor from "../doctor/doctor.model.js";
import Patient from "../patient/patient.model.js";
import Department from "../department/department.model.js";
import Appointment from "../appointment/appointment.model.js";
import Report from "../report/report.model.js";
import Payment from "../payment/payment.model.js";

export const getDashboardAnalytics = async (req, res, next) => {
  try {
    const totalPatients = await Patient.countDocuments({});
    const totalDoctors = await Doctor.countDocuments({});
    const totalDepartments = await Department.countDocuments({});
    
    // Today's Appointments count
    const today = new Date();
    today.setHours(0,0,0,0);
    const tom = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const todaysAppointments = await Appointment.countDocuments({
      date: { $gte: today, $lt: tom }
    });

    // Monthly Revenue
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyPayments = await Payment.find({
      status: "Success",
      createdAt: { $gte: firstDayOfMonth }
    });
    const monthlyRevenue = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);

    const pendingReports = await Report.countDocuments({ isCompleted: false });
    const totalTestsBooked = await Report.countDocuments({});

    // Revenue Chart data (Grouped by month/day or simply return array of payments)
    const recentPayments = await Payment.find({ status: "Success" })
      .sort({ createdAt: -1 })
      .limit(100)
      .select("amount createdAt type");

    // Department Analytics (Counts of appointments per department)
    const appointments = await Appointment.find({}).populate("department", "name");
    const departmentCounts = {};
    appointments.forEach((apt) => {
      if (apt.department && apt.department.name) {
        departmentCounts[apt.department.name] = (departmentCounts[apt.department.name] || 0) + 1;
      }
    });

    const departmentAnalytics = Object.keys(departmentCounts).map((key) => ({
      name: key,
      appointments: departmentCounts[key]
    }));

    res.json({
      metrics: {
        totalPatients,
        totalDoctors,
        totalDepartments,
        todaysAppointments,
        monthlyRevenue,
        pendingReports,
        totalTestsBooked
      },
      recentPayments,
      departmentAnalytics
    });
  } catch (error) {
    next(error);
  }
};
