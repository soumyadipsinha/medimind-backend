import { Worker } from "bullmq";
import dotenv from "dotenv";
import database from "../../config/database.js";
import { connection } from "../../config/redis.js";
import { emailChannel } from "./channels/email.js";
import { socketChannel } from "./channels/socket.js";
import { NOTIFICATION_CHANNELS } from "./notification.events.js";

dotenv.config();
await database.connect();
console.log("[NotificationWorker] Worker started and DB connected");

/**
 * Notification Worker.
 * Listens for jobs on the notification-queue and dispatches based on the
 * requested channels.
 */
const notificationWorker = new Worker(
  "notification-queue",
  async (job) => {
    const { channels, ...notificationData } = job.data;

    if (!channels || !Array.isArray(channels)) {
      console.warn(`[NotificationWorker] Job ${job.id} has no channels`);
      return;
    }

    const tasks = [];

    // Dispatch to each requested channel
    for (const channel of channels) {
      if (channel === NOTIFICATION_CHANNELS.EMAIL) {
        tasks.push(emailChannel.send(notificationData));
      } else {
        console.warn(`[NotificationWorker] Unsupported background channel requested: ${channel}`);
      }
    }


    // Wait for all channel delivery tasks to complete
    await Promise.allSettled(tasks);
  },
  {
    connection,
    concurrency: 5, // Process 5 notifications concurrently
  },
);

notificationWorker.on("completed", (job) => {
  console.log(`[NotificationWorker] Job ${job.id} completed successfully`);
});

notificationWorker.on("failed", (job, err) => {
  console.error(`[NotificationWorker] Job ${job.id} failed with error:`, err);
});

export default notificationWorker;
