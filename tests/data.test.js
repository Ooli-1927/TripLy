import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDestination } from '../js/utils/validate.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const destinations = JSON.parse(
  readFileSync(join(root, 'data', 'destinations.json'), 'utf8'),
);

const EXPECTED_IDS = [
  'coxs-bazar',
  'saint-martin',
  'bandarban',
  'rangamati',
  'sreemangal',
  'jaflong',
  'sonargaon',
  'sundarbans',
  'kuakata',
  'paharpur',
];

test('destinations.json is a non-empty array of 10 seed records', () => {
  assert.ok(Array.isArray(destinations), 'destinations.json must be an array');
  assert.equal(destinations.length, 10);
});

test('every destination record validates', () => {
  for (const record of destinations) {
    const errors = validateDestination(record);
    assert.deepEqual(
      errors,
      [],
      `${record?.id ?? '<missing id>'}: ${errors.join('; ')}`,
    );
  }
});

test('destination ids are unique and match the seed set', () => {
  const ids = destinations.map((d) => d.id);
  assert.deepEqual([...new Set(ids)].sort(), [...ids].sort(), 'ids must be unique');
  assert.deepEqual([...ids].sort(), [...EXPECTED_IDS].sort());
});

test('tag scores and popularity are in 0..1', () => {
  for (const record of destinations) {
    assert.ok(record.popularity >= 0 && record.popularity <= 1, record.id);
    for (const [key, value] of Object.entries(record.tags)) {
      assert.ok(
        value >= 0 && value <= 1,
        `${record.id}.tags.${key}=${value}`,
      );
    }
  }
});

test('month lists only contain integers 1..12', () => {
  for (const record of destinations) {
    for (const field of ['bestMonths', 'openMonths', 'overnightMonths']) {
      const months =
        field === 'bestMonths' ? record.bestMonths : record.access[field];
      for (const month of months) {
        assert.ok(
          Number.isInteger(month) && month >= 1 && month <= 12,
          `${record.id}.${field} has invalid month ${month}`,
        );
      }
    }
  }
});

test('Saint Martin access matches documented seasonal rules', () => {
  const saint = destinations.find((d) => d.id === 'saint-martin');
  assert.ok(saint, 'saint-martin record missing');
  assert.deepEqual([...saint.access.openMonths].sort((a, b) => a - b), [1, 11, 12]);
  assert.deepEqual([...saint.access.overnightMonths].sort((a, b) => a - b), [1, 12]);
  assert.equal(saint.access.permit, 'travel_pass');
  assert.equal(saint.access.maxStayHours, 2);
  assert.equal(saint.access.source, 'bdnews24');
  assert.equal(saint.access.lastVerified, '2026-07-06');
});

test('review flags are present for seed data', () => {
  for (const record of destinations) {
    assert.equal(record.tagsReviewed, false, record.id);
    assert.equal(record.bnReview, true, record.id);
    assert.ok(record.costNote?.low <= record.dailyCost && record.dailyCost <= record.costNote?.high, record.id);
  }
});
