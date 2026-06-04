import { Queue } from "bullmq";
import { connection } from "../config/redis.js";

export const pdfQueue = new Queue("pdf-generation", { 
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 5000
        },
        removeOnComplete: { age: 3600 }, // Keep for 1 hour
        removeOnFail: false
    }
});
