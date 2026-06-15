// pipeline/state.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { loadSeen, saveSeen } from './state.mjs';

const TMP = 'pipeline/state/__test-seen.json';

test('loadSeen returns empty set when file missing', async () => {
  await fs.rm(TMP, { force: true });
  const s = await loadSeen(TMP);
  assert.equal(s.size, 0);
});

test('saveSeen then loadSeen round-trips', async () => {
  const s = new Set(['a', 'b']);
  await saveSeen(TMP, s);
  const got = await loadSeen(TMP);
  assert.equal(got.size, 2);
  assert.ok(got.has('a') && got.has('b'));
  await fs.rm(TMP, { force: true });
});
