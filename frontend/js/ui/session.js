import { apiUrl } from '../config.js';

/**
 * Client session + auth API (MongoDB Atlas via Express).
 * Profile may be cached in localStorage for fast paint; source of truth is the JWT cookie.
 */

const SESSION_KEY = 'triply.session';

/**
 * @typedef {{
 *   id?: string,
 *   email: string,
 *   name: string,
 *   provider?: string,
 *   phone?: string,
 *   city?: string,
 *   ageBand?: string,
 *   avatarUrl?: string | null,
 * }} SessionUser
 */

/**
 * @returns {SessionUser | null}
 */
export function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.email !== 'string') return null;
    return {
      id: typeof parsed.id === 'string' ? parsed.id : undefined,
      email: parsed.email,
      name: typeof parsed.name === 'string' && parsed.name ? parsed.name : parsed.email,
      provider: typeof parsed.provider === 'string' ? parsed.provider : 'email',
      phone: typeof parsed.phone === 'string' ? parsed.phone : undefined,
      city: typeof parsed.city === 'string' ? parsed.city : undefined,
      ageBand: typeof parsed.ageBand === 'string' ? parsed.ageBand : undefined,
      avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : null,
    };
  } catch {
    return null;
  }
}

/**
 * @param {SessionUser} user
 */
export function writeSession(user) {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        id: user.id || '',
        email: user.email,
        name: user.name,
        provider: user.provider || 'email',
        phone: user.phone || '',
        city: user.city || '',
        ageBand: user.ageBand || '',
        avatarUrl: user.avatarUrl || null,
      }),
    );
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @returns {boolean}
 */
export function isLoggedIn() {
  return readSession() != null;
}

/**
 * Confirm the JWT cookie with the API and sync the local profile cache.
 * Keeps the cached profile on transient API failures (e.g. Render cold start)
 * so a refresh does not bounce logged-in users back to the login gate.
 * @returns {Promise<SessionUser | null>}
 */
export async function hydrateSession() {
  const cached = readSession();
  try {
    const response = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' });

    // Only a definitive unauthorized response clears the local session.
    if (response.status === 401) {
      clearSession();
      return null;
    }

    if (!response.ok) {
      return cached;
    }

    const data = await response.json();
    if (!data?.ok || !data.user) {
      return cached;
    }

    /** @type {SessionUser} */
    const user = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      phone: data.user.phone,
      city: data.user.city,
      ageBand: data.user.ageBand,
      provider: data.user.provider || 'email',
      avatarUrl: data.user.avatarUrl ?? null,
    };
    writeSession(user);
    return user;
  } catch {
    return cached;
  }
}

/**
 * @param {Omit<SessionUser, 'id' | 'provider' | 'avatarUrl'> & { password: string }} input
 * @returns {Promise<{ ok: true, user: SessionUser } | { ok: false, reason: string }>}
 */
export async function registerUser(input) {
  try {
    const response = await fetch(apiUrl('/api/auth/signup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        phone: input.phone,
        city: input.city,
        ageBand: input.ageBand,
        password: input.password,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      return { ok: false, reason: data.reason || 'storage' };
    }
    return { ok: true, user: /** @type {SessionUser} */ (data.user) };
  } catch {
    return { ok: false, reason: 'storage' };
  }
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ ok: true, user: SessionUser } | { ok: false, reason: string }>}
 */
export async function authenticateUser(email, password) {
  try {
    const response = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      return { ok: false, reason: data.reason || 'badCredentials' };
    }
    return { ok: true, user: /** @type {SessionUser} */ (data.user) };
  } catch {
    return { ok: false, reason: 'storage' };
  }
}

/**
 * Clear JWT cookie on the server and local profile cache.
 * @returns {Promise<void>}
 */
export async function logoutUser() {
  try {
    await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
  } catch {
    /* ignore network errors; still clear local cache */
  }
  clearSession();
}

/**
 * Bangladesh mobile numbers: 01XXXXXXXXX / +8801XXXXXXXXX
 * @param {string} value
 * @returns {boolean}
 */
export function isValidBdPhone(value) {
  const digits = String(value || '').replace(/[\s\-()]/g, '');
  return /^(?:\+?880|0)?1[3-9]\d{8}$/.test(digits);
}

/**
 * @param {string} value
 * @returns {string}
 */
export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length === 13) return `+${digits}`;
  if (digits.startsWith('01') && digits.length === 11) return `+880${digits.slice(1)}`;
  return digits;
}
