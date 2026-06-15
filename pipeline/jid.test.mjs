// pipeline/jid.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJid, courtTypeOf } from './jid.mjs';

test('parseJid splits the six JID fields', () => {
  const p = parseJid('CHDM,105,交訴,51,20161216,1');
  assert.equal(p.court, 'CHDM');
  assert.equal(p.year, '105');
  assert.equal(p.jcase, '交訴');
  assert.equal(p.no, '51');
  assert.equal(p.date, '20161216');
});

test('courtTypeOf returns the trailing letter of the first segment', () => {
  assert.equal(courtTypeOf('CDEV,105,橋司附民移調,101,20161219,1'), 'V');
  assert.equal(courtTypeOf('CHDM,105,交訴,51,20161216,1'), 'M');
});

test('parseJid returns null on malformed input', () => {
  assert.equal(parseJid('garbage'), null);
});
