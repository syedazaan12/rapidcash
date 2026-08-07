const express = require('express');
const { Op } = require('sequelize');
const { body, validationResult } = require('express-validator');
const { Application, Document, User, AuditLog, ContactMessage } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Every route in this file requires staff-level auth.
router.use(requireAuth, requireRole('loan_officer', 'underwriter', 'admin'));

function serializeApplicationForStaff(app) {
  const json = app.toJSON();
  delete json.ssnEncrypted;
  delete json.routingNumberEncrypted;
  delete json.accountNumberEncrypted;
  json.ssnMasked = app.ssnMasked;
  json.accountNumberMasked = app.accountNumberMasked;
  return json;
}

// Dashboard summary stats.
router.get('/stats', async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [today, pending, approved, declined, docsPending] = await Promise.all([
    Application.count({ where: { createdAt: { [Op.gte]: startOfDay } } }),
    Application.count({ where: { status: ['received', 'verification', 'processing', 'underwriting', 'decision_pending'] } }),
    Application.count({ where: { status: ['approved', 'funded'] } }),
    Application.count({ where: { status: 'declined' } }),
    Document.count({ where: { status: 'pending_review' } }),
  ]);

  res.json({ stats: { applicationsToday: today, pending, approved, declined, documentsPending: docsPending } });
});

// Search / filter / paginate applications.
router.get('/applications', async (req, res) => {
  const { status, q, page = 1, pageSize = 25 } = req.query;
  const where = {};
  if (status) where.status = status;
  if (q) {
    where[Op.or] = [
      { firstName: { [Op.like]: `%${q}%` } },
      { lastName: { [Op.like]: `%${q}%` } },
      { city: { [Op.like]: `%${q}%` } },
    ];
  }

  const limit = Math.min(parseInt(pageSize, 10) || 25, 100);
  const offset = (Math.max(parseInt(page, 10), 1) - 1) * limit;

  const { rows, count } = await Application.findAndCountAll({
    where, limit, offset, order: [['createdAt', 'DESC']],
  });

  res.json({
    applications: rows.map(serializeApplicationForStaff),
    pagination: { page: Number(page), pageSize: limit, total: count },
  });
});

router.get('/applications/:id', async (req, res) => {
  const application = await Application.findByPk(req.params.id, { include: [Document, User] });
  if (!application) return res.status(404).json({ error: 'Application not found.' });
  res.json({ application: serializeApplicationForStaff(application) });
});

router.patch(
  '/applications/:id/status',
  [body('status').isIn(Application.STATUSES)],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const application = await Application.findByPk(req.params.id);
    if (!application) return res.status(404).json({ error: 'Application not found.' });

    const previousStatus = application.status;
    application.status = req.body.status;
    if (['approved', 'declined'].includes(req.body.status)) application.decisionAt = new Date();
    await application.save();

    await AuditLog.create({
      actorUserId: req.user.id,
      action: 'application.status_changed',
      targetType: 'Application',
      targetId: application.id,
      ipAddress: req.ip,
      metadata: JSON.stringify({ from: previousStatus, to: req.body.status }),
    });

    // In production: trigger the matching automated email template here
    // (Documents Needed / Under Review / Decision / Funding, etc.)
    res.json({ application: serializeApplicationForStaff(application) });
  }
);

router.patch(
  '/applications/:id/assign',
  requireRole('admin', 'underwriter'),
  [body('underwriterId').isUUID()],
  async (req, res) => {
    const application = await Application.findByPk(req.params.id);
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    application.assignedUnderwriterId = req.body.underwriterId;
    await application.save();
    res.json({ application: serializeApplicationForStaff(application) });
  }
);

router.post(
  '/applications/:id/notes',
  [body('note').trim().notEmpty()],
  async (req, res) => {
    const application = await Application.findByPk(req.params.id);
    if (!application) return res.status(404).json({ error: 'Application not found.' });

    const stamp = `[${new Date().toISOString()}] ${req.user.email}: ${req.body.note}`;
    application.internalNotes = application.internalNotes
      ? `${application.internalNotes}\n${stamp}`
      : stamp;
    await application.save();

    res.json({ internalNotes: application.internalNotes });
  }
);

router.patch(
  '/applications/:id/risk-score',
  requireRole('underwriter', 'admin'),
  [body('riskScore').isFloat({ min: 0, max: 100 })],
  async (req, res) => {
    const application = await Application.findByPk(req.params.id);
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    application.riskScore = req.body.riskScore;
    await application.save();
    res.json({ application: serializeApplicationForStaff(application) });
  }
);

