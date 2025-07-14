import express from 'express';
import Customer from '../models/customer.js';
import WashLogs from '../models/washLogs.js';
import Subscription from '../models/subscription.js'
import PaymentStatus from '../models/payment.js'
import path from 'path';
import ejs from 'ejs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pdf from 'html-pdf-node';
import twilio from 'twilio';
const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
// GET /invoice/apartment/:id?month=7&year=2025// GET /invoice/apartment/:id?month=7&year=2025

router.post('/send-invoice/:customerId', async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();

    const customer = await Customer.findById(customerId).lean();
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    if (!customer.phone.startsWith('+')) {
      return res.status(400).json({ error: 'Phone number must be in E.164 format (e.g. +91XXXXXXXXXX)' });
    }

    const invoiceUrl = `${req.protocol}://${req.get('host')}/invoice/pdf/${customerId}?month=${month}&year=${year}`;

    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${customer.phone}`,
      body: `Hello ${customer.name}, your invoice for ${month}/${year} is ready. Tap below to view the invoice.`,
      mediaUrl: [invoiceUrl]
    });

    res.json({ success: true, sid: message.sid });
  } catch (err) {
    console.error('WhatsApp send error:', err);
    res.status(500).json({ error: 'Failed to send invoice via WhatsApp' });
  }
});
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
  
        const namePart = customer.name?.slice(0,3).toUpperCase() || 'XXX';
        const phonePart = customer.phone?.slice(0, 3) || '000';
        const invoiceId = `INV-${year}-${namePart}${phonePart}`;
        
        
        const statusEntry = statusMap.get(custId);
        const status = statusEntry?.status || 'unpaid';
        const paymentDate = statusEntry?.paymentDate || null;
        const paymentUpdatedAt = statusEntry?.updatedAt || null;
        const statusNotes = statusEntry?.notes || 'unpaid';
        const balance = statusEntry?.balance || null;
        const amountDue = statusEntry?.amountDue || null;
        const amountPaid = statusEntry?.amountPaid || null;
  
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
          paymentUpdatedAt,
          statusNotes,
          balance,
          amountDue,
          amountPaid
        });
      }
  
      res.json({ apartmentId, month, year, invoices });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/customer/:customerId', async (req, res) => {
    try {
      const customerId = req.params.customerId;
      const now = new Date();
      const month = parseInt(req.query.month) || now.getMonth() + 1;
      const year = parseInt(req.query.year) || now.getFullYear();
  
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  
      const customer = await Customer.findById(customerId).lean();
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
  
      const apartmentId = customer.apartmentId;
  
      const logs = await WashLogs.find({
        customerId,
        date: { $gte: startDate, $lte: endDate },
      }).lean();
  
      const subscriptions = await Subscription.find({
        customerId,
      }).populate('planId', 'name price').lean();
  
      const paymentStatus = await PaymentStatus.findOne({
        customerId,
        apartmentId,
        month,
        year,
      }).lean();
  
      const additionalLogs = logs.filter(log => log?.isAdditional);
      const planTotal = subscriptions.reduce((sum, s) => sum + (s.planId?.price || 0), 0);
      const additionalTotal = additionalLogs.reduce((sum, l) => sum + (l.additionalCharge || 0), 0);
      const amount = planTotal + additionalTotal;
  
      const namePart = customer.name?.slice(0,3).toUpperCase() || 'XXX';
      const phonePart = customer.phone?.slice(0, 3) || '000';
      const invoiceId = `INV-${year}-${namePart}${phonePart}`;
      const status = paymentStatus?.status || 'unpaid';
      const paymentDate = paymentStatus?.paymentDate || null;
      const paymentUpdatedAt = paymentStatus?.updatedAt || null;
  
      const response = {
        invoiceId,
        customerId,
        apartmentId,
        name: customer.name,
        phone: customer.phone,
        month,
        year,
        subscriptions: subscriptions.map(s => ({
          _id: s._id,
          planId: s.planId?._id,
          planName: s.planId?.name,
          planPrice: s.planId?.price,
          createdAt: s.createdAt
        })),
        logs,
        planTotal,
        additionalTotal,
        amount,
        paymentStatus: status,
        paymentDate,
        paymentUpdatedAt
      };
  
      res.json(response);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });
  router.get('/pdf/:customerId', async (req, res) => {
    try {
      const customerId = req.params.customerId;
      const now = new Date();
      const month = parseInt(req.query.month) || now.getMonth() + 1;
      const year = parseInt(req.query.year) || now.getFullYear();
  
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
  
      const customer = await Customer.findById(customerId).lean();
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
  
      const logs = await WashLogs.find({
        customerId,
        date: { $gte: startDate, $lte: endDate }
      }).lean();
  
      const subscriptions = await Subscription.find({ customerId })
        .populate('planId', 'name price')
        .lean();
  
      const paymentStatusDoc = await PaymentStatus.findOne({
        customerId,
        apartmentId: customer.apartmentId,
        month,
        year
      }).lean();
  
      const additionalLogs = logs.filter(log => log.isAdditional);
      const planTotal = subscriptions.reduce((acc, sub) => acc + (sub.planId?.price || 0), 0);
      const additionalTotal = additionalLogs.reduce((acc, log) => acc + (log.additionalCharge || 0), 0);
      const amount = planTotal + additionalTotal;
  
      const namePart = customer.name?.slice(0,3).toUpperCase() || 'XXX';
      const phonePart = customer.phone?.slice(0, 3) || '000';
      const invoiceId = `INV-${year}-${namePart}${phonePart}`;
  
      const html = await ejs.renderFile(
        path.join(__dirname, '../templates/invoice.ejs'),
        {
          invoiceId,
          name: customer.name,
          phone: customer.phone,
          month,
          year,
          subscriptions: subscriptions.map(s => ({
            planName: s.planId?.name,
            planPrice: s.planId?.price
          })),
          logs,
          amount,
          planTotal,
          additionalTotal,
          paymentStatus: paymentStatusDoc?.status || 'unpaid',
          paymentDate: paymentStatusDoc?.paymentDate
        }
      );
  
      const file = { content: html };
      const pdfBuffer = await pdf.generatePdf(file, {
        format: 'A4',
        margin: {
          top: '20px',
          bottom: '20px',
          left: '20px',
          right: '20px'
        }
      });
  
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${invoiceId}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      console.error('PDF generation error:', err);
      res.status(500).json({ error: 'Failed to generate invoice PDF' });
    }
  });  
  

// PUT /payment-status/:customerId
router.put('/payment-status/:customerId', async (req, res) => {
    const { customerId } = req.params;
    const { month, year, status, apartmentId, notes, amountPaid = 0 } = req.body;
  
    if (!['paid', 'unpaid'].includes(status)) {
      return res.status(400).json({ error: 'Invalid payment status' });
    }
  
    if (!month || !year || !apartmentId) {
      return res.status(400).json({ error: 'Month, year, and apartmentId are required' });
    }
  
    try {

      const update = {
        status,
        notes,
        amountPaid,
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
