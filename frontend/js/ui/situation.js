/** Budget bounds for the situation form (BDT per person, total trip). */
export const BUDGET_MIN = 2000;
export const BUDGET_MAX = 80000;
export const BUDGET_STEP = 500;
export const BUDGET_DEFAULT = 12000;

export const MOODS = Object.freeze(['peaceful', 'adventure', 'cultural', 'social']);
export const ACTIVITIES = Object.freeze([
  'photography',
  'hiking',
  'boating',
  'food',
  'history',
  'beach',
  'wildlife',
  'relaxing',
]);
export const ORIGINS = Object.freeze([
  'dhaka',
  'chattogram',
  'sylhet',
  'rajshahi',
  'khulna',
]);

/**
 * Default travel situation. Month uses Date only in the UI layer.
 * @returns {import('../engine/estimates.js').Situation}
 */
export function defaultSituation() {
  return {
    mood: 'peaceful',
    budget: BUDGET_DEFAULT,
    days: 2,
    origin: 'dhaka',
    month: new Date().getMonth() + 1,
    activities: [],
    offbeat: 0.5,
  };
}

/**
 * Validate a situation for the form. Returns a map of field → i18n key (with optional vars).
 * @param {import('../engine/estimates.js').Situation} situation
 * @returns {Record<string, { key: string, vars?: Record<string, string | number> }>}
 */
export function validateSituation(situation) {
  /** @type {Record<string, { key: string, vars?: Record<string, string | number> }>} */
  const errors = {};

  if (!MOODS.includes(situation.mood)) {
    errors.mood = { key: 'error.mood' };
  }

  if (
    typeof situation.budget !== 'number' ||
    Number.isNaN(situation.budget) ||
    situation.budget < BUDGET_MIN ||
    situation.budget > BUDGET_MAX
  ) {
    errors.budget = {
      key: 'error.budget',
      vars: { min: BUDGET_MIN, max: BUDGET_MAX },
    };
  }

  if (
    typeof situation.days !== 'number' ||
    !Number.isInteger(situation.days) ||
    situation.days < 1 ||
    situation.days > 5
  ) {
    errors.days = { key: 'error.days' };
  }

  if (!ORIGINS.includes(situation.origin)) {
    errors.origin = { key: 'error.origin' };
  }

  if (
    typeof situation.month !== 'number' ||
    !Number.isInteger(situation.month) ||
    situation.month < 1 ||
    situation.month > 12
  ) {
    errors.month = { key: 'error.month' };
  }

  return errors;
}
