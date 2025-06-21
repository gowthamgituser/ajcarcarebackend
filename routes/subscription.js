import express from 'express';
import Subscription from '../models/subscription.js';
import Plan from '../models/plan.js';

const router = express.Router();

// Create a new subscription
router.post('/', async (req, res) => {
  try {
    const { customerId, planId, apartmentId, vehicleIds, startDate, endDate } = req.body;

    // Get washQuota from the selected plan
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const subscription = new Subscription({
      customerId,
      planId,
      apartmentId,
      vehicleIds,
      startDate,
      endDate,
      washQuota: {
        foam: plan.washQuota.foam,
        normal: plan.washQuota.normal
      }
    });

    const saved = await subscription.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


router.get('/', async (req, res) => {
    try {
      const subs = await Subscription.find()
        .populate('customerId')
        .populate('planId')
        .populate('apartmentId')
        .populate('vehicleIds');
      res.json(subs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Get subscription by customer ID
  router.get('/customer/:id', async (req, res) => {
    try {
      const sub = await Subscription.find({ customerId: req.params.id })
        .populate('planId')
        .populate('vehicleIds');
      if (!sub) return res.status(200).json({ error: 'Subscription not found' });
      res.json(sub);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET subscriptions by apartmentId
router.get('/apartment/:apartmentId', async (req, res) => {
    try {
      const { apartmentId } = req.params;
  
      const subs = await Subscription.find({ apartmentId })
        .populate('customerId')
        .populate('planId')
        .populate('apartmentId')
        .populate('vehicleIds');
  
      res.json(subs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  
  // Update subscription
  router.put('/:id', async (req, res) => {
    try {
      const updated = await Subscription.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  
  // Delete subscription
  router.delete('/:id', async (req, res) => {
    try {
      await Subscription.findByIdAndDelete(req.params.id);
      res.json({ message: 'Subscription deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  

  export default router;