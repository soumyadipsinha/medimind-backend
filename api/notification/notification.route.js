import express from "express";
import { notificationController } from "./notification.controller.js";
import { projectContext } from "../../middlewares/authourization.middleware.js";

const notificationRouter = express.Router();

/**
 * Get current user's notifications.
 * GET /api/notification
 */
notificationRouter.get("/", projectContext, (req, res) =>
  notificationController.getMyNotifications(req, res),
);

/**
 * Mark all notifications as read for current user.
 * PATCH /api/notification/read-all
 */
notificationRouter.patch("/read-all", projectContext, (req, res) =>
  notificationController.markAllAsRead(req, res),
);

/**
 * Mark a notification as read.
 * PATCH /api/notification/:id/read
 */
notificationRouter.patch("/:id/read", (req, res) =>
  notificationController.markAsRead(req, res),
);

export default notificationRouter;
