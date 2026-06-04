import { Queue } from "bullmq";
import { connection } from "../../config/redis.js";

/**
 * Main notification queue.
 * Handles background processing for all types of notifications
 * across various channels like email and socket.
 */
export const notificationQueue = new Queue("notification-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
