import { notificationService } from "./notification.service.js";

/**
 * Controller to handle API requests for notifications.
 */
class NotificationController {
  /**
   * Fetch current user's notifications.
   */
  async getMyNotifications(req, res) {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const userId = req.user.id; // User ID from JWT middleware
      const projectId = req.projectId; // Populated by projectContext middleware

      const notifications = await notificationService.getUserNotifications(
        userId,
        parseInt(limit),
        parseInt(offset),
        projectId
      );


      res.status(200).json({ success: true, count: notifications.length, data: notifications });
    } catch (error) {
      console.error("[NotificationController] getMyNotifications error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  /**
   * Mark a specific notification as read.
   */
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const notification = await notificationService.markAsRead(id);
      
      if (!notification) {
        return res.status(404).json({ success: false, message: "Notification not found" });
      }

      res.status(200).json({ success: true, message: "Notification marked as read" });
    } catch (error) {
      console.error("[NotificationController] markAsRead error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  /**
   * Mark all notifications as read for current user.
   */
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;
      const projectId = req.projectId;

      await notificationService.markAllAsRead(userId, projectId);
      res.status(200).json({ success: true, message: "All notifications marked as read" });
    } catch (error) {

      console.error("[NotificationController] markAllAsRead error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
}

export const notificationController = new NotificationController();
