import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm } from '../js/utils/geo.js';
import {
  CONFIG,
  applyConstraints,
  collectWarnings,
  estimateTrip,
  normalizeWeights,
  recommend,
  scoreDestination,
} from '../js/engine/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const destinations = JSON.parse(
  readFileSync(join(root, 'data', 'destinations.json'), 'utf8'),
);

/**
 * Minimal destination for isolated constraint / scoring tests.
 * @param {Partial<object> & { id: string }} overrides
 */
function fixture(overrides) {
  return {
    name: { en: 'Fixture', bn: 'Fixture' },
    division: 'Dhaka',
    district: 'Dhaka',
    lat: 23.81,
    lng: 90.41,
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
    },
    dailyCost: 1000,
    minDays: 1,
    bestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    access: {
      openMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      overnightMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      permit: 'none',
      maxStayHours: null,
      note: { en: 'ok', bn: 'ok' },
      source: 'test',
      lastVerified: '2026-01-01',
    },
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

test('haversineKm: 1° of meridian equals R * π/180', () => {
  // R=6371; Δφ=1° on a meridian → d = 6371 * π/180
  const expected = 6371 * (Math.PI / 180);
  const got = haversineKm({ lat: 23.81, lng: 90.41 }, { lat: 24.81, lng: 90.41 });
  assert.ok(Math.abs(got - expected) < 1e-9);
});

test('ACCESS_CLOSED when month is outside openMonths', () => {
  const dest = fixture({
    id: 'closed-spot',
    access: { openMonths: [11, 12, 1] },
  });
  const { rejected, passed } = applyConstraints(baseSituation({ month: 6 }), [dest]);
  assert.equal(passed.length, 0);
  assert.equal(rejected[0].reasons[0].code, 'ACCESS_CLOSED');
  assert.equal(rejected[0].reasons[0].values.month, 6);
});

test('NO_OVERNIGHT when days >= 2 and month not in overnightMonths', () => {
  const dest = fixture({
    id: 'day-only',
    access: {
      openMonths: [11],
      overnightMonths: [12, 1],
    },
  });
  const { rejected } = applyConstraints(
    baseSituation({ month: 11, days: 2 }),
    [dest],
  );
  assert.ok(rejected[0].reasons.some((r) => r.code === 'NO_OVERNIGHT'));
  const reason = rejected[0].reasons.find((r) => r.code === 'NO_OVERNIGHT');
  assert.deepEqual(reason.values, { days: 2, month: 11 });
});

test('TOO_FAR when oneWayHours exceeds days * hoursPerDayLimit', () => {
  // Far point from Dhaka so 1-day limit (3.5h) is breached.
  const dest = fixture({ id: 'far', lat: 20.0, lng: 92.5, minDays: 1 });
  const situation = baseSituation({ days: 1, month: 1 });
  const est = estimateTrip(situation, dest);
  assert.ok(est.oneWayHours > est.hoursLimit);
  const { rejected } = applyConstraints(situation, [dest]);
  assert.ok(rejected[0].reasons.some((r) => r.code === 'TOO_FAR'));
  const reason = rejected[0].reasons.find((r) => r.code === 'TOO_FAR');
  assert.equal(reason.values.oneWayHours, est.oneWayHours);
  assert.equal(reason.values.hoursLimit, est.hoursLimit);
});

test('OVER_BUDGET when estCost > budget * budgetTolerance', () => {
  const dest = fixture({ id: 'pricey', dailyCost: 5000, minDays: 1 });
  const situation = baseSituation({ days: 3, budget: 1000 });
  const est = estimateTrip(situation, dest);
  const budgetLimit = situation.budget * CONFIG.budgetTolerance;
  assert.ok(est.estCost > budgetLimit);
  const { rejected } = applyConstraints(situation, [dest]);
  assert.ok(rejected[0].reasons.some((r) => r.code === 'OVER_BUDGET'));
  const reason = rejected[0].reasons.find((r) => r.code === 'OVER_BUDGET');
  assert.equal(reason.values.estCost, est.estCost);
  assert.equal(reason.values.budgetLimit, budgetLimit);
});

test('TOO_SHORT when days < minDays', () => {
  const dest = fixture({ id: 'long-trip', minDays: 3 });
  const { rejected } = applyConstraints(baseSituation({ days: 2 }), [dest]);
  assert.ok(rejected[0].reasons.some((r) => r.code === 'TOO_SHORT'));
  assert.deepEqual(
    rejected[0].reasons.find((r) => r.code === 'TOO_SHORT').values,
    { days: 2, minDays: 3 },
  );
});

test('Saint Martin is ACCESS_CLOSED in October', () => {
  const saint = destinations.find((d) => d.id === 'saint-martin');
  const { rejected, passed } = applyConstraints(
    baseSituation({ month: 10, days: 1, budget: 100_000 }),
    [saint],
  );
  assert.equal(passed.length, 0);
  assert.ok(rejected[0].reasons.some((r) => r.code === 'ACCESS_CLOSED'));
  assert.equal(
    rejected[0].reasons.find((r) => r.code === 'ACCESS_CLOSED').values.month,
    10,
  );
});

test('Dhaka to Rangamati is rejected for a 1-day trip', () => {
  const rangamati = destinations.find((d) => d.id === 'rangamati');
  const situation = baseSituation({ days: 1, origin: 'dhaka', budget: 100_000 });
  const est = estimateTrip(situation, rangamati);
  // oneWayHours ≈ 6.81 > 3.5; minDays is 2
  assert.ok(est.oneWayHours > situation.days * CONFIG.hoursPerDayLimit);
  assert.ok(situation.days < rangamati.minDays);

  const { rejected, passed } = applyConstraints(situation, [rangamati]);
  assert.equal(passed.length, 0);
  const codes = rejected[0].reasons.map((r) => r.code).sort();
  assert.deepEqual(codes, ['TOO_FAR', 'TOO_SHORT']);
});

test('permit and unverified markers become warnings, not rejections', () => {
  const dest = fixture({
    id: 'permit-spot',
    access: {
      permit: 'travel_pass',
      maxStayHours: 2,
      note: { en: 'TODO_VERIFY something', bn: 'x' },
      source: 'TODO_SOURCE',
    },
  });
  const { passed, rejected } = applyConstraints(baseSituation(), [dest]);
  assert.equal(rejected.length, 0);
  assert.equal(passed.length, 1);

  const warnings = collectWarnings(dest);
  assert.deepEqual(
    warnings.map((w) => w.code).sort(),
    ['MAX_STAY_LIMIT', 'PERMIT_REQUIRED', 'UNVERIFIED_DATA'],
  );
  assert.equal(
    warnings.find((w) => w.code === 'PERMIT_REQUIRED').values.permit,
    CONFIG.permitCode.travel_pass,
  );
  assert.equal(warnings.find((w) => w.code === 'MAX_STAY_LIMIT').values.hours, 2);
  assert.deepEqual(
    warnings.find((w) => w.code === 'UNVERIFIED_DATA').values,
    { todoVerify: 1, todoSource: 1 },
  );
});

test('scoreDestination total stays within 0..100', () => {
  const dest = fixture({
    id: 'scored',
    lat: 24.0,
    lng: 90.5,
    tags: { peaceful: 1, hiking: 1 },
    popularity: 0.9,
  });
  const scored = scoreDestination(
    baseSituation({ mood: 'peaceful', activities: ['hiking'], offbeat: 1 }),
    dest,
  );
  assert.ok(scored.total >= 0 && scored.total <= 100);
  for (const value of Object.values(scored.factors)) {
    assert.ok(value >= 0 && value <= 1);
  }
});

test('normalizeWeights re-normalizes arbitrary positive weights to sum 1', () => {
  const w = normalizeWeights({
    tag: 9,
    budget: 3,
    time: 3,
    season: 3,
    offbeat: 2,
  });
  const sum = w.tag + w.budget + w.time + w.season + w.offbeat;
  assert.ok(Math.abs(sum - 1) < 1e-12);
  assert.equal(w.tag, 9 / 20);
  assert.equal(w.budget, 3 / 20);
});

test('season adjacency wraps December ↔ January', () => {
  const nearJan = fixture({
    id: 'wrap-a',
    bestMonths: [1],
    tags: { peaceful: 1 },
  });
  const nearDec = fixture({
    id: 'wrap-b',
    bestMonths: [12],
    tags: { peaceful: 1 },
  });
  const dec = scoreDestination(baseSituation({ month: 12 }), nearJan);
  const jan = scoreDestination(baseSituation({ month: 1 }), nearDec);
  assert.equal(dec.factors.season, 0.5);
  assert.equal(jan.factors.season, 0.5);
});

test('recommend is deterministic and breaks ties by id', () => {
  const a = fixture({ id: 'alpha', tags: { peaceful: 1 }, popularity: 0.5 });
  const b = fixture({ id: 'beta', tags: { peaceful: 1 }, popularity: 0.5 });
  const situation = baseSituation({ activities: [] });
  const first = recommend(situation, [b, a]);
  const second = recommend(situation, [b, a]);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.ranked.map((r) => r.id),
    ['alpha', 'beta'],
  );
});

