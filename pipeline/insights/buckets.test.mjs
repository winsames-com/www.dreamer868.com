import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketize, BUCKETS, emptyBuckets } from './buckets.mjs';

test('emptyBuckets 含四分眾與 _unbucketed，皆空陣列', () => {
  const e = emptyBuckets();
  assert.deepEqual(Object.keys(e).sort(), ['_unbucketed', 'corporate', 'family', 'personal', 'wealth-tax'].sort());
  for (const k of Object.keys(e)) assert.deepEqual(e[k], []);
});

test('bucketize 依分流詞把 query 分到對應分眾', () => {
  const rows = [
    { query: '遺產稅 試算', clicks: 5, impressions: 100 },
    { query: '兄弟 分遺產 怎麼辦', clicks: 2, impressions: 50 },
    { query: '公司 借名登記 股權', clicks: 1, impressions: 20 },
    { query: '台中 天氣', clicks: 0, impressions: 8 },
  ];
  const b = bucketize(rows);
  assert.ok(b['wealth-tax'].some((r) => r.query === '遺產稅 試算'));
  assert.ok(b.family.some((r) => r.query === '兄弟 分遺產 怎麼辦'));
  assert.ok(b.corporate.some((r) => r.query === '公司 借名登記 股權'));
  assert.ok(b._unbucketed.some((r) => r.query === '台中 天氣'));
});

test('一個 query 命中多分眾時可同時落入', () => {
  const b = bucketize([{ query: '遺產 與 遺產稅 規劃', clicks: 1, impressions: 10 }]);
  assert.ok(b.family.length === 1 && b['wealth-tax'].length === 1);
});

test('BUCKETS 四分眾 key 與 config 一致', () => {
  assert.deepEqual(Object.keys(BUCKETS).sort(), ['corporate', 'family', 'personal', 'wealth-tax'].sort());
});
