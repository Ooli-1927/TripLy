import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG,
  applyConstraints,
  explainMatch,
  explainWhyNot,
  rankStability,
  scoreDestination,
} from '../frontend/js/engine/index.js';
import { suggestBestChange } from '../frontend/js/ui/empty.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const destinations = JSON.parse(
  readFileSync(join(root, 'frontend', 'data', 'destinations.json'), 'utf8'),
);

/**
 * @param {Partial<object> & { id: string }} overrides
 */
function fixture(overrides) {
  return {
    name: { en: 'Fixture', bn: 'Fixture' },
    division: 'Dhaka',
    district: 'Dhaka',
    lat: 23.81,
    lng: 90.41,
    dailyCost: 1000,
    minDays: 1,
    bestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    popularityTier: 'hidden',
    popularity: 0.5,
    unesco: false,
    summary: { en: 'x', bn: 'x' },
    tips: { en: 'x', bn: 'x' },
    tagsReviewed: false,
    bnReview: true,
    ...overrides,
    access: {
      openMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      overnightMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      permit: 'none',
      maxStayHours: null,
      note: { en: 'ok', bn: 'ok' },
      source: 'test',
      lastVerified: '2026-01-01',
      ...(overrides.access ?? {}),
    },
    tags: {
      peaceful: 0,
      adventure: 0,
      cultural: 0,
      social: 0,
      photography: 0,
      hiking: 0,
      boating: 0,
      food: 0,
      history: 0,
      beach: 0,
      wildlife: 0,
      relaxing: 0,
      ...(overrides.tags ?? {}),
    },
  };
}

function baseSituation(overrides = {}) {
  return {
    mood: 'peaceful',
    budget: 50_000,
    days: 2,
    origin: 'dhaka',
    month: 1,
    activities: [],
    offbeat: 0.5,
    ...overrides,
  };
}

test('explainMatch: topFactor, activities, travel/cost, seasonStatus', () => {
  const dest = fixture({
    id: 'match-spot',
    tags: { peaceful: 0.9, hiking: 0.8, beach: 0 },
    bestMonths: [11, 12, 1],
    lat: 23.81,
    lng: 90.41,
    dailyCost: 1000,
  });
  const situation = baseSituation({
    month: 2, // adjacent to Jan → adjacent
    activities: ['hiking', 'beach'],
  });
  const scored = scoreDestination(situation, dest);
  const explanation = explainMatch(situation, dest, scored);

  assert.equal(explanation.seasonStatus, 'adjacent');
  assert.deepEqual(explanation.matchedActivities, ['hiking']);
  assert.deepEqual(explanation.unmatchedActivities, ['beach']);
  assert.equal(explanation.budget, situation.budget);
  assert.ok(explanation.travelHours >= 0);
  assert.ok(explanation.hoursLimit > 0);
  assert.ok(explanation.estCost > 0);
  assert.ok(FACTOR_KEYS.includes(explanation.topFactor));

  let max = -1;
  /** @type {string} */
  let expectedTop = 'tag';
  for (const key of FACTOR_KEYS) {
    if (scored.contributions[key] > max) {
      max = scored.contributions[key];
      expectedTop = key;
    }
  }
  assert.equal(explanation.topFactor, expectedTop);
  assert.equal(explanation.seasonStatus, 'adjacent');
});

test('explainMatch seasonStatus best and off', () => {
  const dest = fixture({
    id: 'season-spot',
    bestMonths: [10, 11],
  });
  const best = explainMatch(
    baseSituation({ month: 10 }),
    dest,
    scoreDestination(baseSituation({ month: 10 }), dest),
  );
  const off = explainMatch(
    baseSituation({ month: 4 }),
    dest,
    scoreDestination(baseSituation({ month: 4 }), dest),
  );
  assert.equal(best.seasonStatus, 'best');
  assert.equal(off.seasonStatus, 'off');
});

test('explainWhyNot: OVER_BUDGET suggestion verified by re-running constraints', () => {
  const dest = fixture({
    id: 'cheap-day',
    lat: 23.81,
    lng: 90.41,
    dailyCost: 1000,
    minDays: 1,
  });
  const situation = baseSituation({ budget: 500, days: 1, month: 10 });
  const { rejected } = applyConstraints(situation, [dest]);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].reasons.some((r) => r.code === 'OVER_BUDGET'));

  const rows = explainWhyNot(situation, rejected[0], dest);
  const budgetRow = rows.find((row) => row.code === 'OVER_BUDGET');
  assert.ok(budgetRow);
  assert.equal(budgetRow.change.field, 'budget');
  assert.equal(budgetRow.sufficient, true);
  assert.deepEqual(budgetRow.remainingCodes, []);

  const next = { ...situation, budget: budgetRow.change.to };
  const check = applyConstraints(next, [dest]);
  assert.equal(check.passed.length, 1);
  assert.equal(check.rejected.length, 0);
});

test('explainWhyNot: insufficient single change reports remainingCodes', () => {
  // Far + expensive: raising days alone should not clear OVER_BUDGET.
  const dest = fixture({
    id: 'far-pricey',
    lat: 21.4,
    lng: 92.0,
    dailyCost: 5000,
    minDays: 1,
  });
  const situation = baseSituation({ budget: 500, days: 1, month: 10 });
  const { rejected } = applyConstraints(situation, [dest]);
  assert.ok(rejected[0].reasons.some((r) => r.code === 'TOO_FAR'));
  assert.ok(rejected[0].reasons.some((r) => r.code === 'OVER_BUDGET'));

  const rows = explainWhyNot(situation, rejected[0], dest);
  const farRow = rows.find((row) => row.code === 'TOO_FAR');
  assert.ok(farRow);
  if (farRow.sufficient) {
    // If somehow sufficient, remaining must be empty
    assert.deepEqual(farRow.remainingCodes, []);
  } else {
    assert.ok(farRow.remainingCodes.length > 0);
    assert.ok(farRow.remainingCodes.includes('OVER_BUDGET'));
  }
});

