// pipeline/markdown.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArticle, nextSlug } from './markdown.mjs';
import { CATEGORIES } from './config.mjs';

const cat = CATEGORIES.find((c) => c.key === 'personal');

test('nextSlug increments based on existing slugs', () => {
  assert.equal(nextSlug(cat, []), 'personal-story-01');
  assert.equal(nextSlug(cat, ['personal-story-01', 'personal-story-02']), 'personal-story-03');
});

test('buildArticle emits valid frontmatter and CTA', () => {
  const md = buildArticle({
    category: cat,
    slug: 'personal-story-05',
    title: '受益人踩雷的故事',
    bodyMarkdown: '## 困境\n\n陳小姐遇到難題。\n',
    caseSource: '臺北地院 95 年度保險簡上字第 11 號',
    order: 14,
    dateStr: '2026-06-16',
  });
  assert.ok(md.startsWith('---\n'));
  assert.ok(md.includes('caseStory: true'));
  assert.ok(md.includes('caseSource: "臺北地院 95 年度保險簡上字第 11 號"'));
  assert.ok(md.includes('subcategory: "personal-stories"'));
  assert.ok(md.includes('slug: "personal-story-05"'));
  assert.ok(md.includes('order: 14'));
  assert.ok(md.includes('## 困境'));
  assert.ok(md.includes('0909-230140')); // CTA 固定附加
});
