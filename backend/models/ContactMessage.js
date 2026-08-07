const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ContactMessage = sequelize.define('ContactMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  firstName: DataTypes.STRING,
  lastName: DataTypes.STRING,
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isEmail: true },
  },
  phone: DataTypes.STRING,
  topic: DataTypes.STRING, // e.g. 'application_status', 'general', 'technical', 'complaint'
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('new', 'in_progress', 'resolved'),
    defaultValue: 'new',
  },
  ipAddress: DataTypes.STRING,
}, {
  tableName: 'contact_messages',
  timestamps: true,
});

module.exports = ContactMessage;
