import mongoose from "mongoose";

const ChannelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isPublic: { type: Boolean, default: true },
    projectId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

const Channel = mongoose.model("Channel", ChannelSchema);
export default Channel;
