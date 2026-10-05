import { applyConstraints } from './constraints.js';
import { CONFIG } from './config.js';
import { estimateTrip, normalizeWeights } from './estimates.js';
import { scoreDestination } from './scoring.js';

/**
 * @typedef {import('./estimates.js').Situation} Situation
 * @typedef {'tag' | 'budget' | 'time' | 'season' | 'offbeat'} FactorKey
 * @typedef {'best' | 'adjacent' | 'off'} SeasonStatus
 * @typedef {'days' | 'budget' | 'month'} ChangeField
 *
 * @typedef {{
 *   topFactor: FactorKey,
 *   matchedActivities: string[],
 *   unmatchedActivities: string[],
 *   travelHours: number,
 *   hoursLimit: number,
 *   estCost: number,
 *   budget: number,
 *   seasonStatus: SeasonStatus,
 *   factors: Record<FactorKey, number>,
 *   contributions: Record<FactorKey, number>,
 * }} MatchExplanation
 *
 * @typedef {{
 *   code: string,
 *   currentValue: number,
 *   requiredValue: number,
 *   change: { field: ChangeField, to: number },
 *   sufficient: boolean,
 *   remainingCodes: string[],
 * }} WhyNotSuggestion
 */

const FACTOR_KEYS = /** @type {const} */ (['tag', 'budget', 'time', 'season', 'offbeat']);

/**
 * Explain why a destination fits — codes and numbers only, no prose.
 * @param {Situation} situation
 * @param {object} destination
 * @param {{
 *   total: number,
 *   factors: Record<FactorKey, number>,
 *   contributions: Record<FactorKey, number>,
 * }} scoreResult
 * @returns {MatchExplanation}
 */
export function explainMatch(situation, destination, scoreResult) {
  const estimates = estimateTrip(situation, destination);
  const activities = situation.activities ?? [];
  const tags = destination.tags ?? {};

  const matchedActivities = activities.filter((activity) => (tags[activity] ?? 0) > 0);
  const unmatchedActivities = activities.filter((activity) => (tags[activity] ?? 0) <= 0);

  /** @type {FactorKey} */
  let topFactor = 'tag';
  let topContribution = Number.NEGATIVE_INFINITY;
  for (const key of FACTOR_KEYS) {
    const value = scoreResult.contributions[key] ?? 0;
    if (value > topContribution) {
      topContribution = value;
      topFactor = key;
    }
  }

  return {
    topFactor,
    matchedActivities,
    unmatchedActivities,
    travelHours: estimates.oneWayHours,
    hoursLimit: estimates.hoursLimit,
    estCost: estimates.estCost,
    budget: situation.budget,
    seasonStatus: seasonStatus(situation.month, destination.bestMonths ?? []),
    factors: { ...scoreResult.factors },
    contributions: { ...scoreResult.contributions },
  };
}

/**
 * For each failing reason, compute the smallest candidate change and verify it
 * by re-running applyConstraints on the modified situation for this destination.
 * Reports whether that single change is sufficient. Callers must not present
 * `sufficient: false` rows as actionable suggestions.
 *
 * @param {Situation} situation
 * @param {{ id: string, reasons: Array<{ code: string, values: Record<string, number> }> }} rejectedItem
 * @param {object} destination
 * @returns {WhyNotSuggestion[]}
 */
export function explainWhyNot(situation, rejectedItem, destination) {
  /** @type {WhyNotSuggestion[]} */
  const rows = [];

  for (const reason of rejectedItem.reasons ?? []) {
    const candidates = candidateChanges(situation, reason, destination);
    for (const candidate of candidates) {
      const next = applyChange(situation, candidate.change);
      const { passed, rejected } = applyConstraints(next, [destination]);
      const remaining = passed.length > 0 ? [] : (rejected[0]?.reasons ?? []).map((r) => r.code);
      rows.push({
        code: reason.code,
        currentValue: candidate.currentValue,
        requiredValue: candidate.requiredValue,
        change: candidate.change,
        sufficient: passed.length > 0,
        remainingCodes: remaining,
      });
      // One candidate per reason (smallest-first order from candidateChanges)
      break;
    }
  }

  return rows;
}

/**
 * Perturb each of the five weights by −20% and +20% (10 runs), re-normalize, re-rank.
 * Stable when the top-3 id set is identical in at least 9 of 10 runs.
 *
 * @param {Situation} situation
 * @param {object[]} destinations
 * @param {Partial<typeof CONFIG.defaultWeights>} [weights]
 * @returns {{ label: 'stable' | 'sensitive', changedCount: number, total: number }}
 */
export function rankStability(situation, destinations, weights) {
  const baseTop = topIds(rankIds(situation, destinations, weights), 3);
  const baseW = normalizeWeights(weights);
  let changedCount = 0;
  const total = FACTOR_KEYS.length * 2;

  for (const key of FACTOR_KEYS) {
    for (const mult of [0.8, 1.2]) {
      const perturbed = { ...baseW, [key]: baseW[key] * mult };
      const nextTop = topIds(rankIds(situation, destinations, perturbed), 3);
      if (!sameIdSet(baseTop, nextTop)) changedCount += 1;
    }
  }

  const identical = total - changedCount;
  return {
    label: identical >= 9 ? 'stable' : 'sensitive',
    changedCount,
    total,
  };
}

