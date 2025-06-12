import express from 'express';
import Subscription from '../models/subscription.js';
import apartments from '../models/apartments.js';
import WashLog from '../models/washLogs.js'

const router = express.Router();

// Create a new wash log
router.post('/', async (req, res) => {
    try {
      const { type, subscriptionId, apartmentId } = req.body;
  
      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        return res.status(404).json({ error: 'Subscription not found' });
      }
  
      // Defaults
      let isAdditional = false;
      let additionalCharge = 0;
  
      const used = subscription.washesUsed[type];
      const quota = subscription.washQuota[type];
  
      if (used >= quota) {
        // Handle additional wash
        isAdditional = true;
  
        const apartment = await apartments.findById(apartmentId);
        if (!apartment) {
          return res.status(404).json({ error: 'Apartment not found' });
        }
  
        additionalCharge = apartment.additionalWashRates[type] || 0;
      } else {
        // Increment usage
        const updateField = `washesUsed.${type}`;
        await Subscription.findByIdAndUpdate(subscriptionId, {
          $inc: { [updateField]: 1 }
        });
  
        // Refetch updated subscription
        const updatedSub = await Subscription.findById(subscriptionId);
  
        const foamUsed = updatedSub.washesUsed.foam;
        const foamQuota = updatedSub.washQuota.foam;
        const normalUsed = updatedSub.washesUsed.normal;
        const normalQuota = updatedSub.washQuota.normal;
  
        if (
          foamUsed >= foamQuota &&
          normalUsed >= normalQuota &&
          updatedSub.status !== 'expired'
        ) {
          updatedSub.status = 'expired';
          await updatedSub.save();
        }
      }
  
      // Save wash log
      const washLog = new WashLog({
        ...req.body,
        isAdditional,
        additionalCharge
      });
  
      const saved = await washLog.save();
      res.status(201).json(saved);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });
  
  
// Get all wash logs
router.get('/', async (req, res) => {
  try {
    const logs = await WashLog.find()
      .populate('customerId')
      .populate('subscriptionId')
      .populate('apartmentId')
      .populate('vehicleId')
      .populate('performedBy');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get wash logs by apartment
router.get('/apartment/:apartmentId', async (req, res) => {
  try {
    const logs = await WashLog.find({ apartmentId: req.params.apartmentId })
      .populate('customerId')
      .populate('vehicleId');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get wash logs by customer
router.get('/customer/:customerId', async (req, res) => {
  try {
    const logs = await WashLog.find({ customerId: req.params.customerId })
      .populate('subscriptionId')
      .populate('vehicleId');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/washlogs
 * Query Params Supported:
 * - date: Exact match (YYYY-MM-DD)
 * - from, to: Date range (YYYY-MM-DD)
 * - customerId, apartmentId, vehicleId
 * GET /api/washlogs?date=2025-06-12
GET /api/washlogs?from=2025-06-01&to=2025-06-12
GET /api/washlogs?apartmentId=abc123&from=2025-06-01&to=2025-06-12
GET /api/washlogs?customerId=abc123
GET /api/washlogs?vehicleId=xyz456
 */
router.get('/', async (req, res) => {
    try {
      const { date, from, to, customerId, apartmentId, vehicleId } = req.query;
  
      const filter = {};
  
      if (date) {
        const targetDate = new Date(date);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        filter.date = { $gte: targetDate, $lt: nextDay };
      }
  
      if (from && to) {
        const start = new Date(from);
        const end = new Date(to);
        filter.date = { $gte: start, $lte: end };
      }
  
      if (customerId) filter.customerId = customerId;
      if (apartmentId) filter.apartmentId = apartmentId;
      if (vehicleId) filter.carId = vehicleId;
  
      const logs = await WashLog.find(filter)
        .populate('customerId')
        .populate('subscriptionId')
        .populate('apartmentId')
        .populate('vehicleId')
  
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // DELETE /washlogs/:id
router.delete('/:id', async (req, res) => {
    try {
      const deleted = await WashLog.findByIdAndDelete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'WashLog not found' });
      }
      res.json({ message: 'WashLog deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // PUT /washlogs/:id
router.put('/:id', async (req, res) => {
    try {
      const updated = await WashLog.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
  
      if (!updated) {
        return res.status(404).json({ error: 'WashLog not found' });
      }
  
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  

export default router;
