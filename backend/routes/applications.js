const express = require('express');
const { body, validationResult } = require('express-validator');
const { Application, Document, AuditLog } = require('../models');
const { requireAuth, ownsApplicationOrStaff } = require('../middleware/auth');

const router = express.Router();

// A conservative allow-list of fields an applicant is permitted to write.
// Internal fields (status, riskScore, internalNotes, assignedUnderwriterId)
// are deliberately excluded and can only be changed via the admin routes.
const APPLICANT_WRITABLE_FIELDS = [
  'firstName', 'middleName', 'lastName', 'dateOfBirth', 'ssn', 'phone',
  'driverLicenseNumber', 'driverLicenseState', 'maritalStatus', 'citizenshipStatus',
  'street', 'apartment', 'city', 'state', 'zip', 'residenceType',
  'yearsAtAddress', 'monthlyHousingPayment',
  'employerName', 'employerPhone', 'occupation', 'employmentStatus',
  'monthlyIncome', 'additionalIncome', 'yearsEmployed', 'payFrequency',
  'bankName', 'routingNumber', 'accountNumber', 'accountType', 'directDepositConsent',
  'requestedAmount', 'purpose', 'preferredTermMonths', 'additionalComments',
];

function pickWritableFields(body) {
  const out = {};
  for (const key of APPLICANT_WRITABLE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

function serializeApplication(app) {
  const json = app.toJSON();
  // Never send encrypted or raw sensitive fields to the client - only masked versions.
  delete json.ssnEncrypted;
  delete json.routingNumberEncrypted;
  delete json.accountNumberEncrypted;
  json.ssnMasked = app.ssnMasked;
  json.accountNumberMasked = app.accountNumberMasked;
  return json;
}

// Start (or fetch the current in-progress draft of) an application.
router.post('/', requireAuth, async (req, res) => {
  let application = await Application.findOne({
    where: { userId: req.user.id, status: 'received' },
    order: [['createdAt', 'DESC']],
  });
  if (!application) {
    application = await Application.create({ userId: req.user.id, status: 'received' });
  }
  res.status(201).json({ application: serializeApplication(application) });
});

// Save progress on a draft (used by "Save Progress / Resume Later").
router.patch('/:id', requireAuth, async (req, res) => {
  const application = await Application.findByPk(req.params.id);
  if (!application) return res.status(404).json({ error: 'Application not found.' });
  if (application.userId !== req.user.id) {
    return res.status(403).json({ error: 'You do not have permission to edit this application.' });
  }

  const updates = Application.encryptSensitive(pickWritableFields(req.body));
  await application.update(updates);
  res.json({ application: serializeApplication(application) });
});

// Final submission - locks the "received" status in and stamps submittedAt.
router.post(
  '/:id/submit',
  requireAuth,
  [
    body('requestedAmount').isFloat({ gt: 0 }),
    body('purpose').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const application = await Application.findByPk(req.params.id);
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    if (application.userId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to submit this application.' });
    }

    application.submittedAt = new Date();
    application.status = 'verification';
    await application.save();

    await AuditLog.create({
      actorUserId: req.user.id,
      action: 'application.submitted',
      targetType: 'Application',
      targetId: application.id,
      ipAddress: req.ip,
    });

    // In production: enqueue "Application Submitted" email/SMS here (see emails/templates).
    res.json({ application: serializeApplication(application) });
  }
);

// Applicant dashboard: list my applications.
router.get('/', requireAuth, async (req, res) => {
  const applications = await Application.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']] });
  res.json({ applications: applications.map(serializeApplication) });
});

router.get(
  '/:id',
  requireAuth,
  ownsApplicationOrStaff(async (req) => {
    const app = await Application.findByPk(req.params.id);
    return app ? app.userId : null;
  }),
  async (req, res) => {
    const application = await Application.findByPk(req.params.id, { include: [Document] });
    if (!application) return res.status(404).json({ error: 'Application not found.' });
    res.json({ application: serializeApplication(application) });
  }
);

module.exports = router;