test('recommend attaches warnings on ranked Saint Martin (open month)', () => {
  const saint = destinations.find((d) => d.id === 'saint-martin');
  // days=2 in December: overnight allowed; 2*3.5h covers Chattogram→island travel time.
  const result = recommend(
    baseSituation({
      month: 12,
      days: 2,
      origin: 'chattogram',
      budget: 100_000,
    }),
    [saint],
  );
  assert.equal(result.ranked.length, 1);
  const codes = result.ranked[0].warnings.map((w) => w.code).sort();
  assert.ok(codes.includes('PERMIT_REQUIRED'));
  assert.ok(codes.includes('MAX_STAY_LIMIT'));
});

/*
 * Worked example (all numbers computed by hand; not taken from scoreDestination).
 *
 * Situation:
 *   mood=peaceful, activities=[hiking], budget=5000, days=2,
 *   origin=dhaka (23.81, 90.41), month=1, offbeat=0.2
 *
 * Destination "worked":
 *   lat=24.81, lng=90.41 (exactly 1° due north of Dhaka),
 *   dailyCost=1000, popularity=0.4, bestMonths=[12,1,2],
 *   tags: peaceful=1, hiking=0.5, all other tag keys = 0
 *
 * --- Haversine ---
 * Δφ = 1° = π/180 rad, Δλ = 0 (same longitude).
 * On a meridian, haversine reduces to d = R * |Δφ|
 *   R = 6371
 *   π/180 = 0.017453292519943295
 *   haversineKm = 6371 * π/180 = 111.19492664455873
 *
 * --- Road / time / cost (CONFIG: roadFactor=1.35, speed=45, costPerKm=3) ---
 *   roadKm      = 111.19492664455873 * 1.35 = 150.1131509701543
 *   oneWayHours = 150.1131509701543 / 45     = 3.335847799336762
 *   hoursLimit  = 2 * 3.5                    = 7
 *   estCost     = days*dailyCost + (roadKm*2)*3
 *               = 2000 + 150.1131509701543 * 6
 *               = 2000 + 900.6789058209258
 *               = 2900.678905820926
 *
 * --- Factors ---
 * tag (cosine over union of keys):
 *   u = {peaceful:1, hiking:1},  |u| = √2 = 1.4142135623730951
 *   v = {peaceful:1, hiking:0.5}, |v| = √1.25 = 1.118033988749895
 *   dot = 1*1 + 1*0.5 = 1.5
 *   |u||v| = 1.5811388300841898
 *   tag = 1.5 / 1.5811388300841898 = 0.9486832980505138
 *
 * budget: estCost 2900.678... <= 0.8*5000=4000 → 1
 * time:   oneWayHours 3.335... <= 0.5*7=3.5     → 1
 * season: month 1 ∈ bestMonths                 → 1
 * offbeat: 0.2*(1-0.4) + (1-0.2)*0.4
 *        = 0.2*0.6 + 0.8*0.4 = 0.12 + 0.32     = 0.44
 *
 * --- Default weights (already sum to 1) ---
 *   tag 0.45, budget 0.20, time 0.15, season 0.10, offbeat 0.10
 *
 * contributions (weight * factor * 100):
 *   tag     = 0.45 * 0.9486832980505138 * 100 = 42.69074841227312
 *   budget  = 0.20 * 1 * 100                  = 20
 *   time    = 0.15 * 1 * 100                  = 15
 *   season  = 0.10 * 1 * 100                  = 10
 *   offbeat = 0.10 * 0.44 * 100               = 4.4
 *
 * total = 42.69074841227312 + 20 + 15 + 10 + 4.4 = 92.09074841227312
 */
