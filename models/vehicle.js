import mongoose from "mongoose";

const VehicleSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  vehicleNumber: {
    type: String,
    required: true,
  },
  brand: String,
  model: String,
  color: String,
  block: String,
  parkingNumber: String,
  apartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Apartment' }
}, { timestamps: true });

export default mongoose.model("Vehicle", VehicleSchema);
