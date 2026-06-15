// pipeline/classify.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prefilterJids, classifyDoc } from './classify.mjs';

test('prefilterJids keeps only civil(V) and admin(A) jids', () => {
  const jids = [
    'CHDM,105,交訴,51,20161216,1',   // M 刑事 → 濾掉
    'CDEV,105,重訴,1,20240101,1',     // V 民事 → 留
    'TPAA,113,訴,99,20240101,1',      // A 行政 → 留
  ];
  const out = prefilterJids(jids);
  assert.deepEqual(out, ['CDEV,105,重訴,1,20240101,1', 'TPAA,113,訴,99,20240101,1']);
});

test('classifyDoc assigns wealth-tax for estate-tax title', () => {
  const doc = { JID: 'TPAA,113,訴,99,20240101,1', JTITLE: '遺產稅事件', JFULLX: { JFULLCONTENT: '... 實質課稅 ...' } };
  const r = classifyDoc(doc);
  assert.equal(r.category.key, 'wealth-tax');
  assert.ok(r.score >= 2);
});

test('classifyDoc assigns family for partition title', () => {
  const doc = { JID: 'CDEV,113,家繼訴,5,20240101,1', JTITLE: '分割遺產', JFULLX: { JFULLCONTENT: '繼承人請求分割遺產' } };
  const r = classifyDoc(doc);
  assert.equal(r.category.key, 'family');
});

test('classifyDoc returns null when no keywords match', () => {
  const doc = { JID: 'CDEV,113,訴,1,20240101,1', JTITLE: '損害賠償', JFULLX: { JFULLCONTENT: '車禍' } };
  assert.equal(classifyDoc(doc), null);
});
