import { Router } from 'express';
import multer from 'multer';
import {
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  signToken,
} from '../middleware/auth.js';
import { getMediaBucket } from '../db.js';
import {
  createUser,
  findUserByEmail,
  findUserById,
  setUserAvatar,
  toPublicUser,
  verifyPassword,
} from '../models/user.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    if (!ok) {
      cb(new Error('invalid_image'));
      return;
    }
    cb(null, true);
  },
});

const AGE_BANDS = new Set(['18-24', '25-34', '35-44', '45-54', '55+']);
const CITIES = new Set(['dhaka', 'chattogram', 'sylhet', 'rajshahi', 'khulna']);

/**
 * @param {string} value
 * @returns {boolean}
 */
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isValidBdPhone(value) {
  const digits = String(value || '').replace(/[\s\-()]/g, '');
  return /^(?:\+?880|0)?1[3-9]\d{8}$/.test(digits);
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length === 13) return `+${digits}`;
  if (digits.startsWith('01') && digits.length === 11) return `+880${digits.slice(1)}`;
  return digits;
}

router.post('/signup', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '');
    const city = String(req.body?.city || '').trim().toLowerCase();
    const ageBand = String(req.body?.ageBand || '').trim();
    const password = String(req.body?.password || '');

    if (!name) return res.status(400).json({ ok: false, reason: 'name' });
    if (!isValidEmail(email)) return res.status(400).json({ ok: false, reason: 'email' });
    if (!isValidBdPhone(phone)) return res.status(400).json({ ok: false, reason: 'phone' });
    if (!CITIES.has(city)) return res.status(400).json({ ok: false, reason: 'city' });
    if (!AGE_BANDS.has(ageBand)) return res.status(400).json({ ok: false, reason: 'ageBand' });
    if (password.length < 8) return res.status(400).json({ ok: false, reason: 'passwordShort' });

    if (await findUserByEmail(email)) {
      return res.status(409).json({ ok: false, reason: 'exists' });
    }

    const user = await createUser({
      name,
      email,
      phone: normalizePhone(phone),
      city,
      ageBand,
      password,
    });
    const publicUser = toPublicUser(user);
    const token = signToken(publicUser.id);
    setAuthCookie(res, token);
    return res.status(201).json({ ok: true, user: publicUser, token });
  } catch (err) {
    console.error('signup failed', err);
    return res.status(500).json({ ok: false, reason: 'storage' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ ok: false, reason: 'badCredentials' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ ok: false, reason: 'badCredentials' });
    }
    const match = await verifyPassword(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ ok: false, reason: 'badCredentials' });
    }

    const publicUser = toPublicUser(user);
    const token = signToken(publicUser.id);
    setAuthCookie(res, token);
    return res.json({ ok: true, user: publicUser, token });
  } catch (err) {
    console.error('login failed', err);
    return res.status(500).json({ ok: false, reason: 'storage' });
  }
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const token = signToken(req.user.id);
  setAuthCookie(res, token);
  return res.json({ ok: true, user: req.user, token });
});

router.post('/avatar', requireAuth, (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ ok: false, reason: 'invalid_image' });
    }
    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, reason: 'invalid_image' });
      }
      const userId = req.user.id;
      const existing = await findUserById(userId);
      if (!existing) {
        return res.status(401).json({ ok: false, reason: 'unauthorized' });
      }

      const bucket = getMediaBucket();
      if (existing.avatarFileId) {
        try {
          await bucket.delete(existing.avatarFileId);
        } catch {
          /* old file may already be gone */
        }
      }

      const filename = `avatar-${userId}`;
      const uploadStream = bucket.openUploadStream(filename, {
        contentType: req.file.mimetype,
        metadata: { kind: 'avatar', userId },
      });

      await new Promise((resolve, reject) => {
        uploadStream.on('finish', resolve);
        uploadStream.on('error', reject);
        uploadStream.end(req.file.buffer);
      });

      await setUserAvatar(userId, uploadStream.id);
      const updated = await findUserById(userId);
      return res.json({ ok: true, user: updated ? toPublicUser(updated) : req.user });
    } catch (error) {
      console.error('avatar upload failed', error);
      return res.status(500).json({ ok: false, reason: 'storage' });
    }
  });
});

export default router;
