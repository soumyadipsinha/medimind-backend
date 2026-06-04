import Message from "./chat.model.js";
import User from "../user/user.model.js";
import Appointment from "../appointment/appointment.model.js";
import Doctor from "../doctor/doctor.model.js";
import Patient from "../patient/patient.model.js";

const isValidDate = (date) => {
  return date && !isNaN(new Date(date).getTime());
};

// Retrieve list of doctors/patients the current user is eligible to chat with
export const getChatUsers = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    let chatUsers = [];

    if (currentUserRole === "patient") {
      const patientProfile = await Patient.findOne({ user: currentUserId });
      if (!patientProfile) {
        return res.json([]);
      }

      // Find doctors with confirmed or completed appointments
      const appointments = await Appointment.find({
        patient: patientProfile._id,
        status: { $in: ["Confirmed", "Completed"] },
      }).populate({
        path: "doctor",
        populate: { path: "user", select: "name email avatarUrl lastSeen role" }
      });

      // Unique doctor users
      const seenDoctorUsers = new Set();
      appointments.forEach((apt) => {
        if (apt.doctor && apt.doctor.user && !seenDoctorUsers.has(apt.doctor.user._id.toString())) {
          seenDoctorUsers.add(apt.doctor.user._id.toString());
          chatUsers.push({
            _id: apt.doctor.user._id,
            name: apt.doctor.user.name,
            email: apt.doctor.user.email,
            avatarUrl: apt.doctor.user.avatarUrl,
            lastSeen: apt.doctor.user.lastSeen,
            role: apt.doctor.user.role,
            specialization: apt.doctor.specialization,
          });
        }
      });

    } else if (currentUserRole === "doctor") {
      const doctorProfile = await Doctor.findOne({ user: currentUserId });
      if (!doctorProfile) {
        return res.json([]);
      }

      // Find patients with confirmed or completed appointments
      const appointments = await Appointment.find({
        doctor: doctorProfile._id,
        status: { $in: ["Confirmed", "Completed"] },
      }).populate({
        path: "patient",
        populate: { path: "user", select: "name email avatarUrl lastSeen role" }
      });

      // Unique patient users
      const seenPatientUsers = new Set();
      appointments.forEach((apt) => {
        if (apt.patient && apt.patient.user && !seenPatientUsers.has(apt.patient.user._id.toString())) {
          seenPatientUsers.add(apt.patient.user._id.toString());
          chatUsers.push({
            _id: apt.patient.user._id,
            name: apt.patient.user.name,
            email: apt.patient.user.email,
            avatarUrl: apt.patient.user.avatarUrl,
            lastSeen: apt.patient.user.lastSeen,
            role: apt.patient.user.role,
            bloodGroup: apt.patient.bloodGroup,
          });
        }
      });
    } else if (currentUserRole === "admin") {
      // Admins can see all active patients and doctors
      const allUsers = await User.find({ role: { $in: ["doctor", "patient"] }, isActive: true })
        .select("name email avatarUrl lastSeen role")
        .lean();
      chatUsers = allUsers;
    }

    // Attach last message and unread count to each user
    const usersWithLastMessage = await Promise.all(
      chatUsers.map(async (user) => {
        const lastMessage = await Message.findOne({
          $or: [
            { sender: currentUserId, receiver: user._id },
            { sender: user._id, receiver: currentUserId },
          ],
        })
          .sort({ createdAt: -1 })
          .lean();

        const unreadCount = await Message.countDocuments({
          sender: user._id,
          receiver: currentUserId,
          isRead: false,
        });

        return {
          ...user,
          unreadCount,
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                sender: lastMessage.sender,
              }
            : null,
        };
      })
    );

    res.json(usersWithLastMessage);
  } catch (error) {
    next(error);
  }
};

// Retrieve chat history with a specific partner
export const getMessages = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const { before, limit = 50 } = req.query;
    const currentUserId = req.user.id;

    const query = {
      $or: [
        { sender: currentUserId, receiver: partnerId },
        { sender: partnerId, receiver: currentUserId },
      ],
    };

    if (isValidDate(before)) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 }) // Pagination sorting
      .limit(parseInt(limit) + 1)
      .lean();

    const hasMore = messages.length > parseInt(limit);
    if (hasMore) {
      messages.pop();
    }

    // Return in chronological order
    res.json({
      messages: messages.reverse(),
      hasMore,
    });
  } catch (error) {
    next(error);
  }
};

// Mark private messages as seen
export const markMessagesAsSeen = async (req, res, next) => {
  try {
    const { partnerId } = req.body;
    const currentUserId = req.user.id;

    if (!partnerId) {
      return res.status(400).json({ message: "partnerId is required" });
    }

    await Message.updateMany(
      {
        sender: partnerId,
        receiver: currentUserId,
        isRead: false,
      },
      {
        $set: { isRead: true },
      }
    );

    res.json({ message: "Messages marked as seen" });
  } catch (error) {
    next(error);
  }
};
