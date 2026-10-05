/**
 * Frontend API base. Empty string = same origin as the Express backend
 * (recommended: open the site via `npm start`, not a separate static server).
 */
export const API_BASE = '';

/**
 * Build an absolute API path for fetch / media URLs.
 * @param {string} path e.g. `/api/media/dest/coxs-bazar/hero`
 * @returns {string}
 */
export function apiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}
