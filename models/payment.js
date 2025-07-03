// models/PaymentStatus.js
import mongoose from "mongoose";

const paymentStatusSchema = new mongoose.Schema({
  apartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Apartment', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  month: { type: Number, required: true }, // 1-12
  year: { type: Number, required: true },
  notes: { type: String, default: '' }, 
  status: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid' },
  paymentDate: { type: Date, default: null },
}, { timestamps: true });

paymentStatusSchema.index({ customerId: 1, month: 1, year: 1 }, { unique: true });
export default mongoose.model('PaymentStatus', paymentStatusSchema);