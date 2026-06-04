import express from "express";
import {
  getChatUsers,
  getMessages,
  markMessagesAsSeen,
} from "./chat.controller.js";

const chatRouter = express.Router();

chatRouter.get("/users", getChatUsers);
chatRouter.post("/seen", markMessagesAsSeen);
chatRouter.get("/:partnerId", getMessages);

export default chatRouter;
