import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true }],
    price: { type: Number, required: true },
    description: { type: String, required: true },
    reportDeliveryTime: { type: String, required: true }, // e.g. "24 Hours"
  },
  {
    timestamps: true,
  }
);

const Service = mongoose.model("Service", ServiceSchema);
export default Service;
