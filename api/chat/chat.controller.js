import Message from "./chat.model.js";
import User from "../user/user.model.js";
import Appointment from "../appointment/appointment.model.js";
import Doctor from "../doctor/doctor.model.js";
import Patient from "../patient/patient.model.js";
import axios from "axios";

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
      let patientProfile = await Patient.findOne({ user: currentUserId });
      if (!patientProfile) {
        return res.json([]);
      }

      // Sync doctors from all confirmed/completed appointments
      const appointments = await Appointment.find({
        patient: patientProfile._id,
        status: { $in: ["Confirmed", "Completed"] }
      });
      if (appointments.length > 0) {
        const doctorIds = appointments.map((a) => a.doctor);
        await Patient.findByIdAndUpdate(patientProfile._id, {
          $addToSet: { doctors: { $each: doctorIds } }
        });
      }

      // Now fetch with populated user fields
      patientProfile = await Patient.findById(patientProfile._id).populate({
        path: "doctors",
        populate: { path: "user", select: "name email avatarUrl lastSeen role" }
      });

      if (patientProfile && patientProfile.doctors) {
        patientProfile.doctors.forEach((doc) => {
          if (doc && doc.user) {
            chatUsers.push({
              _id: doc.user._id,
              name: doc.user.name,
              email: doc.user.email,
              avatarUrl: doc.user.avatarUrl,
              lastSeen: doc.user.lastSeen,
              role: doc.user.role,
              specialization: doc.specialization,
            });
          }
        });
      }

    } else if (currentUserRole === "doctor") {
      let doctorProfile = await Doctor.findOne({ user: currentUserId });
      if (!doctorProfile) {
        return res.json([]);
      }

      // Sync patients from all confirmed/completed appointments
      const appointments = await Appointment.find({
        doctor: doctorProfile._id,
        status: { $in: ["Confirmed", "Completed"] }
      });
      if (appointments.length > 0) {
        const patientIds = appointments.map((a) => a.patient);
        await Doctor.findByIdAndUpdate(doctorProfile._id, {
          $addToSet: { patients: { $each: patientIds } }
        });
      }

      // Now fetch with populated user fields
      doctorProfile = await Doctor.findById(doctorProfile._id).populate({
        path: "patients",
        populate: { path: "user", select: "name email avatarUrl lastSeen role" }
      });

      if (doctorProfile && doctorProfile.patients) {
        doctorProfile.patients.forEach((pat) => {
          if (pat && pat.user) {
            chatUsers.push({
              _id: pat.user._id,
              name: pat.user.name,
              email: pat.user.email,
              avatarUrl: pat.user.avatarUrl,
              lastSeen: pat.user.lastSeen,
              role: pat.user.role,
              bloodGroup: pat.bloodGroup,
            });
          }
        });
      }
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

// AI Medical Assistant chatbot endpoint
export const aiChatbot = async (req, res, next) => {
  try {
    const { message, language } = req.body;
    if (!message) {
      return res.status(400).json({ message: "Message content is required" });
    }

    const targetLang = language || "English";
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      const fallback = targetLang === "Bengali"
        ? "দুঃখিত, এআই হেলথ অ্যাসিস্ট্যান্ট পরিষেবাটি বর্তমানে উপলব্ধ নয়। অনুগ্রহ করে পরে চেষ্টা করুন বা সরাসরি পরামর্শ করুন।"
        : targetLang === "Hindi"
        ? "क्षमा करें, AI स्वास्थ्य सहायक सेवा वर्तमान में उपलब्ध नहीं है। कृपया बाद में प्रयास करें या सीधे संपर्क करें।"
        : "Sorry, the AI health assistant service is currently unavailable. Please try again later or consult directly.";
      return res.json({ reply: fallback, warning: "OpenAI API key not configured on server." });
    }

    const systemPrompt = `You are MediMind AI, a helpful and professional clinical assistant chatbot.
The user's preferred language is ${targetLang}. You must respond in this language (${targetLang}) using its standard script (Gurmukhi/Bengali/Devanagari/Latin characters as appropriate).
CRITICAL CONSTRAINTS:
1. ONLY discuss topics related to health, clinical care, wellness, medicine, symptoms, diseases, healthcare advice, and biology.
2. If the user asks general off-topic questions (e.g., coding, jokes, history, geography, mathematics, entertainment), politely and professionally decline to answer, explaining in the target language (${targetLang}) that you are specialized strictly in medical assistance and cannot help with non-health topics.
3. Keep your advice brief, practical, empathetic, and formatted in clear bullet points where appropriate.
4. Always include a disclaimer at the end advising the user to consult a human medical practitioner for final decisions.`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 400,
        temperature: 0.6
      },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const reply = response.data.choices[0].message.content.trim();
    res.json({ reply });
  } catch (error) {
    console.error("OpenAI chatbot error:", error.response?.data || error.message);
    res.status(500).json({ message: "AI chatbot failed to respond", error: error.message });
  }
};