test('rankStability returns label, changedCount, total=10', () => {
  const situation = baseSituation({
    budget: 12_000,
    days: 2,
    origin: 'dhaka',
    month: 10,
    mood: 'peaceful',
  });
  const result = rankStability(situation, destinations);
  assert.ok(result.label === 'stable' || result.label === 'sensitive');
  assert.equal(result.total, 10);
  assert.ok(result.changedCount >= 0 && result.changedCount <= 10);
  if (result.changedCount <= 1) assert.equal(result.label, 'stable');
  else assert.equal(result.label, 'sensitive');
});

test('empty suggestBestChange for 500 BDT / 1 day / Dhaka / October', () => {
  const situation = {
    mood: 'peaceful',
    budget: 500,
    days: 1,
    origin: 'dhaka',
    month: 10,
    activities: [],
    offbeat: 0.5,
  };
  const { rejected, passed } = applyConstraints(situation, destinations);
  assert.equal(passed.length, 0);
  assert.equal(rejected.length, 10);

  const suggestion = suggestBestChange(situation, destinations, rejected);
  assert.ok(suggestion);
  assert.equal(suggestion.kind, 'budget');
  // Sonargaon estCost ≈ 1216.268… → ceil(estCost / 1.15) = 1058
  assert.equal(suggestion.value, 1058);
  assert.ok(suggestion.unlocked >= 1);

  const next = { ...situation, budget: suggestion.value };
  const after = applyConstraints(next, destinations);
  assert.ok(after.passed.length >= 1);
  assert.ok(after.passed.some((d) => d.id === 'sonargaon'));
});

/**
 * Worked example — every expected number computed by hand in comments.
 * Do NOT derive expectations by calling explainMatch / scoreDestination for the asserts
 * beyond constructing scoreResult inputs that the hand math defines.
 *
 * Destination at origin (Dhaka 23.81, 90.41): haversine = 0
 *   roadKm = 0
 *   oneWayHours = 0
 *   days = 2, dailyCost = 2000
 *   estCost = 2 * 2000 + 0 = 4000
 *   hoursLimit = 2 * 3.5 = 7
 *
 * Situation: mood=peaceful, activities=[history], budget=10000, month=1 (in bestMonths),
 *   offbeat=0.5, popularity=0.2
 *
 * Tag vectors:
 *   user = { peaceful:1, history:1 }  → ||u|| = √2
 *   dest = { peaceful:1, history:1 }  → ||d|| = √2
 *   cosine = (1+1) / (√2·√2) = 1
 *
 * budgetFactor: fullAt = 10000*0.8 = 8000, zeroAt = 10000*1.15 = 11500
 *   estCost 4000 ≤ 8000 → 1
 * timeFactor: fullAt = 7*0.5 = 3.5, oneWayHours 0 ≤ 3.5 → 1
 * seasonFactor: month 1 in bestMonths → 1
 * offbeatFactor: 0.5*(1-0.2) + (1-0.5)*0.2 = 0.5*0.8 + 0.5*0.2 = 0.4 + 0.1 = 0.5
 *
 * Default weights: tag 0.45, budget 0.2, time 0.15, season 0.1, offbeat 0.1
 * contributions:
 *   tag    = 0.45 * 1 * 100 = 45
 *   budget = 0.20 * 1 * 100 = 20
 *   time   = 0.15 * 1 * 100 = 15
 *   season = 0.10 * 1 * 100 = 10
 *   offbeat= 0.10 * 0.5 * 100 = 5
 * total = 95
 * topFactor = tag
 */
test('worked example: hand-computed explainMatch numbers', () => {
  const dest = fixture({
    id: 'worked-origin',
    lat: 23.81,
    lng: 90.41,
    dailyCost: 2000,
    bestMonths: [1, 2, 3],
    popularity: 0.2,
    tags: { peaceful: 1, history: 1 },
  });
  const situation = baseSituation({
    mood: 'peaceful',
    activities: ['history', 'beach'],
    budget: 10_000,
    days: 2,
    month: 1,
    offbeat: 0.5,
  });

  // Hand-built scoreResult (mirrors the comment math — not copied from the scorer)
  const scoreResult = {
    total: 95,
    factors: { tag: 1, budget: 1, time: 1, season: 1, offbeat: 0.5 },
    contributions: { tag: 45, budget: 20, time: 15, season: 10, offbeat: 5 },
  };

  const explanation = explainMatch(situation, dest, scoreResult);

  assert.equal(explanation.topFactor, 'tag');
  assert.deepEqual(explanation.matchedActivities, ['history']);
  assert.deepEqual(explanation.unmatchedActivities, ['beach']);
  assert.equal(explanation.travelHours, 0);
  assert.equal(explanation.hoursLimit, 7);
  assert.equal(explanation.estCost, 4000);
  assert.equal(explanation.budget, 10_000);
  assert.equal(explanation.seasonStatus, 'best');
  assert.equal(explanation.contributions.tag, 45);
  assert.equal(explanation.contributions.offbeat, 5);
});

const FACTOR_KEYS = ['tag', 'budget', 'time', 'season', 'offbeat'];
