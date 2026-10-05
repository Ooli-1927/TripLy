/**
 * @typedef {Record<string, unknown>} AppState
 */

/** @type {AppState} */
let current = {};

/** @type {Set<(state: AppState) => void>} */
const listeners = new Set();

/**
 * Shallow copy of the current state.
 * @returns {AppState}
 */
export function get() {
  return { ...current };
}

/**
 * Merge fields into the store and notify subscribers.
 * @param {AppState} partial
 */
export function set(partial) {
  current = { ...current, ...partial };
  const snapshot = get();
  listeners.forEach((listener) => listener(snapshot));
}

/**
 * Subscribe to state changes. Returns an unsubscribe function.
 * @param {(state: AppState) => void} listener
 * @returns {() => void}
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
