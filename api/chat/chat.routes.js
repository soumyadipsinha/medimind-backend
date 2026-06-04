import express from "express";
import {
  getChatUsers,
  getMessages,
  markMessagesAsSeen,
  aiChatbot,
} from "./chat.controller.js";

const chatRouter = express.Router();

chatRouter.get("/users", getChatUsers);
chatRouter.post("/seen", markMessagesAsSeen);
chatRouter.post("/ai", aiChatbot);
chatRouter.get("/:partnerId", getMessages);

export default chatRouter;
