import { CONFIG } from './config.js';
import { estimateTrip, normalizeWeights } from './estimates.js';

/**
 * @typedef {import('./estimates.js').Situation} Situation
 */

/**
 * Score one destination against a situation.
 * @param {Situation} situation
 * @param {object} dest
 * @param {Partial<typeof CONFIG.defaultWeights>} [weights]
 * @returns {{
 *   total: number,
 *   factors: { tag: number, budget: number, time: number, season: number, offbeat: number },
 *   contributions: { tag: number, budget: number, time: number, season: number, offbeat: number },
 * }}
 */
export function scoreDestination(situation, dest, weights) {
  const w = normalizeWeights(weights);
  const estimates = estimateTrip(situation, dest);

  const factors = {
    tag: tagFactor(situation, dest),
    budget: budgetFactor(estimates.estCost, situation.budget),
    time: timeFactor(estimates.oneWayHours, estimates.hoursLimit),
    season: seasonFactor(situation.month, dest.bestMonths ?? []),
    offbeat: offbeatFactor(situation.offbeat, dest.popularity ?? 0),
  };

  const contributions = {
    tag: w.tag * factors.tag * 100,
    budget: w.budget * factors.budget * 100,
    time: w.time * factors.time * 100,
    season: w.season * factors.season * 100,
    offbeat: w.offbeat * factors.offbeat * 100,
  };

  const total =
    contributions.tag +
    contributions.budget +
    contributions.time +
    contributions.season +
    contributions.offbeat;

  return { total, factors, contributions };
}

/**
 * @param {Situation} situation
 * @param {{ tags?: Record<string, number> }} dest
 * @returns {number}
 */
function tagFactor(situation, dest) {
  /** @type {Record<string, number>} */
  const userVec = { [situation.mood]: 1 };
  for (const activity of situation.activities ?? []) {
    userVec[activity] = 1;
  }
  return cosineSimilarity(userVec, dest.tags ?? {});
}

/**
 * Cosine similarity over the union of keys.
 * @param {Record<string, number>} a
 * @param {Record<string, number>} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const key of keys) {
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * @param {number} estCost
 * @param {number} budget
 * @returns {number}
 */
function budgetFactor(estCost, budget) {
  const fullAt = budget * CONFIG.budgetComfortRatio;
  const zeroAt = budget * CONFIG.budgetTolerance;
  return linearFalloff(estCost, fullAt, zeroAt);
}

/**
 * @param {number} oneWayHours
 * @param {number} hoursLimit
 * @returns {number}
 */
function timeFactor(oneWayHours, hoursLimit) {
  const fullAt = hoursLimit * CONFIG.timeComfortRatio;
  return linearFalloff(oneWayHours, fullAt, hoursLimit);
}

/**
 * @param {number} value
 * @param {number} fullAt
 * @param {number} zeroAt
 * @returns {number}
 */
function linearFalloff(value, fullAt, zeroAt) {
  if (value <= fullAt) return 1;
  if (value >= zeroAt) return 0;
  return (zeroAt - value) / (zeroAt - fullAt);
}

/**
 * Month adjacency wraps: December ↔ January.
 * @param {number} month
 * @param {number[]} bestMonths
 * @returns {number}
 */
function seasonFactor(month, bestMonths) {
  if (bestMonths.includes(month)) return 1;
  if (isAdjacentToBest(month, bestMonths)) return 0.5;
  return 0.2;
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
 * @param {number} offbeat
 * @param {number} popularity
 * @returns {number}
 */
function offbeatFactor(offbeat, popularity) {
  return offbeat * (1 - popularity) + (1 - offbeat) * popularity;
}
