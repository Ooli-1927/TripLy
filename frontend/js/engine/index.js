import { applyConstraints } from './constraints.js';
import { scoreDestination } from './scoring.js';
import { collectWarnings, normalizeWeights } from './estimates.js';
import { CONFIG } from './config.js';

export { CONFIG } from './config.js';
export { applyConstraints } from './constraints.js';
export { scoreDestination } from './scoring.js';
export { estimateTrip, normalizeWeights, collectWarnings } from './estimates.js';
export { explainMatch, explainWhyNot, rankStability } from './explain.js';

/**
 * @typedef {import('./estimates.js').Situation} Situation
 */

/**
 * Rank destinations for a travel situation.
 * Deterministic: never reads the current date; month comes only from `situation`.
 * @param {Situation} situation
 * @param {Array<object>} destinations
 * @param {Partial<typeof CONFIG.defaultWeights>} [weights]
 * @returns {{
 *   ranked: Array<{
 *     id: string,
 *     total: number,
 *     factors: { tag: number, budget: number, time: number, season: number, offbeat: number },
 *     contributions: { tag: number, budget: number, time: number, season: number, offbeat: number },
 *     warnings: Array<{ code: string, values: Record<string, number> }>,
 *   }>,
 *   rejected: Array<{ id: string, reasons: Array<{ code: string, values: Record<string, number> }> }>,
 * }}
 */
export function recommend(situation, destinations, weights) {
  const normalized = normalizeWeights(weights);
  const { passed, rejected } = applyConstraints(situation, destinations);

  const ranked = passed
    .map((dest) => {
      const scored = scoreDestination(situation, dest, normalized);
      return {
        id: dest.id,
        total: scored.total,
        factors: scored.factors,
        contributions: scored.contributions,
        warnings: collectWarnings(dest),
      };
    })
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });

  return { ranked, rejected };
}
