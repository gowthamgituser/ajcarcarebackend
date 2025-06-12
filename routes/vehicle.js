import express from "express";
import Vehicle from "../models/vehicle.js";

const router = express.Router();

// Create new vehicle
router.post("/", async (req, res) => {
  try {
    const vehicle = new Vehicle(req.body);
    const saved = await vehicle.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all vehicles
router.get("/", async (req, res) => {
  try {
    const vehicles = await Vehicle.find().populate("customerId");
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
    try {
      const updatedVehicle = await Vehicle.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      if (!updatedVehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      res.json(updatedVehicle);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

// Get vehicles by customer ID
router.get("/customer/:customerId", async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ customerId: req.params.customerId });
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/apartment/:apartmentId", async (req, res) => {
    try {
      const vehicles = await Vehicle.find()
        .populate({
          path: "customerId",
          match: { apartmentId: req.params.apartmentId }
        });
  
      // Filter out nulls (customers from other apartments)
      const filteredVehicles = vehicles.filter(v => v.customerId !== null);
  
      res.json(filteredVehicles);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

export default router;
