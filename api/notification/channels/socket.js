import { emitToUser } from "../../../config/socket.js";

/**
 * Socket.io Channel for real-time notifications.
 * Emits a dynamic event based on notification type.
 */
class SocketChannel {
  /**
   * Send a notification to a specific user via socket.
   * @param {Object} data - Notification job data
   */
  async send(data) {
    const { userId, title, message, ...extraData } = data;

    if (!userId) {
      console.warn("Cannot send socket notification without userId");
      return;
    }

    emitToUser(userId.toString(), "notification", {
      title,
      message,
      isRead: false,
      timestamp: new Date(),
      ...extraData,
    });
  }
}

export const socketChannel = new SocketChannel();
