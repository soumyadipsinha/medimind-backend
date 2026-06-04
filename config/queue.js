import { Queue } from "bullmq";
import { connection } from "./redis.js";

export const bulkImportQueue = new Queue("bulk-import", {
  connection,
});

export const bulkCommitQueue = new Queue("bulk-commit", {
  connection,
});
