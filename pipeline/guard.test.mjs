// pipeline/guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanAnonymization, passesGates, scanSuspectFullNames } from './guard.mjs';

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

test('scanAnonymization does not flag a monetary amount', () => {
  const r = scanAnonymization('國稅局核定遺產稅 12345678 元。');
  assert.equal(r.ok, true);
});

test('scanAnonymization does not flag an ordinal 號', () => {
  const r = scanAnonymization('依方案第3號附表辦理，另見第12號決議。');
  assert.equal(r.ok, true);
});

test('scanAnonymization flags a real street address with floor', () => {
  const r = scanAnonymization('地址為文心路一段186號9樓。');
  assert.equal(r.ok, false);
  assert.ok(r.hits.some((h) => h.kind === 'address'));
});

// ── 姓＋雙名 啟發式後盾 ──
test('flags 姓＋雙名 全名 after a party/relationship cue', () => {
  const r = scanAnonymization('妻子高秀英今年64歲，某日在住家附近遭撞。');
  assert.equal(r.ok, false);
  assert.ok(r.hits.some((h) => h.kind === 'suspect_fullname' && h.value === '高秀英'));
});

test('flags two 全名 conjoined (X與Y)', () => {
  assert.deepEqual(scanSuspectFullNames('陳威明與林志成原是公司股東').sort(), ['林志成', '陳威明']);
});

test('flags 其子＋全名', () => {
  assert.deepEqual(scanSuspectFullNames('然而王女士與其子王少東稱已取得股份'), ['王少東']);
});

test('does NOT flag 姓＋通用稱謂 / 角色（正當化名）', () => {
  assert.equal(scanSuspectFullNames('被告陳先生與原告王小姐，另有林老太太、駕駛人及其子女。').length, 0);
  assert.equal(scanSuspectFullNames('債務人洪某與林某均未到庭。').length, 0);
});

test('does NOT flag 機構/地名/常用詞（假陽性防護）', () => {
  const txt = '高雄地方法院與高等法院審理，董事長王先生出庭；本文說明如何規劃現金流與稅務。';
  assert.equal(scanSuspectFullNames(txt).length, 0);
});

test('passesGates requires scores and clean scan', () => {
  const clean = { ok: true, hits: [] };
  assert.equal(passesGates({ relevance_score: 5, quality_score: 4, anonymization_ok: true }, clean), true);
  assert.equal(passesGates({ relevance_score: 2, quality_score: 5, anonymization_ok: true }, clean), false);
  assert.equal(passesGates({ relevance_score: 5, quality_score: 5, anonymization_ok: true }, { ok: false, hits: [{ kind: 'national_id' }] }), false);
  assert.equal(passesGates({ relevance_score: 5, quality_score: 5, anonymization_ok: false }, clean), false);
});
