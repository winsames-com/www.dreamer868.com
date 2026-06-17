// pipeline/markdown.mjs
import { CONTACT } from './config.mjs';

// 從既有 slug 清單推算下一個流水號（每分眾自己的 prefix）。
export function nextSlug(category, existingSlugs) {
  const re = new RegExp(`^${category.slugPrefix}-(\\d+)$`);
  let max = 0;
  for (const s of existingSlugs) {
    const m = re.exec(s);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const n = String(max + 1).padStart(2, '0');
  return `${category.slugPrefix}-${n}`;
}

// YAML 雙引號字串跳脫
const yq = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s+/g, ' ').trim()}"`;

// 產生完整文章檔。bodyMarkdown 是模型產出的故事本文（不含 CTA），CTA 由本函式固定附加。
// description / faq 為改編引擎一併產出（GEO/AEO）；缺省則略過該欄位、向後相容。
export function buildArticle({ category, slug, title, bodyMarkdown, description, faq, caseSource, order, dateStr }) {
  const h = category.hero;
  const descLine = description ? `description: ${yq(description)}\n` : '';
  const faqBlock = Array.isArray(faq) && faq.length
    ? 'faq:\n' + faq.filter((f) => f && f.q && f.a).map((f) => `  - q: ${yq(f.q)}\n    a: ${yq(f.a)}`).join('\n') + '\n'
    : '';
  const cta = [
    '',
    '---',
    '',
    '想了解你的情況該如何規劃？歡迎與我們聊聊。',
    '',
    `📞 ${CONTACT.phone}`,
    `📧 ${CONTACT.email}`,
    `📍 ${CONTACT.address}`,
    '',
    '**賦予人們宏觀永續的財商新思路**',
    '',
  ].join('\n');

  return `---
title: ${title}
${descLine}date: ${dateStr}
author: Writer
status: published
version: 1
task: 二-A-案例 自動產生（${category.label}）
category: 服務對象

caseStory: true
caseSource: "${caseSource}"
${faqBlock}
images:
  hero:
    pexels_id: ${h.pexels_id}
    url: "${h.url}"
    alt: "${h.alt}"
    photographer: "${h.photographer}"
    photographer_url: "${h.photographer_url}"
    credit: "${h.credit}"

section: "new"
subcategory: "${category.subcategory}"
order: ${order}
slug: "${slug}"
---

# ${title}

![${h.alt}](${h.url})
*Photo by [${h.photographer}](${h.photographer_url}) on [Pexels](https://www.pexels.com)*

${bodyMarkdown.trim()}
${cta}`;
}
