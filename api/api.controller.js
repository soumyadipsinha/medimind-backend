import { bulkImportQueue } from "../config/queue.js";
import checkRequiredFields from "../utils/checkRequiredFields.js";

export function healthCheck(req, res) {
  res.send("😁👍");
}
export function notFound(req, res) {
  res.status(404).send("Looks like you've taken a wrong turn!");
}
