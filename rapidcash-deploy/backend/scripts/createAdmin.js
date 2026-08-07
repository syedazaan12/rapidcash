/**
 * One-time setup script: creates (or promotes) the admin account defined
 * by ADMIN_EMAIL / ADMIN_PASSWORD in .env.
 *
 * Usage:  node scripts/createAdmin.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../models');

async function main() {
  await sequelize.sync();

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user, created] = await User.findOrCreate({
    where: { email },
    defaults: { passwordHash, role: 'admin', firstName: 'Admin', lastName: 'User' },
  });

  if (!created) {
    user.role = 'admin';
    user.passwordHash = passwordHash;
    await user.save();
    console.log(`Updated existing user ${email} to admin role.`);
  } else {
    console.log(`Created admin user ${email}.`);
  }

  console.log('IMPORTANT: change this password after first login.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
