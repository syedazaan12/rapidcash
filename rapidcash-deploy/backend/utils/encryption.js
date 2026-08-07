/**
 * AES-256-GCM field-level encryption for sensitive data (SSN, bank account
 * numbers, routing numbers, government ID numbers).
 *
 * This protects data AT REST in the database. It does not replace TLS
 * (encryption in transit) - the app must always be served over HTTPS in
 * production, which is normally terminated at your load balancer / reverse
 * proxy (nginx, ALB, Cloudflare, etc.), not in this Node process.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended for GCM

function getKey() {
  const keyHex = process.env.FIELD_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY must be set in .env as a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts a plaintext string. Returns a single string combining
 * iv:authTag:ciphertext (all hex) so it can be stored in one DB column.
 */
function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

function decryptField(payload) {
  if (!payload) return null;
  const key = getKey();
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  if (!ivHex || !authTagHex || !dataHex) throw new Error('Malformed encrypted payload');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * One-way mask for display purposes, e.g. "***-**-1234" for an SSN.
 * Use this in API responses and UI instead of the decrypted value
 * wherever the full value isn't strictly needed.
 */
function maskLast4(plaintext) {
  if (!plaintext) return null;
  const digits = String(plaintext).replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `***-**-${digits.slice(-4)}`;
}

module.exports = { encryptField, decryptField, maskLast4 };
