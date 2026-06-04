import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cookieParser from "cookie-parser";
import GlobalErrorHandler from "./utils/globalErrorHandler.js";
import registerRoutes from "./api/api.routes.js";
import database from "./config/database.js";
import cors from "cors";
import http from "http";
import { getIO, initSocket } from "./config/socket.js";
import { notificationService } from "./api/notification/notification.service.js";
import { NOTIFICATION_CHANNELS } from "./api/notification/notification.events.js";

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(
  cors({
    origin: `${process.env.FRONTEND_URL}`,
    credentials: true,
  }),
);

const PORT = process.env.PORT || 3001;

// Connect to MongoDB
await database.connect();

// Middleware
app.use(express.urlencoded());
app.use(express.json());
app.use(cookieParser());

// Initialize Socket.io
initSocket(server);

app.get("/add-job", async (req, res) => {
  const job = await importQueue.add("test-job", {
    message: "Hello BullMQ 👋",
  });

  res.json({
    jobId: job.id,
    status: "queued",
  });
});

// Register all routes
registerRoutes(app);

// Global Error Handler
GlobalErrorHandler.initialize(app);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
