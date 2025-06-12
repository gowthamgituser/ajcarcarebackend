import mongoose from "mongoose";


const CustomerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    blockNumber: {
        type: String,
        required: true
    },
    flatNumber: {
        type: String,
        required: true
    },
    apartmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Apartment',
        required: true
      },
      planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
      },
}, { timestamps: true });

export default mongoose.model("Customer", CustomerSchema);