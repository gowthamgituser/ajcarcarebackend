import express from 'express';
import Subscription from '../models/subscription.js';
import Apartment from '../models/apartments.js';
import WashLog from '../models/washLogs.js'
import Vehicle from '../models/vehicle.js';
import Plan from '../models/plan.js'
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const {
      type,
      subscriptionId,
      apartmentId,
      customerId,
      description,
      vehicleId,
      reduceQuota = true,
      isAdditional: forceAdditional = false,
      additionalCharge = 0
    } = req.body;

    // Fetch subscription
    let subscription;
    let plan;
    if (subscriptionId) {
      subscription = await Subscription.findById(subscriptionId);
      if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
    }

    // Fetch apartment
    const apartment = await Apartment.findById(apartmentId);
    if (!apartment) return res.status(404).json({ error: 'Apartment not found' });

    // Fetch plan via subscription.planId
    if(subscriptionId) {
      plan = await Plan.findById(subscription.planId);
      if (!plan) return res.status(404).json({ error: 'Plan not found' });
    }

    // Optional vehicle check
    if (vehicleId) {
      const vehicle = await Vehicle.findById(vehicleId);
      if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    }

    let isAdditional = false;
    let finalAdditionalCharge = 0;

    if (forceAdditional) {
      // Always mark as additional
      isAdditional = true;
      finalAdditionalCharge = additionalCharge || 0;

    } else if (reduceQuota) {
      const used = subscription.washesUsed[type] || 0;
      const quota = plan.washQuota[type] || 0;

      if (used >= quota) {
        isAdditional = true;
        finalAdditionalCharge = additionalCharge || 0;
      } else {
        // Deduct from subscription usage
        const updateField = `washesUsed.${type}`;
        await Subscription.findByIdAndUpdate(subscriptionId, {
          $inc: { [updateField]: 1 }
        });

        // Check for expiry after usage
        const updatedSub = await Subscription.findById(subscriptionId);
        const foamUsed = updatedSub.washesUsed.foam || 0;
        const foamQuota = plan.washQuota.foam || 0;
        const normalUsed = updatedSub.washesUsed.normal || 0;
        const normalQuota = plan.washQuota.normal || 0;

        if (
          foamUsed >= foamQuota &&
          normalUsed >= normalQuota &&
          updatedSub.status !== 'expired'
        ) {
          updatedSub.status = 'expired';
          await updatedSub.save();
        }
      }

    } else {
      // Do not reduce quota, treat as additional
      isAdditional = true;
      finalAdditionalCharge = additionalCharge || 0;
    }

    // Create the wash log
    const washLog = new WashLog({
      customerId,
      subscriptionId,
      apartmentId,
      vehicleId: vehicleId || null,
      type,
      isAdditional,
      description,
      additionalCharge: finalAdditionalCharge,
      performedBy: req.user?._id // optional if you have auth
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
      const logId = req.params.id;
      const {
        type,
        subscriptionId,
        apartmentId,
        customerId,
        description,
        vehicleId,
        reduceQuota = true,
        isAdditional: forceAdditional = false,
        additionalCharge = 0
      } = req.body;
  
      const oldLog = await WashLog.findById(logId);
      if (!oldLog) return res.status(404).json({ error: 'Wash log not found' });
  
      let originalSubscription, originalPlan;
      if (oldLog.subscriptionId) {
        originalSubscription = await Subscription.findById(oldLog.subscriptionId);
        if (originalSubscription) {
          originalPlan = await Plan.findById(originalSubscription.planId);
        }
      }
  
      // Revert quota from original log
      if (
        originalSubscription &&
        oldLog.subscriptionId &&
        !oldLog.isAdditional &&
        originalPlan
      ) {
        const revertField = `washesUsed.${oldLog.type}`;
        await Subscription.findByIdAndUpdate(oldLog.subscriptionId, {
          $inc: { [revertField]: -1 }
        });
      }
  
      // Now process new update
      let subscription, plan;
      if (subscriptionId) {
        subscription = await Subscription.findById(subscriptionId);
        if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
  
        plan = await Plan.findById(subscription.planId);
        if (!plan) return res.status(404).json({ error: 'Plan not found' });
      }
  
      const apartment = await Apartment.findById(apartmentId);
      if (!apartment) return res.status(404).json({ error: 'Apartment not found' });
  
      if (vehicleId) {
        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
      }
  
      let isAdditional = false;
      let finalAdditionalCharge = 0;
  
      if (forceAdditional) {
        isAdditional = true;
        finalAdditionalCharge = additionalCharge || 0;
  
      } else if (reduceQuota && subscription && plan) {
        const used = subscription.washesUsed[type] || 0;
        const quota = plan.washQuota[type] || 0;
  
        if (used >= quota) {
          isAdditional = true;
          finalAdditionalCharge = additionalCharge || 0;
        } else {
          // Deduct usage
          const updateField = `washesUsed.${type}`;
          await Subscription.findByIdAndUpdate(subscriptionId, {
            $inc: { [updateField]: 1 }
          });
  
          // Re-check subscription expiry logic
          const updatedSub = await Subscription.findById(subscriptionId);
          const foamUsed = updatedSub.washesUsed.foam || 0;
          const foamQuota = plan.washQuota.foam || 0;
          const normalUsed = updatedSub.washesUsed.normal || 0;
          const normalQuota = plan.washQuota.normal || 0;
  
          if (
            foamUsed >= foamQuota &&
            normalUsed >= normalQuota &&
            updatedSub.status !== 'expired'
          ) {
            updatedSub.status = 'expired';
            await updatedSub.save();
          } else if (
            (foamUsed < foamQuota || normalUsed < normalQuota) &&
            updatedSub.status === 'expired'
          ) {
            // OPTIONAL: Reactivate expired subscription if we reverted usage
            updatedSub.status = 'active';
            await updatedSub.save();
          }
        }
  
      } else {
        isAdditional = true;
        finalAdditionalCharge = additionalCharge || 0;
      }
  
      // Update wash log
      const updated = await WashLog.findByIdAndUpdate(
        logId,
        {
          customerId,
          subscriptionId,
          apartmentId,
          vehicleId: vehicleId || null,
          type,
          isAdditional,
          description,
          additionalCharge: finalAdditionalCharge,
          performedBy: req.user?._id ?? oldLog.performedBy,
        },
        { new: true }
      );
  
      res.status(200).json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });
  
  

export default router;
