import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    projectId: {
      type: String,
      index: true,
    },

    title: {

      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      default: "general",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    channels: {

      type: [String],
      default: ["socket"],
    },
  },
  { timestamps: true },
);

const Notification = mongoose.model("Notification", NotificationSchema);

export default Notification;
