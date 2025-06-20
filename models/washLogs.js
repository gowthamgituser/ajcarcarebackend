import mongoose from "mongoose";

const WashLogSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
  apartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Apartment', required: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  type: { type: String, enum: ['foam', 'normal'], required: true },
  date: { type: Date, default: Date.now },
  isAdditional: { type: Boolean, default: false },
  additionalCharge: { type: Number, default: 0 },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // optional
}, { timestamps: true });

export default mongoose.model("WashLog", WashLogSchema);
