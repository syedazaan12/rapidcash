/**
 * Setup script: creates (or updates) two portal logins:
 * 1. Admin: admin@rapidcash.credit (role: admin, password: qwe123)
 * 2. Reviewer: reviewer@rapidcash.credit (role: underwriter, password: qwe123)
 *
 * Usage: node scripts/createLogins.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../models');

async function main() {
  console.log('Connecting to database...');
  await sequelize.sync();

  const password = 'qwe123';
  const passwordHash = await bcrypt.hash(password, 12);

  // 1. Create/Update Admin User
  const adminEmail = 'admin@rapidcash.credit';
  const [adminUser, adminCreated] = await User.findOrCreate({
    where: { email: adminEmail },
    defaults: {
      passwordHash,
      role: 'admin',
      firstName: 'System',
      lastName: 'Administrator',
      isActive: true
    },
  });

  if (!adminCreated) {
    adminUser.passwordHash = passwordHash;
    adminUser.role = 'admin';
    adminUser.isActive = true;
    await adminUser.save();
    console.log(`Updated existing user: ${adminEmail}`);
  } else {
    console.log(`Created new admin user: ${adminEmail}`);
  }

  // 2. Create/Update Reviewer User
  const reviewerEmail = 'reviewer@rapidcash.credit';
  const [reviewerUser, reviewerCreated] = await User.findOrCreate({
    where: { email: reviewerEmail },
    defaults: {
      passwordHash,
      role: 'underwriter',
      firstName: 'Portal',
      lastName: 'Reviewer',
      isActive: true
    },
  });

  if (!reviewerCreated) {
    reviewerUser.passwordHash = passwordHash;
    reviewerUser.role = 'underwriter';
    reviewerUser.isActive = true;
    await reviewerUser.save();
    console.log(`Updated existing user: ${reviewerEmail}`);
  } else {
    console.log(`Created new reviewer user: ${reviewerEmail}`);
  }

  console.log('\nSuccess! Portal logins configured:');
  console.log(`- Admin: ${adminEmail} (password: ${password})`);
  console.log(`- Reviewer: ${reviewerEmail} (password: ${password})`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to create logins:', err);
  process.exit(1);
});
