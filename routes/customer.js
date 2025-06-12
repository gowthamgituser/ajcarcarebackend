import express from 'express';
import Customer from '../models/customer.js';

const router = express.Router();

// GET customers by apartmentId
router.get('/apartment/:apartmentId', async (req, res) => {
  try {
    const customers = await Customer.find({ apartmentId: req.params.apartmentId });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET all customers
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find().populate('apartmentId');
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new customer
router.post('/', async (req, res) => {
  try {
    const customer = new Customer(req.body);
    const saved = await customer.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update a customer
router.put('/:id', async (req, res) => {
  try {
    const updated = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Customer not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a customer
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Customer.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Customer not found' });
    res.json({ message: 'Customer deleted', deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
