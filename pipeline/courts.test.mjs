// pipeline/courts.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCourtName } from './courts.mjs';

test('extracts a district court name from the opening line', () => {
  assert.equal(extractCourtName('臺灣臺中地方法院民事判決\n113年度訴字第1號'), '臺灣臺中地方法院');
});

test('extracts the supreme administrative court', () => {
  assert.equal(extractCourtName('最高行政法院判決\n113年度上字第99號'), '最高行政法院');
});

test('captures a high-court branch (分院)', () => {
  assert.equal(extractCourtName('臺灣高等法院臺中分院民事判決'), '臺灣高等法院臺中分院');
});

test('returns null when no court name in the head', () => {
  assert.equal(extractCourtName('某段沒有相關字樣的內容'), null);
  assert.equal(extractCourtName(''), null);
});
