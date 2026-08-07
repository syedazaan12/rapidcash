const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { User, AuditLog } = require('../models');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Slow down credential-stuffing / brute-force attempts.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' },
});

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 10 }).withMessage('Password must be at least 10 characters.'),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, firstName, lastName, phone } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email, passwordHash, firstName, lastName, phone, role: 'applicant',
    });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    });
  }
);

router.post(
  '/login',
  loginLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    // Same generic error whether the email doesn't exist or the password is wrong,
    // so an attacker can't use this endpoint to enumerate valid accounts.
    const genericError = () => res.status(401).json({ error: 'Invalid email or password.' });

    if (!user || !user.isActive) return genericError();

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return genericError();

    user.lastLoginAt = new Date();
    await user.save();

    await AuditLog.create({
      actorUserId: user.id,
      action: 'user.login',
      targetType: 'User',
      targetId: user.id,
      ipAddress: req.ip,
    });

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    });
  }
);

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: ['id', 'email', 'role', 'firstName', 'lastName', 'phone', 'twoFactorEnabled'],
  });
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user });
});

module.exports = router;
