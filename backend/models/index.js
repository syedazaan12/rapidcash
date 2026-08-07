const sequelize = require('../config/db');
const User = require('./User');
const Application = require('./Application');
const Document = require('./Document');
const AuditLog = require('./AuditLog');
const ContactMessage = require('./ContactMessage');

User.hasMany(Application, { foreignKey: 'userId' });
Application.belongsTo(User, { foreignKey: 'userId' });

Application.hasMany(Document, { foreignKey: 'applicationId' });
Document.belongsTo(Application, { foreignKey: 'applicationId' });

module.exports = { sequelize, User, Application, Document, AuditLog, ContactMessage };
