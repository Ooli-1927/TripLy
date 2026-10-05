import { apiUrl } from '../config.js';

/**
 * Client session + auth API (MongoDB Atlas via Express).
 *
 * Login gate uses localStorage profile (`triply.session`). Once written on
 * login/signup it stays until explicit logout — refresh must not bounce users.
 * API calls also send a Bearer token (`triply.token`) plus the httpOnly cookie.
 */

const SESSION_KEY = 'triply.session';
const TOKEN_KEY = 'triply.token';

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
  clearToken();
}

/**
 * @returns {string | null}
 */
export function readToken() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    return typeof token === 'string' && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} token
 */
export function writeToken(token) {
  try {
    if (typeof token === 'string' && token.trim()) {
      localStorage.setItem(TOKEN_KEY, token.trim());
    }
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Headers for authenticated API calls (cookie still sent via credentials).
 * @returns {Record<string, string>}
 */
export function authHeaders() {
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * @returns {boolean}
 */
export function isLoggedIn() {
  return readSession() != null;
}

/**
 * Sync profile from the API when possible. Never clears local login on refresh
 * failures — only logoutUser() clears the session.
 * @returns {Promise<SessionUser | null>}
 */
export async function hydrateSession() {
  const cached = readSession();
  try {
    const response = await fetch(apiUrl('/api/auth/me'), {
      credentials: 'include',
      headers: {
        ...authHeaders(),
      },
    });

    if (!response.ok) {
      // Keep existing login across refresh / cold start / missing cookie.
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
    if (typeof data.token === 'string' && data.token) writeToken(data.token);
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
    if (typeof data.token === 'string') writeToken(data.token);
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
    if (typeof data.token === 'string') writeToken(data.token);
    return { ok: true, user: /** @type {SessionUser} */ (data.user) };
  } catch {
    return { ok: false, reason: 'storage' };
  }
}

/**
 * Clear JWT cookie on the server and local profile + token cache.
 * @returns {Promise<void>}
 */
export async function logoutUser() {
  try {
    await fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...authHeaders(),
      },
    });
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
