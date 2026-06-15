// pipeline/guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanAnonymization, passesGates } from './guard.mjs';

test('scanAnonymization flags an ID number', () => {
  const r = scanAnonymization('當事人 A123456789 提告');
  assert.equal(r.ok, false);
  assert.ok(r.hits.some((h) => h.kind === 'national_id'));
});

test('scanAnonymization flags a company tax id (統一編號)', () => {
  const r = scanAnonymization('某公司統一編號 12345678');
  assert.equal(r.ok, false);
  assert.ok(r.hits.some((h) => h.kind === 'tax_id'));
});

test('scanAnonymization passes clean anonymized text', () => {
  const r = scanAnonymization('陳小姐與先生協議分產，最後對簿公堂。');
  assert.equal(r.ok, true);
  assert.equal(r.hits.length, 0);
});

test('passesGates requires scores and clean scan', () => {
  const clean = { ok: true, hits: [] };
  assert.equal(passesGates({ relevance_score: 5, quality_score: 4, anonymization_ok: true }, clean), true);
  assert.equal(passesGates({ relevance_score: 2, quality_score: 5, anonymization_ok: true }, clean), false);
  assert.equal(passesGates({ relevance_score: 5, quality_score: 5, anonymization_ok: true }, { ok: false, hits: [{ kind: 'national_id' }] }), false);
  assert.equal(passesGates({ relevance_score: 5, quality_score: 5, anonymization_ok: false }, clean), false);
});
