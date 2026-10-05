const STORAGE_KEY = 'triply.lang';

/** @type {Record<string, string>} */
let messages = {};

/**
 * Look up a user-facing string. Missing keys return the key itself.
 * Optional `vars` replaces `{name}` placeholders.
 * @param {string} key
 * @param {Record<string, string | number>} [vars]
 * @returns {string}
 */
export function t(key, vars) {
  let value = Object.prototype.hasOwnProperty.call(messages, key) ? messages[key] : key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
  }
  return value;
}

/**
 * @returns {'en' | 'bn'}
 */
function readSaved() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'bn' || value === 'en') return value;
  } catch {
    /* Storage can be blocked; English remains the fallback. */
  }
  return 'en';
}

/**
 * Load a language catalogue, persist the choice, and set `<html lang>`.
 * Called with no argument, restores the saved language or English.
 * @param {'en' | 'bn'} [lang]
 * @returns {Promise<'en' | 'bn'>}
 */
export async function setLang(lang) {
  const next = lang === 'bn' || lang === 'en' ? lang : readSaved();
  const url = new URL(`./${next}.json`, import.meta.url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load language "${next}"`);
  }
  const data = await response.json();
  messages = /** @type {Record<string, string>} */ (data);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* The switch still applies for this visit. */
  }
  document.documentElement.lang = next;
  return next;
}
