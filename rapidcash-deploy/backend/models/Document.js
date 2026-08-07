const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const DOCUMENT_TYPES = [
  'government_id',
  'bank_statement',
  'pay_stub',
  'tax_return',
  'w2',
  '1099',
  'credit_report',
  'proof_of_address',
  'other',
];

const Document = sequelize.define('Document', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  applicationId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM(...DOCUMENT_TYPES),
    allowNull: false,
  },
  originalFilename: DataTypes.STRING,
  // Files are stored outside the web root; this is the path on disk / object storage key.
  storagePath: DataTypes.STRING,
  mimeType: DataTypes.STRING,
  sizeBytes: DataTypes.INTEGER,
  status: {
    type: DataTypes.ENUM('pending_review', 'accepted', 'rejected'),
    defaultValue: 'pending_review',
  },
  uploadedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'documents',
  timestamps: true,
});

Document.TYPES = DOCUMENT_TYPES;

module.exports = Document;
