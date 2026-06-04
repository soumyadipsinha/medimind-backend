import Comments from "./comments.model.js";
import User from "../user/user.model.js";
import { parseMentions } from "../../utils/parseMentions.js";
import { getIO } from "../../config/socket.js";
import Message from "../chat/chat.model.js";
import { notificationService } from "../notification/notification.service.js";

export async function createCommentInternal({ comment, userId, projectId }) {
  const parsedMentions = parseMentions(comment);

  const userMentions = parsedMentions.filter((m) => m.type === "user");
  const taskMentions = parsedMentions.filter((m) => m.type === "task");
  const channelMentions = parsedMentions.filter((m) => m.type === "channel");

  const mentionData = await Promise.all(
    userMentions.map(async (m) => {
      const user = await User.findById(m.id).select("email name");
      return {
        email: user?.email || `user-${m.id}@system.com`,
        name: user?.name || m.name,
        id: m.id,
      };
    }),
  );

  const newComment = new Comments({
    comment,
    mentions: mentionData,
    project: projectId,
    tags: taskMentions.map((t) => t.name),
    mentionedChannels: channelMentions.map((c) => c.name),
    author: userId,
    isTask: taskMentions.length > 0,
  });

  const savedComment = await newComment.save();

  // Notify mentioned users and channels
  notifyMentions({ comment, userId, parsedMentions, projectId }).catch((err) =>
    console.error("Error notifying mentions:", err),
  );

  return savedComment;
}

async function notifyMentions({ comment, userId, parsedMentions, projectId }) {
  try {
    const io = getIO();
    // Reformat comment to message-friendly way (Arnab Chatterjee instead of @[Arnab Chatterjee](id))
    const cleanContent = comment.replace(/([@!#])\[(.*?)\]\((.*?)\)/g, "*$2*");

    const sender = await User.findById(userId).select("name");

    for (const mention of parsedMentions) {
      if (mention.type === "user") {
        // Notification logic
        await notificationService.notifyUser({
          userId: mention.id,
          projectId,
          title: "New Mention",
          message: `${sender?.name || "Someone"} mentioned you in a comment: "${cleanContent}"`,
          type: "mention",
        });

        const newMessage = new Message({
          sender: userId,
          receiver: mention.id,
          content: cleanContent,
          projectId,
        });
        await newMessage.save();
        const populatedMessage = await newMessage.populate(
          "sender",
          "name email avatarUrl",
        );
        io.to(mention.id).emit("receive_message", populatedMessage);
      } else if (mention.type === "channel") {
        const newMessage = new Message({
          sender: userId,
          channel: mention.id,
          content: cleanContent,
          projectId,
        });
        await newMessage.save();
        const populatedMessage = await newMessage.populate(
          "sender",
          "name email avatarUrl",
        );
        io.emit(`channel_${mention.id}_message`, populatedMessage);
      }
    }
  } catch (error) {
    console.error("Failed to notify mentions via socket:", error);
  }
}

export async function createComment(req, res) {
  try {
    const { comment, projectId } = req.body;
    const userId = req.user.id;

    if (!comment) {
      return res.status(400).json({ message: "Comment content is required" });
    }

    const newComment = await createCommentInternal({
      comment,
      userId,
      projectId: projectId || req.projectId,
    });

    res.status(201).json(newComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function getAllCommentss(req, res) {
  const commentss = await Comments.find({});
  res.json(commentss);
}
