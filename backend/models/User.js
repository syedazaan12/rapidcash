const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    // applicant | loan_officer | underwriter | admin
    type: DataTypes.ENUM('applicant', 'loan_officer', 'underwriter', 'admin'),
    defaultValue: 'applicant',
    allowNull: false,
  },
  firstName: DataTypes.STRING,
  lastName: DataTypes.STRING,
  phone: DataTypes.STRING,
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  twoFactorEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  lastLoginAt: DataTypes.DATE,
}, {
  tableName: 'users',
  timestamps: true,
});

module.exports = User;
