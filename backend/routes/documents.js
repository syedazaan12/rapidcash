const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { Application, Document, AuditLog } = require('../models');
const { requireAuth, ownsApplicationOrStaff } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_ROOT = path.join(__dirname, '..', 'secure_uploads'); // never served statically
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_ROOT, req.params.applicationId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Unsupported file type. Accepted formats: PDF, PNG, JPG.'));
    }
    cb(null, true);
  },
});

router.post(
  '/:applicationId',
  requireAuth,
  ownsApplicationOrStaff(async (req) => {
    const app = await Application.findByPk(req.params.applicationId);
    return app ? app.userId : null;
  }),
  upload.single('file'),
  async (req, res) => {
    const { type } = req.body;
    if (!Document.TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${Document.TYPES.join(', ')}` });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const document = await Document.create({
      applicationId: req.params.applicationId,
      type,
      originalFilename: req.file.originalname,
      storagePath: req.file.path,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    });

    await AuditLog.create({
      actorUserId: req.user.id,
      action: 'document.uploaded',
      targetType: 'Document',
      targetId: document.id,
      ipAddress: req.ip,
      metadata: JSON.stringify({ applicationId: req.params.applicationId, type }),
    });

    res.status(201).json({
      document: {
        id: document.id, type: document.type, originalFilename: document.originalFilename,
        status: document.status, uploadedAt: document.uploadedAt,
      },
    });
  }
);

router.get(
  '/:applicationId',
  requireAuth,
  ownsApplicationOrStaff(async (req) => {
    const app = await Application.findByPk(req.params.applicationId);
    return app ? app.userId : null;
  }),
  async (req, res) => {
    const documents = await Document.findAll({ where: { applicationId: req.params.applicationId } });
    res.json({
      documents: documents.map((d) => ({
        id: d.id, type: d.type, originalFilename: d.originalFilename,
        status: d.status, uploadedAt: d.uploadedAt,
      })),
    });
  }
);

// Authenticated document download endpoint
router.get(
  '/download/:documentId',
  requireAuth,
  async (req, res) => {
    try {
      const document = await Document.findByPk(req.params.documentId);
      if (!document) return res.status(404).json({ error: 'Document not found.' });

      const app = await Application.findByPk(document.applicationId);
      if (!app) return res.status(404).json({ error: 'Application not found.' });

      // Only staff or the owner of the application can view/download
      if (req.user.role === 'applicant' && app.userId !== req.user.id) {
        return res.status(403).json({ error: 'You do not have permission to access this document.' });
      }

      if (!fs.existsSync(document.storagePath)) {
        return res.status(404).json({ error: 'Document file not found on disk.' });
      }

      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename}"`);
      res.sendFile(document.storagePath);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to download document.' });
    }
  }
);

module.exports = router;
