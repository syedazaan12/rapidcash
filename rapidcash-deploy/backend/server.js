require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const applicationRoutes = require('./routes/applications');
const documentRoutes = require('./routes/documents');
const adminRoutes = require('./routes/admin');
const contactRoutes = require('./routes/contact');

const app = express();

// --- Security middleware ---
app.use(helmet());
app.disable('x-powered-by');

app.use(cors((req, callback) => {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.header('Origin');
  let isAllowed = false;

  if (!origin) {
    isAllowed = true;
  } else if (allowedOrigins.includes(origin)) {
    isAllowed = true;
  } else {
    try {
      const originUrl = new URL(origin);
      const requestHost = req.header('host');
      if (originUrl.host === requestHost) {
        isAllowed = true;
      }
    } catch (e) {
      // Ignore invalid origin URL format
    }
  }

  if (isAllowed) {
    callback(null, { origin: true, credentials: true });
  } else {
    callback(new Error('Not allowed by CORS'));
  }
}));

app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// General API rate limit (login has its own stricter limit in routes/auth.js).
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// --- Routes ---
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);

// --- Serve Static Frontend Files ---
const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// --- Error handling ---
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Something went wrong. Please try again.' });
});

const PORT = process.env.PORT || 4000;

sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`RapidCash API listening on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});

module.exports = app;
