import express from 'express';
import Customer from '../models/customer.js';
import WashLogs from '../models/washLogs.js';
import Subscription from '../models/subscription.js'
import PaymentStatus from '../models/payment.js'
const router = express.Router();
// GET /invoice/apartment/:id?month=7&year=2025// GET /invoice/apartment/:id?month=7&year=2025

router.get('/apartment/:id', async (req, res) => {
    try {
      const apartmentId = req.params.id;
      const now = new Date();
      const month = parseInt(req.query.month) || now.getMonth() + 1;
      const year = parseInt(req.query.year) || now.getFullYear();
  
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  
      const customers = await Customer.find({ apartmentId }).lean();
      const customerIds = customers.map(c => c._id);
  
      const logs = await WashLogs.find({
        customerId: { $in: customerIds },
        date: { $gte: startDate, $lte: endDate },
      }).lean();
  
      const subscriptions = await Subscription.find({
        customerId: { $in: customerIds },
      }).populate('planId', 'name price').lean();
  
      const paymentStatuses = await PaymentStatus.find({
        customerId: { $in: customerIds },
        apartmentId,
        month,
        year,
      }).lean();
  
      // Map payment status by customerId -> full object
      const statusMap = new Map();
      paymentStatuses.forEach((p) => {
        statusMap.set(p.customerId.toString(), p);
      });
  
      // Map subscriptions by customerId
      const subscriptionMap = new Map();
      for (const sub of subscriptions) {
        const custId = sub.customerId.toString();
        if (!subscriptionMap.has(custId)) subscriptionMap.set(custId, []);
        subscriptionMap.get(custId).push({
          _id: sub._id,
          planId: sub.planId?._id,
          planName: sub.planId?.name,
          planPrice: sub.planId?.price,
          createdAt: sub.createdAt,
        });
      }
  
      // Map logs by customerId
      const logsMap = new Map();
      for (const log of logs) {
        const custId = log.customerId.toString();
        if (!logsMap.has(custId)) logsMap.set(custId, []);
        logsMap.get(custId).push(log);
      }
  
      const invoices = [];
  
      for (const customer of customers) {
        const custId = customer._id.toString();
        const customerLogs = logsMap.get(custId) || [];
        const subs = subscriptionMap.get(custId) || [];
  
        const additionalLogs = customerLogs.filter(log => log?.isAdditional);
        const planTotal = subs.reduce((sum, s) => sum + (s.planPrice || 0), 0);
        const additionalTotal = additionalLogs.reduce((sum, l) => sum + (l.additionalCharge || 0), 0);
        const amount = planTotal + additionalTotal;
  
        const invoiceId = `INV-${year}${String(month).padStart(2, '0')}-${customer.phone}`;
        
        const statusEntry = statusMap.get(custId);
        const status = statusEntry?.status || 'unpaid';
        const paymentDate = statusEntry?.paymentDate || null;
        const paymentUpdatedAt = statusEntry?.updatedAt || null;
  
        invoices.push({
          invoiceId,
          customerId: customer._id,
          apartmentId,
          name: customer.name,
          phone: customer.phone,
          month,
          year,
          subscriptions: subs,
          logs: customerLogs,
          planTotal,
          additionalTotal,
          amount,
          paymentStatus: status,
          paymentDate,
          paymentUpdatedAt
        });
      }
  
      res.json({ apartmentId, month, year, invoices });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });
  

// PUT /payment-status/:customerId
router.put('/payment-status/:customerId', async (req, res) => {
    const { customerId } = req.params;
    const { month, year, status, apartmentId, notes } = req.body;
  
    if (!['paid', 'unpaid'].includes(status)) {
      return res.status(400).json({ error: 'Invalid payment status' });
    }
  
    if (!month || !year) {
      return res.status(400).json({ error: 'Month and year are required' });
    }
  
    try {
      // Build update object conditionally
      const update = {
        status,
        notes,
      };
  
      if (status === 'paid') {
        update.paymentDate = new Date();
      }
  
      const updated = await PaymentStatus.findOneAndUpdate(
        { customerId, month, year, apartmentId },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
  
      res.json({ message: 'Payment status updated', data: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });
  

  // GET /payment-status/:customerId
router.get('/payment-status/:customerId', async (req, res) => {
    const { customerId } = req.params;
    const { month, year, apartmentId } = req.query;
  
    const filter = { customerId };
  
    if (apartmentId) filter.apartmentId = apartmentId;
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
  
    try {
      const status = await PaymentStatus.find(filter).lean();
      res.json({ data: status });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });
  
  

export default router;
