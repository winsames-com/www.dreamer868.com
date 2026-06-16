import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promptFor } from './rewrite.mjs';

const cand = {
  doc: { JTITLE: '遺產分割', JID: 'TCDV,113,家繼訴,5' },
  category: { label: '家庭財務規劃', key: 'family' },
  fullTextStr: '判決全文內容',
};

test('帶搜尋詞時 prompt 含字詞清單與融入指示', () => {
  const p = promptFor(cand, ['兄弟 分遺產', '繼承 順位']);
  assert.match(p, /自然融入/);
  assert.match(p, /兄弟 分遺產/);
  assert.match(p, /繼承 順位/);
});

test('無搜尋詞時 prompt 不含字詞段', () => {
  const p = promptFor(cand, []);
  assert.doesNotMatch(p, /自然融入/);
});
