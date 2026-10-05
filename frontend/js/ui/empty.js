import { applyConstraints, CONFIG, explainWhyNot } from '../engine/index.js';

/**
 * @typedef {import('../engine/estimates.js').Situation} Situation
 */

/**
 * Rank constraint codes by how many destinations they removed.
 * @param {Array<{ id: string, reasons: Array<{ code: string, values: Record<string, number> }> }>} rejected
 * @returns {Array<{ code: string, count: number }>}
 */
export function countConstraintCodes(rejected) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const item of rejected) {
    for (const reason of item.reasons) {
      counts[reason.code] = (counts[reason.code] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

/**
 * Most effective single change: uses explainWhyNot, keeps only verified sufficient
 * changes, and re-checks that the tweak unlocks at least one destination overall.
 *
 * @param {Situation} situation
 * @param {object[]} destinations
 * @param {Array<{ id: string, reasons: Array<{ code: string, values: Record<string, number> }> }>} rejected
 * @returns {{ kind: 'days' | 'budget' | 'month', value: number, unlocked: number } | null}
 */
export function suggestBestChange(situation, destinations, rejected) {
  const byId = new Map(destinations.map((dest) => [dest.id, dest]));
  /** @type {Map<string, { kind: 'days' | 'budget' | 'month', value: number, next: Situation }>} */
  const candidates = new Map();

  for (const item of rejected) {
    const dest = byId.get(item.id);
    if (!dest) continue;
    const rows = explainWhyNot(situation, item, dest);
    for (const row of rows) {
      if (!row.sufficient) continue;
      const key = `${row.change.field}:${row.change.to}`;
      if (candidates.has(key)) continue;
      candidates.set(key, {
        kind: row.change.field,
        value: row.change.to,
        next: applyField(situation, row.change.field, row.change.to),
      });
    }
  }

  // Also consider budget/day/month candidates that unlock globally even if per-dest
  // explainWhyNot skipped (e.g. multi-reason destinations needing a different order).
  for (const extra of legacyCandidates(situation, rejected)) {
    const key = `${extra.kind}:${extra.value}`;
    if (!candidates.has(key)) candidates.set(key, extra);
  }

  let best = null;
  let bestUnlocked = 0;
  for (const candidate of candidates.values()) {
    const { passed } = applyConstraints(candidate.next, destinations);
    if (passed.length > bestUnlocked) {
      bestUnlocked = passed.length;
      best = {
        kind: candidate.kind,
        value: candidate.value,
        unlocked: passed.length,
      };
    }
  }

  return bestUnlocked > 0 ? best : null;
}

/**
 * @param {Situation} situation
 * @param {'days' | 'budget' | 'month'} field
 * @param {number} value
 * @returns {Situation}
 */
function applyField(situation, field, value) {
  if (field === 'days') return { ...situation, days: value };
  if (field === 'budget') return { ...situation, budget: value };
  return { ...situation, month: value };
}

/**
 * Fallback candidate generation from aggregate reason values (still verified above).
 * @param {Situation} situation
 * @param {Array<{ id: string, reasons: Array<{ code: string, values: Record<string, number> }> }>} rejected
 */
function legacyCandidates(situation, rejected) {
  /** @type {Array<{ kind: 'days' | 'budget' | 'month', value: number, next: Situation }>} */
  const candidates = [];

  const overCosts = rejected.flatMap((item) =>
    item.reasons
      .filter((reason) => reason.code === 'OVER_BUDGET')
      .map((reason) => reason.values.estCost),
  );
  if (overCosts.length > 0) {
    const budgetNeeded = Math.ceil(Math.min(...overCosts) / CONFIG.budgetTolerance);
    if (budgetNeeded > situation.budget) {
      candidates.push({
        kind: 'budget',
        value: budgetNeeded,
        next: { ...situation, budget: budgetNeeded },
      });
    }
  }

  return candidates;
}