/**
 * Lightweight re-rank used by stability probes (avoids circular import with index.js).
 * @param {Situation} situation
 * @param {object[]} destinations
 * @param {Partial<typeof CONFIG.defaultWeights>} [weights]
 * @returns {Array<{ id: string, total: number }>}
 */
function rankIds(situation, destinations, weights) {
  const normalized = normalizeWeights(weights);
  const { passed } = applyConstraints(situation, destinations);
  return passed
    .map((dest) => {
      const scored = scoreDestination(situation, dest, normalized);
      return { id: dest.id, total: scored.total };
    })
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });
}

/**
 * @param {number} month
 * @param {number[]} bestMonths
 * @returns {SeasonStatus}
 */
function seasonStatus(month, bestMonths) {
  if (bestMonths.includes(month)) return 'best';
  if (isAdjacentToBest(month, bestMonths)) return 'adjacent';
  return 'off';
}

/**
 * @param {number} month
 * @param {number[]} bestMonths
 * @returns {boolean}
 */
function isAdjacentToBest(month, bestMonths) {
  const prev = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;
  return bestMonths.includes(prev) || bestMonths.includes(next);
}

/**
 * @param {Situation} situation
 * @param {{ code: string, values: Record<string, number> }} reason
 * @param {object} destination
 * @returns {Array<{ currentValue: number, requiredValue: number, change: { field: ChangeField, to: number } }>}
 */
function candidateChanges(situation, reason, destination) {
  /** @type {Array<{ currentValue: number, requiredValue: number, change: { field: ChangeField, to: number } }>} */
  const out = [];

  if (reason.code === 'TOO_SHORT') {
    const minDays = reason.values.minDays;
    if (typeof minDays === 'number' && minDays > situation.days && minDays <= 5) {
      out.push({
        currentValue: situation.days,
        requiredValue: minDays,
        change: { field: 'days', to: minDays },
      });
    }
  }

  if (reason.code === 'TOO_FAR') {
    const oneWayHours = reason.values.oneWayHours;
    if (typeof oneWayHours === 'number') {
      const daysNeeded = Math.min(5, Math.ceil(oneWayHours / CONFIG.hoursPerDayLimit));
      if (daysNeeded > situation.days) {
        out.push({
          currentValue: situation.days,
          requiredValue: daysNeeded,
          change: { field: 'days', to: daysNeeded },
        });
      }
    }
  }

  if (reason.code === 'OVER_BUDGET') {
    const estCost = reason.values.estCost;
    if (typeof estCost === 'number') {
      const budgetNeeded = Math.ceil(estCost / CONFIG.budgetTolerance);
      if (budgetNeeded > situation.budget) {
        out.push({
          currentValue: situation.budget,
          requiredValue: budgetNeeded,
          change: { field: 'budget', to: budgetNeeded },
        });
      }
    }
  }

  if (reason.code === 'NO_OVERNIGHT' && situation.days >= 2) {
    out.push({
      currentValue: situation.days,
      requiredValue: 1,
      change: { field: 'days', to: 1 },
    });
    const overnight = destination.access?.overnightMonths ?? [];
    const month = nearestMonth(situation.month, overnight);
    if (month != null) {
      out.push({
        currentValue: situation.month,
        requiredValue: month,
        change: { field: 'month', to: month },
      });
    }
  }

  if (reason.code === 'ACCESS_CLOSED') {
    const openMonths = destination.access?.openMonths ?? [];
    const month = nearestMonth(situation.month, openMonths);
    if (month != null) {
      out.push({
        currentValue: situation.month,
        requiredValue: month,
        change: { field: 'month', to: month },
      });
    }
  }

  return out;
}

/**
 * @param {Situation} situation
 * @param {{ field: ChangeField, to: number }} change
 * @returns {Situation}
 */
function applyChange(situation, change) {
  if (change.field === 'days') return { ...situation, days: change.to };
  if (change.field === 'budget') return { ...situation, budget: change.to };
  return { ...situation, month: change.to };
}

/**
 * Circular month distance; pick the nearest allowed month (ties → smaller month number).
 * @param {number} current
 * @param {number[]} allowed
 * @returns {number | null}
 */
function nearestMonth(current, allowed) {
  if (!Array.isArray(allowed) || allowed.length === 0) return null;
  let best = null;
  let bestDist = Infinity;
  for (const month of allowed) {
    if (month === current) continue;
    const forward = (month - current + 12) % 12;
    const backward = (current - month + 12) % 12;
    const dist = Math.min(forward, backward);
    if (dist < bestDist || (dist === bestDist && month < /** @type {number} */ (best))) {
      bestDist = dist;
      best = month;
    }
  }
  return best;
}

/**
 * @param {Array<{ id: string }>} ranked
 * @param {number} n
 * @returns {string[]}
 */
function topIds(ranked, n) {
  return ranked.slice(0, n).map((item) => item.id);
}

/**
 * @param {string[]} a
 * @param {string[]} b
 * @returns {boolean}
 */
function sameIdSet(a, b) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}
