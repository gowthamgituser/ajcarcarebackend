import mongoose from "mongoose";

const ApartmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    additionalWashRates: {
      car: {
        foam: {
          type: Number,
          default: 0,
        },
        normal: {
          type: Number,
          default: 0,
        },
      },
      bike: {
        foam: {
          type: Number,
          default: 0,
        },
        normal: {
          type: Number,
          default: 0,
        },
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Apartment", ApartmentSchema);
