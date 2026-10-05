import { CONFIG } from './config.js';
import { haversineKm } from '../utils/geo.js';

/**
 * @typedef {'dhaka' | 'chattogram' | 'sylhet' | 'rajshahi' | 'khulna'} OriginId
 * @typedef {{
 *   mood: 'peaceful' | 'adventure' | 'cultural' | 'social',
 *   budget: number,
 *   days: number,
 *   origin: OriginId,
 *   month: number,
 *   activities: string[],
 *   offbeat: number,
 * }} Situation
 */

/**
 * Travel and cost estimates for a situation → destination pair.
 * @param {Situation} situation
 * @param {{ lat: number, lng: number, dailyCost: number }} dest
 * @returns {{ haversineKm: number, roadKm: number, oneWayHours: number, estCost: number, hoursLimit: number }}
 */
export function estimateTrip(situation, dest) {
  const origin = CONFIG.origins[situation.origin];
  if (!origin) {
    throw new Error(`Unknown origin: ${situation.origin}`);
  }

  const straightKm = haversineKm(origin, { lat: dest.lat, lng: dest.lng });
  const roadKm = straightKm * CONFIG.roadFactor;
  const oneWayHours = roadKm / CONFIG.avgSpeedKmh;
  const estCost =
    situation.days * dest.dailyCost + roadKm * 2 * CONFIG.costPerKmBdt;
  const hoursLimit = situation.days * CONFIG.hoursPerDayLimit;

  return {
    haversineKm: straightKm,
    roadKm,
    oneWayHours,
    estCost,
    hoursLimit,
  };
}

/**
 * Re-normalize weight components so they sum to 1.
 * @param {Partial<typeof CONFIG.defaultWeights>} [weights]
 * @returns {{ tag: number, budget: number, time: number, season: number, offbeat: number }}
 */
export function normalizeWeights(weights = {}) {
  const merged = {
    ...CONFIG.defaultWeights,
    ...weights,
  };
  const sum =
    merged.tag + merged.budget + merged.time + merged.season + merged.offbeat;
  if (!(sum > 0)) {
    throw new Error('weights must sum to a positive number');
  }
  return {
    tag: merged.tag / sum,
    budget: merged.budget / sum,
    time: merged.time / sum,
    season: merged.season / sum,
    offbeat: merged.offbeat / sum,
  };
}

/**
 * Collect non-blocking warning codes for a destination.
 * @param {{ access: { permit: string, maxStayHours: number | null, note?: { en?: string, bn?: string }, source?: string } }} dest
 * @returns {Array<{ code: string, values: Record<string, number> }>}
 */
export function collectWarnings(dest) {
  /** @type {Array<{ code: string, values: Record<string, number> }>} */
  const warnings = [];
  const access = dest.access ?? {};

  if (access.permit === 'travel_pass' || access.permit === 'permission_required') {
    warnings.push({
      code: 'PERMIT_REQUIRED',
      values: { permit: CONFIG.permitCode[access.permit] },
    });
  }

  if (access.maxStayHours != null) {
    warnings.push({
      code: 'MAX_STAY_LIMIT',
      values: { hours: access.maxStayHours },
    });
  }

  const noteText = `${access.note?.en ?? ''} ${access.note?.bn ?? ''}`;
  const todoVerify = noteText.includes('TODO_VERIFY') ? 1 : 0;
  const todoSource = access.source === 'TODO_SOURCE' ? 1 : 0;
  if (todoVerify || todoSource) {
    warnings.push({
      code: 'UNVERIFIED_DATA',
      values: { todoVerify, todoSource },
    });
  }

  return warnings;
}
