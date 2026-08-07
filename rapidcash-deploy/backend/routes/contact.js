const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { ContactMessage } = require('../models');

const router = express.Router();

// Prevent spam / abuse of the public, unauthenticated contact form.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many messages sent from this connection. Please try again later or call us directly.' },
});

router.post(
  '/',
  contactLimiter,
  [
    body('firstName').trim().notEmpty().withMessage('First name is required.'),
    body('lastName').trim().notEmpty().withMessage('Last name is required.'),
    body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
    body('phone').optional({ checkFalsy: true }).isMobilePhone('any'),
    body('topic').trim().notEmpty().withMessage('Please select a topic.'),
    body('message').trim().isLength({ min: 10, max: 2000 })
      .withMessage('Message must be between 10 and 2000 characters.'),
    // Honeypot field - real users never fill this in; bots often do.
    body('website').custom((value) => {
      if (value) throw new Error('Submission rejected.');
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { firstName, lastName, email, phone, topic, message } = req.body;

    const contactMessage = await ContactMessage.create({
      firstName, lastName, email, phone, topic, message,
      ipAddress: req.ip,
    });

    // In production: notify support@rapidcash.credit and send the customer
    // a confirmation email here (see emails/templates for the pattern).

    res.status(201).json({
      success: true,
      message: 'Thank you — your message has been received. A member of our support team will respond within one business day.',
      id: contactMessage.id,
    });
  }
);

module.exports = router;