test('worked example matches hand-computed score', () => {
  const dest = fixture({
    id: 'worked',
    lat: 24.81,
    lng: 90.41,
    dailyCost: 1000,
    popularity: 0.4,
    bestMonths: [12, 1, 2],
    tags: { peaceful: 1, hiking: 0.5 },
  });
  const situation = baseSituation({
    mood: 'peaceful',
    activities: ['hiking'],
    budget: 5000,
    days: 2,
    origin: 'dhaka',
    month: 1,
    offbeat: 0.2,
  });

  const est = estimateTrip(situation, dest);
  assert.ok(Math.abs(est.haversineKm - 111.19492664455873) < 1e-9);
  assert.ok(Math.abs(est.roadKm - 150.1131509701543) < 1e-9);
  assert.ok(Math.abs(est.oneWayHours - 3.335847799336762) < 1e-9);
  assert.ok(Math.abs(est.estCost - 2900.678905820926) < 1e-9);

  const scored = scoreDestination(situation, dest);
  assert.ok(Math.abs(scored.factors.tag - 0.9486832980505138) < 1e-12);
  assert.equal(scored.factors.budget, 1);
  assert.equal(scored.factors.time, 1);
  assert.equal(scored.factors.season, 1);
  assert.ok(Math.abs(scored.factors.offbeat - 0.44) < 1e-12);
  assert.ok(Math.abs(scored.contributions.tag - 42.69074841227312) < 1e-10);
  assert.equal(scored.contributions.budget, 20);
  assert.equal(scored.contributions.time, 15);
  assert.equal(scored.contributions.season, 10);
  assert.ok(Math.abs(scored.contributions.offbeat - 4.4) < 1e-12);
  assert.ok(Math.abs(scored.total - 92.09074841227312) < 1e-10);
});
