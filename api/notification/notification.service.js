import Notification from "./notification.model.js";
import { notificationQueue } from "./notification.queue.js";
import {
  NOTIFICATION_CHANNELS,
} from "./notification.events.js";
import User from "../user/user.model.js";
import { socketChannel } from "./channels/socket.js";


/**
 * Notification Service.
 * Central place to manage notification creation, persistence,
 * and delivery.
 */
class NotificationService {
  /**
   * Send a notification to a specific user.
   * @param {Object} options - Notification options
   * @param {string} options.userId - ID of the recipient user
   * @param {string} options.title - The title of the notification
   * @param {string} options.message - Short message of the notification
   * @param {string} [options.type='general'] - Type category (info, success, warning, error)
   * @param {string[]} [options.channels=['socket']] - Array of delivery channels
   * @param {Object} [options.extraData] - Any additional metadata for the notification
   */

  async notifyUser({
    userId,
    projectId,
    title,
    message,
    type = "general",
    channels = [NOTIFICATION_CHANNELS.SOCKET],
    ...extraData
  }) {
    if (!userId) {
      throw new Error("userId is required for notifyUser");
    }

    try {
      // 1. Persist the notification in the database
      const notification = await Notification.create({
        userId,
        projectId,
        title,
        message,
        type,
        channels,
        ...extraData,
      });

      // 2. Fetch user's email if needed for delivery
      let email = null;
      if (channels.includes(NOTIFICATION_CHANNELS.EMAIL)) {
        const user = await User.findById(userId).select("email");
        email = user?.email;
      }

      // 3. Immediate Socket Delivery (Main server process has the io instance)
      if (channels.includes(NOTIFICATION_CHANNELS.SOCKET)) {
        await socketChannel.send({
          userId,
          title,
          message,
          type,
          ...extraData,
        });
      }

      // 4. Enqueue other background tasks (like Email)
      const otherChannels = channels.filter(
        (c) => c !== NOTIFICATION_CHANNELS.SOCKET,
      );

      if (otherChannels.length > 0) {
        await notificationQueue.add("send-notification", {
          notificationId: notification._id,
          userId,
          projectId,
          email,
          title,
          message,
          type,
          channels: otherChannels,
          ...extraData,
        });
      }


      return notification;
    } catch (error) {
      console.error("[NotificationService] notifyUser failed:", error);
      throw error;
    }
  }



  /**
   * Get recent notifications for a user.
   */
  async getUserNotifications(userId, limit = 10, offset = 0, projectId = null) {
    const filter = { userId };
    if (projectId) {
      filter.projectId = projectId;
    }

    return await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);
  }


  /**
   * Mark a notification as read.
   */
  async markAsRead(notificationId) {
    return await Notification.findByIdAndUpdate(notificationId, {
      isRead: true,
    });
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(userId, projectId = null) {
    const filter = { userId, isRead: false };
    if (projectId) {
      filter.projectId = projectId;
    }
    return await Notification.updateMany(filter, { isRead: true });
  }
}

export const notificationService = new NotificationService();
