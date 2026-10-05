import jwt from 'jsonwebtoken';
import { findUserById, toPublicUser } from '../models/user.js';

const COOKIE_NAME = 'triply_token';

/**
 * @returns {string}
 */
function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

/**
 * @param {string} userId
 * @returns {string}
 */
export function signToken(userId) {
  return jwt.sign({ sub: userId }, jwtSecret(), { expiresIn: '14d' });
}

/**
 * @param {import('express').Response} res
 * @param {string} token
 */
export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

/**
 * @param {import('express').Response} res
 */
export function clearAuthCookie(res) {
  // Match path/sameSite/secure from set — omit maxAge so the cookie is deleted.
  const { maxAge: _maxAge, ...clearOpts } = cookieOptions();
  res.clearCookie(COOKIE_NAME, clearOpts);
}

/**
 * Shared cookie flags so set/clear stay in sync on Render (HTTPS + proxy).
 * @returns {import('express').CookieOptions}
 */
function cookieOptions() {
  const secure =
    process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 14 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

/**
 * Attach `req.user` (public profile) when a valid JWT cookie is present.
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
export async function optionalAuth(req, _res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      req.user = null;
      return next();
    }
    const payload = jwt.verify(token, jwtSecret());
    const userId = typeof payload === 'object' && payload && 'sub' in payload ? String(payload.sub) : '';
    const doc = userId ? await findUserById(userId) : null;
    req.user = doc ? toPublicUser(doc) : null;
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Require a logged-in user.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function requireAuth(req, res, next) {
  await optionalAuth(req, res, () => {
    if (!req.user) {
      res.status(401).json({ ok: false, reason: 'unauthorized' });
      return;
    }
    next();
  });
}

export { COOKIE_NAME };
