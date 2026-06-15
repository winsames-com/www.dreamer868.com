// pipeline/verify.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyPasses } from './verify.mjs';

const good = { anonymization_ok: true, faithful: true, relevant: true, worthiness: 4, issues: [] };

test('verifyPasses accepts a clean verdict above worthiness threshold', () => {
  assert.equal(verifyPasses(good, 3), true);
});

test('verifyPasses rejects low worthiness', () => {
  assert.equal(verifyPasses({ ...good, worthiness: 2 }, 3), false);
});

test('verifyPasses rejects any false flag', () => {
  assert.equal(verifyPasses({ ...good, anonymization_ok: false }, 3), false);
  assert.equal(verifyPasses({ ...good, faithful: false }, 3), false);
  assert.equal(verifyPasses({ ...good, relevant: false }, 3), false);
});

test('verifyPasses fails closed on error or missing verdict', () => {
  assert.equal(verifyPasses({ error: 'claude_error' }, 3), false);
  assert.equal(verifyPasses(null, 3), false);
});
