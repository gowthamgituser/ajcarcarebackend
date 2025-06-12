import express from "express";
import Plan from "../models/plan.js";

const router = express.Router();

// Create a new plan
router.post("/", async (req, res) => {
  try {
    const plan = new Plan(req.body);
    const saved = await plan.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all plans
router.get("/", async (req, res) => {
  try {
    const plans = await Plan.find();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get plans by apartmentId
router.get("/apartment/:apartmentId", async (req, res) => {
  try {
    const plans = await Plan.find({ apartmentId: req.params.apartmentId });
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a plan
router.put("/:id", async (req, res) => {
  try {
    const updated = await Plan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a plan
router.delete("/:id", async (req, res) => {
  try {
    await Plan.findByIdAndDelete(req.params.id);
    res.json({ message: "Plan deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
