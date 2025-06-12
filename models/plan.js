import mongoose from "mongoose";

const PlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  apartmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Apartment",
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  washQuota: {
    foam: {
      type: Number,
      default: 0,
    },
    normal: {
      type: Number,
      default: 0,
    },
  },
  description: {
    type: String,
  },
}, { timestamps: true });

export default mongoose.model("Plan", PlanSchema);
