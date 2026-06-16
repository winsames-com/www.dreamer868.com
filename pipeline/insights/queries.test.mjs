import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchBucketedQueries } from './queries.mjs';

test('fetcher 成功時回分流結果', async () => {
  const fakeFetcher = async () => ({ ok: true, data: { rows: [
    { keys: ['遺產稅 試算'], clicks: 3, impressions: 90 },
    { keys: ['分遺產 訴訟'], clicks: 1, impressions: 30 },
  ] } });
  const b = await fetchBucketedQueries({ fetcher: fakeFetcher });
  assert.ok(b['wealth-tax'].some((r) => r.query === '遺產稅 試算'));
  assert.ok(b.family.some((r) => r.query === '分遺產 訴訟'));
});

test('fetcher 失敗時降級為空結構（不丟例外）', async () => {
  const failFetcher = async () => ({ ok: false, status: 500, message: 'boom' });
  const b = await fetchBucketedQueries({ fetcher: failFetcher });
  assert.deepEqual(b.family, []);
  assert.deepEqual(b._unbucketed, []);
});

test('fetcher 丟例外時也降級為空結構', async () => {
  const throwFetcher = async () => { throw new Error('network'); };
  const b = await fetchBucketedQueries({ fetcher: throwFetcher });
  assert.deepEqual(b['wealth-tax'], []);
});
