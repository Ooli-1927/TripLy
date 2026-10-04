/**
 * Destination record validation (pure; no DOM / fetch / globals).
 */

const TAG_KEYS = Object.freeze([
  'peaceful',
  'adventure',
  'cultural',
  'social',
  'photography',
  'hiking',
  'boating',
  'food',
  'history',
  'beach',
  'wildlife',
  'relaxing',
]);

const PERMIT_VALUES = new Set(['none', 'travel_pass', 'permission_required']);
const POPULARITY_TIERS = new Set(['iconic', 'hidden']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {string[]} errors
 */
function requireNonEmptyString(value, path, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${path} must be a non-empty string`);
  }
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {string[]} errors
 */
function requireLocalizedString(value, path, errors) {
  if (!isObject(value)) {
    errors.push(`${path} must be an object with en and bn strings`);
    return;
  }
  requireNonEmptyString(value.en, `${path}.en`, errors);
  requireNonEmptyString(value.bn, `${path}.bn`, errors);
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {string[]} errors
 * @returns {boolean}
 */
function requireUnitInterval(value, path, errors) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
    errors.push(`${path} must be a number in 0..1`);
    return false;
  }
  return true;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {string[]} errors
 */
function requireMonthList(value, path, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path} must be a non-empty array of months 1..12`);
    return;
  }
  for (let i = 0; i < value.length; i += 1) {
    const month = value[i];
    if (
      typeof month !== 'number' ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      errors.push(`${path}[${i}] must be an integer in 1..12`);
    }
  }
}

/**
 * Validate one destination record against the data schema.
 * @param {unknown} record
 * @returns {string[]} list of error messages (empty if valid)
 */
export function validateDestination(record) {
  const errors = [];

  if (!isObject(record)) {
    return ['record must be an object'];
  }

  requireNonEmptyString(record.id, 'id', errors);
  requireLocalizedString(record.name, 'name', errors);
  requireNonEmptyString(record.division, 'division', errors);
  requireNonEmptyString(record.district, 'district', errors);

  if (typeof record.lat !== 'number' || Number.isNaN(record.lat) || record.lat < -90 || record.lat > 90) {
    errors.push('lat must be a number in -90..90');
  }
  if (typeof record.lng !== 'number' || Number.isNaN(record.lng) || record.lng < -180 || record.lng > 180) {
    errors.push('lng must be a number in -180..180');
  }

  if (!isObject(record.tags)) {
    errors.push('tags must be an object');
  } else {
    for (const key of TAG_KEYS) {
      if (!(key in record.tags)) {
        errors.push(`tags.${key} is required`);
      } else {
        requireUnitInterval(record.tags[key], `tags.${key}`, errors);
      }
    }
    for (const key of Object.keys(record.tags)) {
      if (!TAG_KEYS.includes(key)) {
        errors.push(`tags.${key} is not an allowed tag key`);
      }
    }
  }

  if (typeof record.dailyCost !== 'number' || Number.isNaN(record.dailyCost) || record.dailyCost < 0) {
    errors.push('dailyCost must be a non-negative number');
  }

  if (!isObject(record.costNote)) {
    errors.push('costNote must be an object');
  } else {
    if (typeof record.costNote.low !== 'number' || Number.isNaN(record.costNote.low) || record.costNote.low < 0) {
      errors.push('costNote.low must be a non-negative number');
    }
    if (typeof record.costNote.high !== 'number' || Number.isNaN(record.costNote.high) || record.costNote.high < 0) {
      errors.push('costNote.high must be a non-negative number');
    }
    if (
      typeof record.costNote.low === 'number' &&
      typeof record.costNote.high === 'number' &&
      record.costNote.high < record.costNote.low
    ) {
      errors.push('costNote.high must be >= costNote.low');
    }
    requireNonEmptyString(record.costNote.rationale, 'costNote.rationale', errors);
  }

  if (typeof record.minDays !== 'number' || !Number.isInteger(record.minDays) || record.minDays < 1) {
    errors.push('minDays must be an integer >= 1');
  }

  requireMonthList(record.bestMonths, 'bestMonths', errors);

  if (!isObject(record.access)) {
    errors.push('access must be an object');
  } else {
    requireMonthList(record.access.openMonths, 'access.openMonths', errors);
    requireMonthList(record.access.overnightMonths, 'access.overnightMonths', errors);

    if (!PERMIT_VALUES.has(record.access.permit)) {
      errors.push('access.permit must be none | travel_pass | permission_required');
    }

    const maxStay = record.access.maxStayHours;
    if (
      maxStay !== null &&
      (typeof maxStay !== 'number' || Number.isNaN(maxStay) || maxStay <= 0)
    ) {
      errors.push('access.maxStayHours must be null or a positive number');
    }

    requireLocalizedString(record.access.note, 'access.note', errors);
    requireNonEmptyString(record.access.source, 'access.source', errors);

    const verified = record.access.lastVerified;
    if (verified !== null) {
      if (typeof verified !== 'string' || !ISO_DATE.test(verified)) {
        errors.push('access.lastVerified must be null or YYYY-MM-DD');
      }
    }
    if (record.access.source === 'TODO_SOURCE' && verified !== null) {
      errors.push('access.lastVerified must be null when source is TODO_SOURCE');
    }
  }

  if (!POPULARITY_TIERS.has(record.popularityTier)) {
    errors.push('popularityTier must be iconic | hidden');
  }
  requireUnitInterval(record.popularity, 'popularity', errors);

  if (typeof record.unesco !== 'boolean') {
    errors.push('unesco must be a boolean');
  }

  requireLocalizedString(record.summary, 'summary', errors);
  requireLocalizedString(record.tips, 'tips', errors);

  if (typeof record.tagsReviewed !== 'boolean') {
    errors.push('tagsReviewed must be a boolean');
  }
  if (typeof record.bnReview !== 'boolean') {
    errors.push('bnReview must be a boolean');
  }

  return errors;
}

export { TAG_KEYS };
