import express from 'express';
import Subscription from '../models/subscription.js';
import Apartment from '../models/apartments.js';
import WashLog from '../models/washLogs.js'
import Vehicle from '../models/vehicle.js';
import Plan from '../models/plan.js'
import mongoose from 'mongoose';
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
    if (subscriptionId) {
      plan = await Plan.findById(subscription.planId);
      if (!plan) return res.status(404).json({ error: 'Plan not found' });
    }

    // Optional vehicle check
    // if (vehicleId) {
    //   const vehicle = await Vehicle.findById(vehicleId);
    //   if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    // }

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
    const { apartmentId } = req.params;
    const { startDate, endDate } = req.query;

    const filter = { apartmentId };

    // Apply date range filter if both dates are provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Ensure endDate includes the full day (23:59:59.999)
      end.setHours(23, 59, 59, 999);

      filter.createdAt = {
        $gte: start,
        $lte: end,
      };
    }

    const logs = await WashLog.find(filter)
      .populate('customerId')
      .sort({ createdAt: -1 })
      .lean();

    // Manually populate vehicleId
    const populatedLogs = await Promise.all(
      logs.map(async (log) => {
        if (mongoose.Types.ObjectId.isValid(log.vehicleId)) {
          try {
            const vehicle = await Vehicle.findById(log.vehicleId).lean();
            if (vehicle) {
              log.vehicleId = vehicle;
            }
          } catch (_) {
            // silent fail
          }
        }
        return log;
      })
    );

    res.json(populatedLogs);
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

router.delete('/:id', async (req, res) => {
  try {
    const washLogId = req.params.id;

    // Step 1: Find the wash log
    const log = await WashLog.findById(washLogId);
    if (!log) return res.status(404).json({ error: 'Wash log not found' });

    // Step 2: If it's not additional and has a valid subscription, revert quota
    if (!log.isAdditional && log.subscriptionId && log.type) {
      const subscription = await Subscription.findById(log.subscriptionId);
      if (subscription) {
        const currentUsage = subscription.washesUsed[log.type] || 0;
        const revertField = `washesUsed.${log.type}`;

        // Revert only if usage is greater than 0
        if (currentUsage > 0) {
          await Subscription.findByIdAndUpdate(log.subscriptionId, {
            $inc: { [revertField]: -1 }
          });
        }

        // After decrement, re-fetch updated subscription
        const updatedSub = await Subscription.findById(log.subscriptionId);

        // Check if all usage fields are within limits to reactivate the subscription
        let isActive = true;
        for (const type in updatedSub.quota) {
          const used = updatedSub.washesUsed[type] || 0;
          const allowed = updatedSub.quota[type] || 0;
          if (used >= allowed) {
            isActive = false;
            break;
          }
        }

        // If status was expired and usage is now within limits, set status to 'active'
        if (updatedSub.status === 'expired' && isActive) {
          updatedSub.status = 'active';
          await updatedSub.save();
        }
      }
    }

    // Step 3: Delete the log
    await WashLog.findByIdAndDelete(washLogId);

    res.status(200).json({
      message: 'Wash log deleted successfully. Quota reverted and subscription status updated if applicable.',
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



// PUT /washlogs/:id
router.put('/:id', async (req, res) => {
  try {
    const washLogId = req.params.id;
    const {
      type,
      subscriptionId,
      apartmentId,
      customerId,
      vehicleId,
      description,
      isAdditional: newIsAdditional = false,
      additionalCharge = 0,
      reduceQuota = true,
    } = req.body;

    const existingLog = await WashLog.findById(washLogId);
    if (!existingLog) return res.status(404).json({ error: 'Wash log not found' });

    const subscription = subscriptionId ? await Subscription.findById(subscriptionId) : null;
    if (subscriptionId && !subscription) return res.status(404).json({ error: 'Subscription not found' });

    const plan = subscription ? await Plan.findById(subscription.planId) : null;
    if (subscription && !plan) return res.status(404).json({ error: 'Plan not found' });

    // Step 1: Revert quota if old entry was NOT additional
    if (existingLog.subscriptionId && !existingLog.isAdditional) {
      const revertField = `washesUsed.${existingLog.type}`;
      const currentUsage = subscription.washesUsed[existingLog.type] || 0;

      if (currentUsage > 0) {
        await Subscription.findByIdAndUpdate(subscription._id, {
          $inc: { [revertField]: -1 }
        });
      }
    }

    let finalIsAdditional = false;
    let finalAdditionalCharge = 0;

    // Step 2: Recompute based on new data
    if (newIsAdditional) {
      finalIsAdditional = true;
      finalAdditionalCharge = additionalCharge || 0;
    } else if (reduceQuota && subscription && plan) {
      const used = subscription.washesUsed[type] || 0;
      const quota = plan.washQuota[type] || 0;

      if (used >= quota) {
        finalIsAdditional = true;
        finalAdditionalCharge = additionalCharge || 0;
      } else {
        const updateField = `washesUsed.${type}`;
        await Subscription.findByIdAndUpdate(subscription._id, {
          $inc: { [updateField]: 1 }
        });

        // Optionally expire subscription if all quotas are used
        const updated = await Subscription.findById(subscription._id);
        const foamUsed = updated.washesUsed.foam || 0;
        const foamQuota = plan.washQuota.foam || 0;
        const normalUsed = updated.washesUsed.normal || 0;
        const normalQuota = plan.washQuota.normal || 0;

        if (foamUsed >= foamQuota && normalUsed >= normalQuota && updated.status !== 'expired') {
          updated.status = 'expired';
          await updated.save();
        }
      }
    } else {
      finalIsAdditional = true;
      finalAdditionalCharge = additionalCharge || 0;
    }

    // Step 3: Update the wash log
    const updatedLog = await WashLog.findByIdAndUpdate(
      washLogId,
      {
        type,
        subscriptionId,
        apartmentId,
        customerId,
        vehicleId: vehicleId || null,
        description,
        isAdditional: finalIsAdditional,
        additionalCharge: finalAdditionalCharge
      },
      { new: true }
    );

    res.status(200).json(updatedLog);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;