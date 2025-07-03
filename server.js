import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import apartment from './routes/apartment.js';
import customer from './routes/customer.js'
import planRoutes from './routes/plan.js';
import vehicleRoutes from "./routes/vehicle.js";
import subscriptionRoutes from "./routes/subscription.js"
import washLogRoutes from "./routes/washLogs.js"
import invoiceRoutes from "./routes/invoices.js"


dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Test routes
app.get("/", (req, res) => {
  res.send("API is running...");
});

// API route
app.use("/apartments", apartment);
app.use("/customers", customer);
app.use('/plans', planRoutes);
app.use("/vehicles", vehicleRoutes);
app.use("/subscription", subscriptionRoutes);
app.use("/washlog", washLogRoutes);
app.use("/invoice", invoiceRoutes);



// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("Mongo error", err));

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
