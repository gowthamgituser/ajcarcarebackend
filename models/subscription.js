import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
  apartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Apartment' },
  vehicleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' }], // ✅ updated
  startDate: Date,
  endDate: Date,
  washQuota: {
    foam: Number,
    normal: Number
  },
  washesUsed: {
    foam: { type: Number, default: 0 },
    normal: { type: Number, default: 0 }
  },
  status: { type: String, enum: ['active', 'expired'], default: 'active' }
}, { timestamps: true });

export default mongoose.model("Subscription", SubscriptionSchema);
