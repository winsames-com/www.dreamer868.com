import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gapAnalysis } from './gap.mjs';

test('已被現有標題涵蓋的字詞不算缺口；未涵蓋的列為缺口', () => {
  const bucketed = {
    family: [
      { query: '遺產 分割 訴訟', impressions: 200 },
      { query: '監護 宣告 流程', impressions: 150 },
    ],
    'wealth-tax': [], corporate: [], personal: [], _unbucketed: [],
  };
  const titlesByCat = { family: ['三兄妹爭遺產，法院判分割拍賣'] };
  const gaps = gapAnalysis(bucketed, titlesByCat);
  // 「遺產 分割」已被標題（含「遺產」「分割」）涵蓋 → 不在缺口
  assert.ok(!gaps.family.some((g) => g.query === '遺產 分割 訴訟'));
  // 「監護」未出現在任何 family 標題 → 缺口
  assert.ok(gaps.family.some((g) => g.query === '監護 宣告 流程'));
});

test('沒有任何文章的分眾，其所有命中字詞都是缺口', () => {
  const bucketed = { family: [], 'wealth-tax': [{ query: '遺產稅 申報', impressions: 50 }], corporate: [], personal: [], _unbucketed: [] };
  const gaps = gapAnalysis(bucketed, {});
  assert.equal(gaps['wealth-tax'].length, 1);
});