// =====================================================================
// Staff management (admin only) - onboarding, offboarding, role changes
// =====================================================================

// List everyone with system access (loan officers, underwriters, admins).
router.get('/staff', requireRole('admin'), async (req, res) => {
  const staff = await User.findAll({
    where: { role: ['loan_officer', 'underwriter', 'admin'] },
    attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'lastLoginAt', 'createdAt'],
    order: [['createdAt', 'DESC']],
  });
  res.json({ staff });
});

// Create a new staff account (e.g. onboarding a new loan officer).
router.post(
  '/staff',
  requireRole('admin'),
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 10 }).withMessage('Password must be at least 10 characters.'),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('role').isIn(['loan_officer', 'underwriter', 'admin']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, firstName, lastName, role } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash, firstName, lastName, role });

    await AuditLog.create({
      actorUserId: req.user.id,
      action: 'staff.created',
      targetType: 'User',
      targetId: user.id,
      ipAddress: req.ip,
      metadata: JSON.stringify({ role }),
    });

    res.status(201).json({ staff: { id: user.id, email: user.email, role: user.role, isActive: user.isActive } });
  }
);

// Deactivate or reactivate a staff account. This is the "fire someone /
// lock them out immediately" control - requireAuth checks isActive on
// every request, so this takes effect on their very next call, not
// whenever their existing session would otherwise expire.
router.patch(
  '/staff/:id/status',
  requireRole('admin'),
  [body('isActive').isBoolean()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own access status.' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Staff account not found.' });

    user.isActive = req.body.isActive;
    await user.save();

    await AuditLog.create({
      actorUserId: req.user.id,
      action: user.isActive ? 'staff.reactivated' : 'staff.deactivated',
      targetType: 'User',
      targetId: user.id,
      ipAddress: req.ip,
    });

    res.json({ staff: { id: user.id, email: user.email, role: user.role, isActive: user.isActive } });
  }
);

// Change a staff member's role - e.g. revoke admin rights down to loan
// officer, or promote someone to admin.
router.patch(
  '/staff/:id/role',
  requireRole('admin'),
  [body('role').isIn(['loan_officer', 'underwriter', 'admin'])],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own role.' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Staff account not found.' });

    const previousRole = user.role;
    user.role = req.body.role;
    await user.save();

    await AuditLog.create({
      actorUserId: req.user.id,
      action: 'staff.role_changed',
      targetType: 'User',
      targetId: user.id,
      ipAddress: req.ip,
      metadata: JSON.stringify({ from: previousRole, to: user.role }),
    });

    res.json({ staff: { id: user.id, email: user.email, role: user.role, isActive: user.isActive } });
  }
);

// =====================================================================
// Audit log - review exactly what a staff member did before deciding
// whether to deactivate them, e.g. after a reported mishap.
// =====================================================================
router.get('/audit-logs', requireRole('admin'), async (req, res) => {
  const { actorUserId, action, page = 1, pageSize = 50 } = req.query;
  const where = {};
  if (actorUserId) where.actorUserId = actorUserId;
  if (action) where.action = action;

  const limit = Math.min(parseInt(pageSize, 10) || 50, 200);
  const offset = (Math.max(parseInt(page, 10), 1) - 1) * limit;

  const { rows, count } = await AuditLog.findAndCountAll({
    where, limit, offset, order: [['createdAt', 'DESC']],
  });

  res.json({ auditLogs: rows, pagination: { page: Number(page), pageSize: limit, total: count } });
});

// =====================================================================
// Contact messages (from the public contact form)
// =====================================================================
router.get('/contact-messages', async (req, res) => {
  const { status, page = 1, pageSize = 25 } = req.query;
  const where = {};
  if (status) where.status = status;

  const limit = Math.min(parseInt(pageSize, 10) || 25, 100);
  const offset = (Math.max(parseInt(page, 10), 1) - 1) * limit;

  const { rows, count } = await ContactMessage.findAndCountAll({
    where, limit, offset, order: [['createdAt', 'DESC']],
  });

  res.json({ messages: rows, pagination: { page: Number(page), pageSize: limit, total: count } });
});

router.patch(
  '/contact-messages/:id/status',
  [body('status').isIn(['new', 'in_progress', 'resolved'])],
  async (req, res) => {
    const message = await ContactMessage.findByPk(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found.' });
    message.status = req.body.status;
    await message.save();
    res.json({ message });
  }
);

module.exports = router;
