const jwt = require('jsonwebtoken');
const { User } = require('../models');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Look the account up on every request rather than trusting the token's
    // stale snapshot. This is what makes deactivating or role-changing a
    // staff account take effect immediately, instead of only once their
    // JWT naturally expires - important for "we just fired someone" cases.
    const user = await User.findByPk(payload.id, {
      attributes: ['id', 'email', 'role', 'isActive'],
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'This account no longer has access. Please contact an administrator.' });
    }

    // Use the live role from the DB, not whatever role was baked into the token,
    // so a role downgrade also takes effect immediately.
    req.user = { id: user.id, role: user.role, email: user.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

// Ensures an applicant can only touch their own application, while staff roles pass through.
function ownsApplicationOrStaff(getOwnerId) {
  return async (req, res, next) => {
    try {
      if (['loan_officer', 'underwriter', 'admin'].includes(req.user.role)) return next();
      const ownerId = await getOwnerId(req);
      if (ownerId !== req.user.id) {
        return res.status(403).json({ error: 'You do not have permission to access this application.' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireAuth, requireRole, ownsApplicationOrStaff };
