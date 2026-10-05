import { CONFIG } from './config.js';
import { estimateTrip } from './estimates.js';

/**
 * @typedef {import('./estimates.js').Situation} Situation
 */

/**
 * Apply hard constraints. Does not reject on permit or unverified markers.
 * @param {Situation} situation
 * @param {Array<object>} destinations
 * @returns {{
 *   passed: object[],
 *   rejected: Array<{ id: string, reasons: Array<{ code: string, values: Record<string, number> }> }>
 * }}
 */
export function applyConstraints(situation, destinations) {
  /** @type {object[]} */
  const passed = [];
  /** @type {Array<{ id: string, reasons: Array<{ code: string, values: Record<string, number> }> }>} */
  const rejected = [];

  if (!Array.isArray(destinations)) {
    return { passed, rejected };
  }

  for (const dest of destinations) {
    const reasons = evaluateReasons(situation, dest);
    if (reasons.length > 0) {
      rejected.push({ id: dest.id, reasons });
    } else {
      passed.push(dest);
    }
  }

  return { passed, rejected };
}

/**
 * @param {Situation} situation
 * @param {object} dest
 * @returns {Array<{ code: string, values: Record<string, number> }>}
 */
function evaluateReasons(situation, dest) {
  /** @type {Array<{ code: string, values: Record<string, number> }>} */
  const reasons = [];
  const month = situation.month;
  const days = situation.days;
  const openMonths = dest.access?.openMonths ?? [];
  const overnightMonths = dest.access?.overnightMonths ?? [];

  if (!openMonths.includes(month)) {
    reasons.push({
      code: 'ACCESS_CLOSED',
      values: { month },
    });
  }

  if (days >= 2 && !overnightMonths.includes(month)) {
    reasons.push({
      code: 'NO_OVERNIGHT',
      values: { days, month },
    });
  }

  if (typeof dest.minDays === 'number' && days < dest.minDays) {
    reasons.push({
      code: 'TOO_SHORT',
      values: { days, minDays: dest.minDays },
    });
  }

  const estimates = estimateTrip(situation, dest);

  if (estimates.oneWayHours > estimates.hoursLimit) {
    reasons.push({
      code: 'TOO_FAR',
      values: {
        oneWayHours: estimates.oneWayHours,
        hoursLimit: estimates.hoursLimit,
      },
    });
  }

  const budgetLimit = situation.budget * CONFIG.budgetTolerance;
  if (estimates.estCost > budgetLimit) {
    reasons.push({
      code: 'OVER_BUDGET',
      values: {
        estCost: estimates.estCost,
        budgetLimit,
      },
    });
  }

  return reasons;
}
