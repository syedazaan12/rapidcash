const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  actorUserId: DataTypes.UUID,
  action: DataTypes.STRING, // e.g. 'application.status_changed', 'user.login', 'document.viewed'
  targetType: DataTypes.STRING, // 'Application' | 'User' | 'Document'
  targetId: DataTypes.UUID,
  ipAddress: DataTypes.STRING,
  metadata: DataTypes.TEXT, // JSON-stringified extra context
}, {
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false,
});

module.exports = AuditLog;
