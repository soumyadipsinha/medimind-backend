import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import Message from "../api/chat/chat.model.js";
import User from "../api/user/user.model.js";
import Patient from "../api/patient/patient.model.js";
import Doctor from "../api/doctor/doctor.model.js";
import { notificationService } from "../api/notification/notification.service.js";
import { NOTIFICATION_CHANNELS } from "../api/notification/notification.events.js";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
    },
  });

  // Authentication Middleware for Socket.io
  io.use((socket, next) => {
    try {
      let token = null;

      // Method 1: Check socket.handshake.auth (recommended for mobile apps)
      if (socket.handshake.auth && socket.handshake.auth.token) {
        token = socket.handshake.auth.token;
        console.log("Token found in handshake.auth");
      }

      // Method 2: Check Authorization header in extraHeaders
      if (!token) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          token = authHeader.substring(7);
          console.log("Token found in Authorization header");
        }
      }

      // Method 3: Fallback to cookies (for web browsers)
      if (!token) {
        const cookies = socket.request.headers.cookie;
        if (cookies) {
          const parsedCookies = cookie.parse(cookies);
          token = parsedCookies.accessToken;
          if (token) {
            console.log("Token found in cookies");
          }
        }
      }

      // OLD CODE (cookie-only authentication)
      // const cookies = socket.request.headers.cookie;
      // if (!cookies) {
      //   return next(new Error("Authentication error: No cookies found"));
      // }
      // const parsedCookies = cookie.parse(cookies);
      // const token = parsedCookies.accessToken;

      if (!token) {
        console.error("No token found in any location");
        console.error("handshake.auth:", socket.handshake.auth);
        console.error("handshake.headers:", socket.handshake.headers);
        return next(new Error("Authentication error: No token found"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      console.log(`User authenticated: ${decoded.id}`);
      next();
    } catch (err) {
      console.error("Token verification error:", err.message);
      next(new Error("Authentication error: Invalid token"));
    }
  });

  const onlineUsers = new Map(); // userId -> Set of socket IDs

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    console.log(`User connected: ${userId} (Socket ID: ${socket.id})`);

    // Track online status across multiple tabs/connections
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Broadcast updated online users list
    io.emit("online_users", Array.from(onlineUsers.keys()));

    // Create and join a room named after the user's MongoDB ID
    socket.join(userId);
    console.log(`User ${userId} joined room ${userId}`);

    // Allow user to request current online list (useful on refresh)
    socket.on("online_users_request", () => {
      socket.emit("online_users", Array.from(onlineUsers.keys()));
    });

    socket.on("send_message", async (data) => {
      try {
        const { receiverId, content } = data;
        if (!receiverId || !content) {
          throw new Error("Missing receiverId or content");
        }

        // Validate Doctor-Patient relationship (must have an active/past appointment)
        const senderUser = await User.findById(userId);
        const receiverUser = await User.findById(receiverId);

        if (!senderUser || !receiverUser) {
          throw new Error("Sender or receiver not found");
        }

        let isAllowed = false;
        if (senderUser.role === "admin" || receiverUser.role === "admin") {
          isAllowed = true;
        } else {
          // Find Patient and Doctor profiles
          let patientId = null;
          let doctorId = null;

          if (senderUser.role === "patient" && receiverUser.role === "doctor") {
            const patient = await Patient.findOne({ user: userId });
            const doctor = await Doctor.findOne({ user: receiverId });
            if (patient && doctor && patient.doctors && patient.doctors.some((id) => id.toString() === doctor._id.toString())) {
              isAllowed = true;
            }
          } else if (senderUser.role === "doctor" && receiverUser.role === "patient") {
            const doctor = await Doctor.findOne({ user: userId });
            const patient = await Patient.findOne({ user: receiverId });
            if (doctor && patient && doctor.patients && doctor.patients.some((id) => id.toString() === patient._id.toString())) {
              isAllowed = true;
            }
          }
        }

        if (!isAllowed) {
          socket.emit("error", { message: "Access Denied: You can only chat if a confirmed/completed appointment exists." });
          return;
        }

        // Save Message to DB (Message model has content, sender, receiver)
        const newMessage = new Message({
          sender: userId,
          receiver: receiverId,
          content,
          projectId: "medimind", // Fallback for schema compatibility
        });

        await newMessage.save();

        const populatedMessage = await newMessage.populate(
          "sender",
          "name email avatarUrl role"
        );

        // Emit to receiver's private room
        io.to(receiverId).emit("receive_message", populatedMessage);

        // Acknowledge to sender
        socket.emit("message_sent", populatedMessage);
      } catch (error) {
        console.error("Error saving/sending message:", error);
        socket.emit("error", { message: "Could not send message: " + error.message });
      }
    });

    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${userId}`);

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);

          // Update last seen in database when the user is completely offline
          const lastSeen = new Date();
          await User.findByIdAndUpdate(userId, { lastSeen });

          // Notify others about the last seen update
          io.emit("user_last_seen", { userId, lastSeen });
        }
      }

      // Broadcast updated online users list
      io.emit("online_users", Array.from(onlineUsers.keys()));
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

/**
 * Send a live notification/message to a specific user
 * @param {string} userId - The MongoDB ID of the user
 * @param {string} event - The name of the event to emit
 * @param {any} data - The message payload
 */
export const emitToUser = (userId, event, data) => {
  console.log(data, userId, event);
  if (io) {
    io.to(userId).emit(event, data);
  } else {
    console.log("Socket.io not initialized!");
  }
};
