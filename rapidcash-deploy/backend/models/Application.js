const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { encryptField, decryptField, maskLast4 } = require('../utils/encryption');

const STATUSES = [
  'received',
  'verification',
  'processing',
  'underwriting',
  'additional_documents_required',
  'decision_pending',
  'approved',
  'declined',
  'funded',
  'closed',
];

const Application = sequelize.define('Application', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM(...STATUSES),
    defaultValue: 'received',
    allowNull: false,
  },

  // --- Step 1: Personal information ---
  firstName: DataTypes.STRING,
  middleName: DataTypes.STRING,
  lastName: DataTypes.STRING,
  dateOfBirth: DataTypes.DATEONLY,
  // SSN is never stored in plaintext - see ssn getter/setter below.
  ssnEncrypted: DataTypes.STRING,
  phone: DataTypes.STRING,
  driverLicenseNumber: DataTypes.STRING,
  driverLicenseState: DataTypes.STRING,
  maritalStatus: DataTypes.STRING,
  citizenshipStatus: DataTypes.STRING,

  // --- Step 2: Address ---
  street: DataTypes.STRING,
  apartment: DataTypes.STRING,
  city: DataTypes.STRING,
  state: DataTypes.STRING,
  zip: DataTypes.STRING,
  residenceType: DataTypes.STRING,
  yearsAtAddress: DataTypes.FLOAT,
  monthlyHousingPayment: DataTypes.FLOAT,

  // --- Step 3: Employment ---
  employerName: DataTypes.STRING,
  employerPhone: DataTypes.STRING,
  occupation: DataTypes.STRING,
  employmentStatus: DataTypes.STRING,
  monthlyIncome: DataTypes.FLOAT,
  additionalIncome: DataTypes.FLOAT,
  yearsEmployed: DataTypes.FLOAT,
  payFrequency: DataTypes.STRING,

  // --- Step 4: Bank information ---
  bankName: DataTypes.STRING,
  // Routing + account numbers are also encrypted at rest.
  routingNumberEncrypted: DataTypes.STRING,
  accountNumberEncrypted: DataTypes.STRING,
  accountType: DataTypes.STRING,
  directDepositConsent: DataTypes.BOOLEAN,

  // --- Step 5: Loan information ---
  requestedAmount: DataTypes.FLOAT,
  purpose: DataTypes.STRING,
  preferredTermMonths: DataTypes.INTEGER,
  additionalComments: DataTypes.TEXT,

  // --- Internal / underwriting fields ---
  riskScore: DataTypes.FLOAT,
  assignedUnderwriterId: DataTypes.UUID,
  internalNotes: DataTypes.TEXT,
  submittedAt: DataTypes.DATE,
  decisionAt: DataTypes.DATE,
}, {
  tableName: 'applications',
  timestamps: true,
  getterMethods: {
    ssnMasked() {
      const raw = this.getDataValue('ssnEncrypted');
      if (!raw) return null;
      return maskLast4(decryptField(raw));
    },
    accountNumberMasked() {
      const raw = this.getDataValue('accountNumberEncrypted');
      if (!raw) return null;
      return maskLast4(decryptField(raw));
    },
  },
});

// Virtual helpers so routes never handle raw plaintext SSN/account numbers directly.
Application.encryptSensitive = function encryptSensitive(fields) {
  const out = { ...fields };
  if (fields.ssn !== undefined) {
    out.ssnEncrypted = encryptField(fields.ssn);
    delete out.ssn;
  }
  if (fields.routingNumber !== undefined) {
    out.routingNumberEncrypted = encryptField(fields.routingNumber);
    delete out.routingNumber;
  }
  if (fields.accountNumber !== undefined) {
    out.accountNumberEncrypted = encryptField(fields.accountNumber);
    delete out.accountNumber;
  }
  return out;
};

Application.STATUSES = STATUSES;

module.exports = Application;
