# 每日判決擷取 pipeline（Part B）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每日自動從司法院開放 API 擷取最新相關判決，用 Claude Batch API（Sonnet 4.6）化名改編成案例故事，通過防護閘門後全自動 commit 發佈；不過閘門者隔離。

**Architecture:** 獨立的 Node ESM 工具（`pipeline/*.mjs`），用 Node 內建 `fetch`（runner Node 24）。司法院 API 契約：`Auth`(POST {user,password}→{Token}) / `JList`(POST {token}→[{date,list:[jid]}]) / `JDoc`(POST {token,j:jid}→{JID,JTITLE,JCASE,JYEAR,JNO,JDATE,JFULLX:{JFULLTYPE,JFULLCONTENT,JFULLPDF},ATTACHMENTS})。分類用純程式關鍵字比對（不耗 LLM）；改編用 `@anthropic-ai/sdk` 的 Message Batches（`claude-sonnet-4-6`，`output_config.format` 結構化輸出，省 50%）。GitHub Actions cron 排程，commit 觸發既有 `deploy.yml`。

**Tech Stack:** Node 24 ESM、`@anthropic-ai/sdk`、`node:test`（純函式單元測試）、GitHub Actions。沿用 Part A 的 schema（`caseStory`/`caseSource`）、subcategory（`*-stories`）、ArticleLayout 免責框。

**對應 spec：** `docs/superpowers/specs/2026-06-15-service-target-case-stories-design.md`（Part B）

**前置（使用者已備）：** 司法院資料開放平臺帳號、Anthropic API key。實作完成後設為 GitHub secrets `JUD_USER`/`JUD_PASS`/`ANTHROPIC_API_KEY`。

**驗證策略：** 純函式（jid 解析、分類、化名正則、frontmatter 產生、閘門邏輯）用 `node:test` TDD；API/Batch 串接無法在本機驗證（需帳號 + API 僅台灣 0–6 點開放），以 `DRY_RUN` 乾跑（輸出到 `pipeline/quarantine/`、不 commit）由使用者於 Actions `workflow_dispatch` 觸發確認。

---

### Task 0: 分支與相依

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 從 main 建立分支**

Run:
```bash
git checkout main && git pull && git checkout -b feature/judgment-pipeline
```
Expected: 切到新分支 `feature/judgment-pipeline`

- [ ] **Step 2: 加入 Anthropic SDK 為 devDependency**

Run:
```bash
pnpm add -D @anthropic-ai/sdk
```
Expected: `package.json` 的 devDependencies 出現 `@anthropic-ai/sdk`；`pnpm-lock.yaml` 更新

- [ ] **Step 3: 確認 Node 版本與 ESM**

Run: `node -e "console.log(process.version); console.log(typeof fetch)"`
Expected: 版本 ≥ v18（CI 用 24）且輸出 `function`（原生 fetch 存在）

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: add @anthropic-ai/sdk for judgment pipeline"
```

---

### Task 1: pipeline 設定檔

**Files:**
- Create: `pipeline/config.mjs`

- [ ] **Step 1: 建立 config.mjs**

```js
// pipeline/config.mjs
// 四分眾的分類規則、門檻、每日上限、固定 hero 圖、Batch 設定。

export const MODEL = 'claude-sonnet-4-6';

// 每分眾每日最多 1 篇、全站每日最多 4 篇
export const LIMITS = { perCategoryPerDay: 1, perDayTotal: 4 };

// 閘門門檻（模型自評 1–5）
export const THRESHOLDS = { relevanceMin: 4, qualityMin: 4 };

// 裁判類別（JID 第一段最後一字）：V=民事 M=刑事 A=行政
export const ALLOWED_COURT_TYPES = new Set(['V', 'A']);

// 四分眾。order：依關鍵字命中數分類，平手時用陣列順序（先到先得）。
// hero 圖沿用 Part A 各分眾導讀文的 Pexels 圖（已含 credit）。
export const CATEGORIES = [
  {
    key: 'wealth-tax',
    label: '財富稅務規劃',
    subcategory: 'wealth-tax-stories',
    slugPrefix: 'wealth-tax-story',
    courtTypes: ['A'],
    keywords: ['遺產稅', '贈與稅', '實質課稅', '補稅', '稅捐', '課稅', '擬制遺產'],
    hero: {
      pexels_id: 5911971,
      url: 'https://images.pexels.com/photos/5911971/pexels-photo-5911971.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
      alt: '財富人士的財務規劃',
      photographer: 'cottonbro studio',
      photographer_url: 'https://www.pexels.com/@cottonbro',
      credit: 'Photo by cottonbro studio on Pexels',
    },
  },
  {
    key: 'family',
    label: '家庭財務規劃',
    subcategory: 'family-stories',
    slugPrefix: 'family-story',
    courtTypes: ['V'],
    keywords: ['遺產分割', '繼承', '扶養', '夫妻', '剩餘財產', '監護', '遺囑', '特留分'],
    hero: {
      pexels_id: 4783976,
      url: 'https://images.pexels.com/photos/4783976/pexels-photo-4783976.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
      alt: '幸福家庭的財務規劃',
      photographer: 'Ivan S',
      photographer_url: 'https://www.pexels.com/@ivan-s',
      credit: 'Photo by Ivan S on Pexels',
    },
  },
  {
    key: 'corporate',
    label: '公司財務規劃',
    subcategory: 'corporate-stories',
    slugPrefix: 'corporate-story',
    courtTypes: ['V'],
    keywords: ['股權', '股東', '借名登記', '經營權', '董事', '出資', '公司分割', '表決權'],
    hero: {
      pexels_id: 7640434,
      url: 'https://images.pexels.com/photos/7640434/pexels-photo-7640434.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
      alt: '企業主的財務規劃',
      photographer: 'Yan Krukau',
      photographer_url: 'https://www.pexels.com/@yankrukov',
      credit: 'Photo by Yan Krukau on Pexels',
    },
  },
  {
    key: 'personal',
    label: '個人財務規劃',
    subcategory: 'personal-stories',
    slugPrefix: 'personal-story',
    courtTypes: ['V'],
    keywords: ['保險', '受益人', '連帶保證', '保證人', '消費借貸', '債務', '本票', '清償'],
    hero: {
      pexels_id: 5466812,
      url: 'https://images.pexels.com/photos/5466812/pexels-photo-5466812.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
      alt: '個人財務規劃思考',
      photographer: 'olia danilevich',
      photographer_url: 'https://www.pexels.com/@olia-danilevich',
      credit: 'Photo by olia danilevich on Pexels',
    },
  },
];

export const PATHS = {
  articles: 'src/content/articles',
  seen: 'pipeline/state/seen-jids.json',
  quarantine: 'pipeline/quarantine',
};

export const CONTACT = {
  phone: '0909-230140',
  email: 'dreamer88888888888@gmail.com',
  address: '408 臺中市南屯區文心路一段186號9樓之1',
};
```

- [ ] **Step 2: 驗證可載入**

Run: `node -e "import('./pipeline/config.mjs').then(m=>console.log(m.CATEGORIES.length, m.MODEL))"`
Expected: `4 claude-sonnet-4-6`

- [ ] **Step 3: Commit**

```bash
git add pipeline/config.mjs
git commit -m "feat(pipeline): add category and threshold config"
```

---

### Task 2: JID 解析（TDD）

**Files:**
- Create: `pipeline/jid.mjs`
- Create: `pipeline/jid.test.mjs`

- [ ] **Step 1: 寫失敗測試**

```js
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test pipeline/jid.test.mjs`
Expected: FAIL（`jid.mjs` 尚未實作）

- [ ] **Step 3: 實作 jid.mjs**

```js
// pipeline/jid.mjs
// JID 格式：法院別+裁判類別,年度,字別,號次,裁判日期,檢查單號
// 例：CHDM,105,交訴,51,20161216,1（第一段最後一字為裁判類別 V/M/A/P/C）

export function parseJid(jid) {
  if (typeof jid !== 'string') return null;
  const parts = jid.split(',');
  if (parts.length < 6) return null;
  const [court, year, jcase, no, date, check] = parts;
  if (!court || !year || !jcase) return null;
  return { court, year, jcase, no, date, check, raw: jid };
}

export function courtTypeOf(jid) {
  const p = parseJid(jid);
  if (!p) return null;
  return p.court.slice(-1);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test pipeline/jid.test.mjs`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
git add pipeline/jid.mjs pipeline/jid.test.mjs
git commit -m "feat(pipeline): parse JID into fields and court type"
```

---

### Task 3: 分類與相關性（TDD）

**Files:**
- Create: `pipeline/classify.mjs`
- Create: `pipeline/classify.test.mjs`

- [ ] **Step 1: 寫失敗測試**

```js
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test pipeline/classify.test.mjs`
Expected: FAIL

- [ ] **Step 3: 實作 classify.mjs**

```js
// pipeline/classify.mjs
import { CATEGORIES, ALLOWED_COURT_TYPES } from './config.mjs';
import { courtTypeOf } from './jid.mjs';

export function prefilterJids(jids) {
  return jids.filter((j) => ALLOWED_COURT_TYPES.has(courtTypeOf(j)));
}

// 案由（JTITLE）命中權重 3，全文命中權重 1。回傳得分最高的分眾；平手用 config 順序。
export function classifyDoc(doc) {
  const title = (doc.JTITLE || '').toString();
  const full = ((doc.JFULLX && doc.JFULLX.JFULLCONTENT) || '').toString();
  const courtType = courtTypeOf(doc.JID);

  let best = null;
  for (const cat of CATEGORIES) {
    if (cat.courtTypes.length && !cat.courtTypes.includes(courtType)) continue;
    let score = 0;
    for (const kw of cat.keywords) {
      if (title.includes(kw)) score += 3;
      if (full.includes(kw)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { category: cat, score };
    }
  }
  // 至少需要案由命中一次（score>=3）或全文多次命中（score>=2）
  if (!best || best.score < 2) return null;
  return best;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test pipeline/classify.test.mjs`
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**

```bash
git add pipeline/classify.mjs pipeline/classify.test.mjs
git commit -m "feat(pipeline): prefilter and keyword-classify judgments"
```

---

### Task 4: 化名防護正則（TDD）

**Files:**
- Create: `pipeline/guard.mjs`
- Create: `pipeline/guard.test.mjs`

- [ ] **Step 1: 寫失敗測試**

```js
// pipeline/guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanAnonymization, passesGates } from './guard.mjs';

test('scanAnonymization flags an ID number', () => {
  const r = scanAnonymization('當事人 A123456789 提告');
  assert.equal(r.ok, false);
  assert.ok(r.hits.some((h) => h.kind === 'national_id'));
});

test('scanAnonymization flags a company tax id (統一編號)', () => {
  const r = scanAnonymization('某公司統一編號 12345678');
  assert.equal(r.ok, false);
  assert.ok(r.hits.some((h) => h.kind === 'tax_id'));
});

test('scanAnonymization passes clean anonymized text', () => {
  const r = scanAnonymization('陳小姐與先生協議分產，最後對簿公堂。');
  assert.equal(r.ok, true);
  assert.equal(r.hits.length, 0);
});

test('passesGates requires scores and clean scan', () => {
  const clean = { ok: true, hits: [] };
  assert.equal(passesGates({ relevance_score: 5, quality_score: 4, anonymization_ok: true }, clean), true);
  assert.equal(passesGates({ relevance_score: 2, quality_score: 5, anonymization_ok: true }, clean), false);
  assert.equal(passesGates({ relevance_score: 5, quality_score: 5, anonymization_ok: true }, { ok: false, hits: [{ kind: 'national_id' }] }), false);
  assert.equal(passesGates({ relevance_score: 5, quality_score: 5, anonymization_ok: false }, clean), false);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test pipeline/guard.test.mjs`
Expected: FAIL

- [ ] **Step 3: 實作 guard.mjs**

```js
// pipeline/guard.mjs
import { THRESHOLDS } from './config.mjs';

// 確定性化名掃描：偵測殘留的可辨識資訊。
// 注意：判決全文常將姓名遮成「甲○○」等，改編稿不應出現身分證、統編、完整電話、地址號樓。
const PATTERNS = [
  { kind: 'national_id', re: /[A-Z][12]\d{8}/g },                 // 身分證字號
  { kind: 'tax_id', re: /統一?編號\s*[:：]?\s*\d{8}/g },          // 統一編號
  { kind: 'tax_id', re: /(?<!\d)\d{8}(?!\d)/g },                  // 裸 8 碼（統編）
  { kind: 'phone', re: /09\d{2}[-\s]?\d{3}[-\s]?\d{3}/g },        // 手機
  { kind: 'redacted_name', re: /[甲乙丙丁戊][○Ｏ]{1,3}/g },        // 判決遮蔽殘留（甲○○）
  { kind: 'address_no', re: /\d+號(?:\d+樓)?(?:之\d+)?/g },        // 門牌號樓
];

export function scanAnonymization(markdown) {
  const text = (markdown || '').toString();
  const hits = [];
  for (const { kind, re } of PATTERNS) {
    const matches = text.match(re);
    if (matches) {
      for (const m of matches) hits.push({ kind, value: m });
    }
  }
  return { ok: hits.length === 0, hits };
}

export function passesGates(assessment, scanResult) {
  if (!assessment) return false;
  if (!scanResult || !scanResult.ok) return false;
  if (assessment.anonymization_ok !== true) return false;
  if (Number(assessment.relevance_score) < THRESHOLDS.relevanceMin) return false;
  if (Number(assessment.quality_score) < THRESHOLDS.qualityMin) return false;
  return true;
}
```

> 注意：`address_no` 與裸 8 碼正則偏嚴格，寧可誤抓導致隔離（保守失敗），不可漏放。聯絡資訊的公司地址由 markdown 產生器固定附加在 CTA，掃描只作用於「模型產出的故事本文」，不掃 CTA 區塊（見 Task 6 切分）。

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test pipeline/guard.test.mjs`
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**

```bash
git add pipeline/guard.mjs pipeline/guard.test.mjs
git commit -m "feat(pipeline): anonymization scan and gate logic"
```

---

### Task 5: 已處理帳本（TDD）

**Files:**
- Create: `pipeline/state.mjs`
- Create: `pipeline/state.test.mjs`
- Create: `pipeline/state/.gitkeep`

- [ ] **Step 1: 建立 state 目錄佔位**

Run: `mkdir -p pipeline/state && touch pipeline/state/.gitkeep`

- [ ] **Step 2: 寫失敗測試**

```js
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
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `node --test pipeline/state.test.mjs`
Expected: FAIL

- [ ] **Step 4: 實作 state.mjs**

```js
// pipeline/state.mjs
import { promises as fs } from 'node:fs';

export async function loadSeen(path) {
  try {
    const raw = await fs.readFile(path, 'utf8');
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (err) {
    if (err.code === 'ENOENT') return new Set();
    throw err;
  }
}

export async function saveSeen(path, set) {
  const arr = [...set].sort();
  await fs.writeFile(path, JSON.stringify(arr, null, 2) + '\n', 'utf8');
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `node --test pipeline/state.test.mjs`
Expected: PASS（2 tests）

- [ ] **Step 6: Commit**

```bash
git add pipeline/state.mjs pipeline/state.test.mjs pipeline/state/.gitkeep
git commit -m "feat(pipeline): seen-jid ledger persistence"
```

---

### Task 6: 文章 markdown 產生器（TDD）

**Files:**
- Create: `pipeline/markdown.mjs`
- Create: `pipeline/markdown.test.mjs`

- [ ] **Step 1: 寫失敗測試**

```js
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test pipeline/markdown.test.mjs`
Expected: FAIL

- [ ] **Step 3: 實作 markdown.mjs**

```js
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

// 產生完整文章檔。bodyMarkdown 是模型產出的故事本文（不含 CTA），CTA 由本函式固定附加。
export function buildArticle({ category, slug, title, bodyMarkdown, caseSource, order, dateStr }) {
  const h = category.hero;
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
date: ${dateStr}
author: Writer
status: draft
version: 1
task: 二-A-案例 自動產生（${category.label}）
category: 服務對象

caseStory: true
caseSource: "${caseSource}"

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
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test pipeline/markdown.test.mjs`
Expected: PASS（2 tests）

- [ ] **Step 5: Commit**

```bash
git add pipeline/markdown.mjs pipeline/markdown.test.mjs
git commit -m "feat(pipeline): article markdown builder with fixed CTA"
```

---

### Task 7: 司法院 API client

**Files:**
- Create: `pipeline/judicial.mjs`

> 此模組做網路 I/O，無法在本機沙箱單元測試（需帳號 + 服務窗 0–6 點）。正確性由 Task 11 乾跑驗證。實作須嚴格依官方契約。

- [ ] **Step 1: 實作 judicial.mjs**

```js
// pipeline/judicial.mjs
// 官方 API 契約（規格 114.08.22）：
//   POST https://data.judicial.gov.tw/jdg/api/Auth  body {user,password} -> {Token} | {error}
//   POST .../JList  body {token} -> [{date, list:[jid...]}] | "驗證失敗"
//   POST .../JDoc   body {token, j:jid} -> {JID,JYEAR,JCASE,JNO,JDATE,JTITLE,JFULLX:{JFULLTYPE,JFULLCONTENT,JFULLPDF},ATTACHMENTS} | {error}
// 服務時間僅每日 00:00–06:00（台灣）。

const BASE = 'https://data.judicial.gov.tw/jdg/api';

async function postJson(path, body, { retries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${BASE}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      if (!res.ok) throw new Error(`${path} HTTP ${res.status}: ${text.slice(0, 200)}`);
      return data;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function auth(user, password) {
  const data = await postJson('Auth', { user, password });
  if (!data || !data.Token) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data.Token;
}

export async function getChangeList(token) {
  const data = await postJson('JList', { token });
  if (!Array.isArray(data)) throw new Error(`JList failed: ${JSON.stringify(data).slice(0, 200)}`);
  // 攤平成單一 jid 陣列
  const jids = [];
  for (const day of data) {
    if (day && Array.isArray(day.list)) jids.push(...day.list);
  }
  return jids;
}

export async function getDoc(token, jid) {
  const data = await postJson('JDoc', { token, j: jid });
  if (data && data.error) return null; // 已移除或未公開
  if (!data || !data.JID) throw new Error(`JDoc unexpected: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

// 由 JDoc 取純文字全文（型態為 file 的 PDF 略過，回空字串）。
export function fullText(doc) {
  const x = doc.JFULLX || {};
  if (x.JFULLTYPE === 'text') return (x.JFULLCONTENT || '').toString();
  return '';
}

// 由 JDoc 組出可讀字號：例「臺灣高等法院 101 年度上易字第 797 號」需法院中文名，
// API 未直接提供法院中文名，故以「年度+字別+號」格式記錄，法院別以 court code 註記。
export function caseSourceOf(doc) {
  const year = doc.JYEAR || '';
  const jcase = doc.JCASE || '';
  const no = doc.JNO || '';
  return `${year} 年度${jcase}字第 ${no} 號（${doc.JID}）`;
}
```

> 字號可讀性說明：開放 API 不含法院中文全名，故 `caseSource` 以「年度+字別+號（JID）」呈現，JID 內含法院代碼可回溯。若日後要中文院名，需另建 court-code 對照表（非本計畫範圍）。

- [ ] **Step 2: 驗證可載入（不呼叫網路）**

Run: `node -e "import('./pipeline/judicial.mjs').then(m=>console.log(typeof m.auth, typeof m.getDoc, typeof m.fullText))"`
Expected: `function function function`

- [ ] **Step 3: Commit**

```bash
git add pipeline/judicial.mjs
git commit -m "feat(pipeline): judicial open-data API client"
```

---

### Task 8: Batch 改編（rewrite）

**Files:**
- Create: `pipeline/rewrite.mjs`

> 用 Message Batches（省 50%）。一筆 batch request = 一個候選判決，要求模型回傳結構化 JSON：title、body_markdown、relevance_score、quality_score、anonymization_ok、residual_identifiers。

- [ ] **Step 1: 實作 rewrite.mjs**

```js
// pipeline/rewrite.mjs
import Anthropic from '@anthropic-ai/sdk';
import { MODEL } from './config.mjs';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    body_markdown: { type: 'string' },
    relevance_score: { type: 'integer', enum: [1, 2, 3, 4, 5] },
    quality_score: { type: 'integer', enum: [1, 2, 3, 4, 5] },
    anonymization_ok: { type: 'boolean' },
    residual_identifiers: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'body_markdown', 'relevance_score', 'quality_score', 'anonymization_ok', 'residual_identifiers'],
};

function promptFor(candidate) {
  const { doc, category, fullTextStr } = candidate;
  return `你是台灣尊茂財務規劃公司的內容編輯。以下是一則真實法院判決，請改編成「${category.label}」分眾的客戶案例故事。

嚴格要求：
1. 完全化名：所有人物用化名（如陳小姐、王先生），不得出現任何真實姓名、公司全名、身分證、統一編號、電話、完整地址門牌。
2. 改編情節、不影射特定可辨識企業或個人，只取法律與財務情境骨架。
3. 結構：困境 → 問題剖析 → 正確規劃做法 → 啟示。用 Markdown，## 小標。不要寫聯絡資訊或 CTA（系統會自動附加）。
4. 標題吸引人但不誇大、與內文金額/事實一致。
5. body_markdown 約 500–800 字，繁體中文。

請同時自評：
- relevance_score：此判決情境與「${category.label}」的契合度（1–5）。
- quality_score：故事完整性與可讀性（1–5）。
- anonymization_ok：是否確實完全化名、無殘留可辨識資訊。
- residual_identifiers：若有殘留，列出；無則空陣列。

判決案由：${doc.JTITLE || ''}
判決字號（JID）：${doc.JID}
判決全文（節錄）：
${fullTextStr.slice(0, 12000)}`;
}

export function buildRequests(candidates) {
  return candidates.map((c, i) => ({
    custom_id: `cand-${i}`,
    params: {
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: promptFor(c) }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    },
  }));
}

export async function runBatch(candidates, { pollMs = 60000, maxPolls = 60 } = {}) {
  const client = new Anthropic(); // 讀 ANTHROPIC_API_KEY
  const requests = buildRequests(candidates);
  const batch = await client.messages.batches.create({ requests });

  let status = batch;
  for (let i = 0; i < maxPolls; i++) {
    status = await client.messages.batches.retrieve(batch.id);
    if (status.processing_status === 'ended') break;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  if (status.processing_status !== 'ended') {
    throw new Error(`Batch ${batch.id} did not end within poll window`);
  }

  // custom_id -> 解析後的 JSON
  const out = new Map();
  for await (const result of await client.messages.batches.results(batch.id)) {
    if (result.result.type !== 'succeeded') {
      out.set(result.custom_id, { error: result.result.type });
      continue;
    }
    const msg = result.result.message;
    const textBlock = msg.content.find((b) => b.type === 'text');
    let parsed = null;
    try { parsed = JSON.parse(textBlock.text); } catch { parsed = { error: 'parse_failed', raw: textBlock?.text }; }
    out.set(result.custom_id, parsed);
  }
  return out;
}
```

- [ ] **Step 2: 驗證可載入**

Run: `node -e "import('./pipeline/rewrite.mjs').then(m=>console.log(typeof m.runBatch, typeof m.buildRequests))"`
Expected: `function function`

- [ ] **Step 3: Commit**

```bash
git add pipeline/rewrite.mjs
git commit -m "feat(pipeline): batch rewrite via Sonnet structured output"
```

---

### Task 9: orchestrator（run.mjs）

**Files:**
- Create: `pipeline/run.mjs`
- Create: `pipeline/quarantine/.gitkeep`

- [ ] **Step 1: 建立 quarantine 佔位**

Run: `mkdir -p pipeline/quarantine && touch pipeline/quarantine/.gitkeep`

- [ ] **Step 2: 實作 run.mjs**

```js
// pipeline/run.mjs
// 全流程：auth -> JList -> 字別預過濾 -> dedup -> JDoc -> 分類 -> 取每分眾上限 ->
//         batch 改編 -> 化名正則 + 自評閘門 -> 寫檔/隔離 -> 更新帳本 -> summary。
// 環境變數：JUD_USER, JUD_PASS, ANTHROPIC_API_KEY, DRY_RUN（"1" 則不寫正式檔、不更新帳本）。

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CATEGORIES, LIMITS, PATHS } from './config.mjs';
import { auth, getChangeList, getDoc, fullText, caseSourceOf } from './judicial.mjs';
import { prefilterJids, classifyDoc } from './classify.mjs';
import { loadSeen, saveSeen } from './state.mjs';
import { runBatch } from './rewrite.mjs';
import { scanAnonymization, passesGates } from './guard.mjs';
import { buildArticle, nextSlug } from './markdown.mjs';

const DRY_RUN = process.env.DRY_RUN === '1';

function log(...a) { console.log('[pipeline]', ...a); }

async function existingSlugs() {
  const files = await fs.readdir(PATHS.articles);
  return files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
}

async function main() {
  const user = process.env.JUD_USER, pass = process.env.JUD_PASS;
  if (!user || !pass) throw new Error('Missing JUD_USER / JUD_PASS');
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');

  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);

  const token = await auth(user, pass);
  log('authenticated');

  const rawJids = await getChangeList(token);
  log('change list size', rawJids.length);

  const seen = await loadSeen(PATHS.seen);
  const candidatesJids = prefilterJids(rawJids).filter((j) => !seen.has(j));
  log('after prefilter+dedup', candidatesJids.length);

  // 取文 + 分類，依分眾收集（每分眾收到上限即停）
  const perCategory = new Map(CATEGORIES.map((c) => [c.key, []]));
  for (const jid of candidatesJids) {
    const allFull = [...perCategory.values()].every((arr) => arr.length >= LIMITS.perCategoryPerDay);
    if (allFull) break;
    let doc;
    try { doc = await getDoc(token, jid); } catch (e) { log('getDoc err', jid, e.message); continue; }
    if (!doc) { seen.add(jid); continue; }
    seen.add(jid); // 已檢視即記錄，避免重複處理
    const cls = classifyDoc(doc);
    if (!cls) continue;
    const bucket = perCategory.get(cls.category.key);
    if (bucket.length >= LIMITS.perCategoryPerDay) continue;
    bucket.push({ doc, category: cls.category, fullTextStr: fullText(doc), score: cls.score });
  }

  let candidates = [].concat(...perCategory.values());
  if (candidates.length > LIMITS.perDayTotal) candidates = candidates.slice(0, LIMITS.perDayTotal);
  log('candidates to rewrite', candidates.length);

  if (candidates.length === 0) {
    if (!DRY_RUN) await saveSeen(PATHS.seen, seen);
    log('nothing to do');
    return;
  }

  const results = await runBatch(candidates);

  const slugs = await existingSlugs();
  const published = [];
  const quarantined = [];

  candidates.forEach((cand, i) => {
    const a = results.get(`cand-${i}`);
    if (!a || a.error) { quarantined.push({ cand, reason: `batch:${a && a.error}` }); return; }
    const scan = scanAnonymization(a.body_markdown);
    const ok = passesGates(a, scan) && typeof a.title === 'string' && a.title.length > 0;

    const slug = nextSlug(cand.category, slugs);
    slugs.push(slug);
    const order = 10 + slugs.filter((s) => s.startsWith(cand.category.slugPrefix)).length; // 確保 >10 且遞增
    const md = buildArticle({
      category: cand.category,
      slug,
      title: a.title || `${cand.category.label}案例`,
      bodyMarkdown: a.body_markdown || '',
      caseSource: caseSourceOf(cand.doc),
      order,
      dateStr,
    });

    if (ok && !DRY_RUN) {
      published.push({ slug, path: path.join(PATHS.articles, `${slug}.md`), md });
    } else {
      quarantined.push({ cand, slug, md, reason: ok ? 'dry_run' : `gate(rel=${a.relevance_score},qual=${a.quality_score},anon=${a.anonymization_ok},scan=${scan.ok})` });
    }
  });

  // 寫檔
  for (const p of published) await fs.writeFile(p.path, p.md, 'utf8');
  for (const q of quarantined) {
    const name = `${q.slug || 'cand'}-${q.cand.doc.JID.replace(/[^A-Za-z0-9]/g, '_')}.md`;
    await fs.writeFile(path.join(PATHS.quarantine, name), `<!-- reason: ${q.reason} -->\n${q.md || ''}`, 'utf8');
  }

  if (!DRY_RUN) await saveSeen(PATHS.seen, seen);

  // GitHub Actions job summary
  const summary = [
    `## 判決 pipeline ${dateStr}`,
    `- 異動清單：${rawJids.length}`,
    `- 候選：${candidates.length}`,
    `- 發佈：${published.length}（${published.map((p) => p.slug).join(', ') || '—'}）`,
    `- 隔離：${quarantined.length}（${quarantined.map((q) => q.reason).join('; ') || '—'}）`,
    DRY_RUN ? '- 模式：DRY_RUN（未寫正式檔、未更新帳本）' : '- 模式：正式',
  ].join('\n');
  log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}

main().catch((e) => { console.error('[pipeline] FATAL', e); process.exit(1); });
```

- [ ] **Step 3: 語法檢查（不執行 main，缺 env 會 fatal 退出，預期）**

Run: `node --check pipeline/run.mjs && echo "syntax-ok"`
Expected: `syntax-ok`

- [ ] **Step 4: Commit**

```bash
git add pipeline/run.mjs pipeline/quarantine/.gitkeep
git commit -m "feat(pipeline): orchestrator with gates and quarantine"
```

---

### Task 10: GitHub Actions 工作流

**Files:**
- Create: `.github/workflows/judgment-pipeline.yml`

- [ ] **Step 1: 建立工作流**

```yaml
name: judgment-pipeline

on:
  schedule:
    - cron: '0 17 * * *' # 17:00 UTC = 台灣 01:00（落在 API 服務窗 0–6 時）
  workflow_dispatch:
    inputs:
      dry_run:
        description: '乾跑（不發佈、不更新帳本）'
        type: boolean
        default: true

permissions:
  contents: write

concurrency:
  group: judgment-pipeline
  cancel-in-progress: false

jobs:
  run:
    runs-on: ubuntu-latest
    timeout-minutes: 120
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Run pipeline
        env:
          JUD_USER: ${{ secrets.JUD_USER }}
          JUD_PASS: ${{ secrets.JUD_PASS }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          DRY_RUN: ${{ (github.event_name == 'workflow_dispatch' && inputs.dry_run) && '1' || '' }}
        run: node pipeline/run.mjs

      - name: Commit new articles
        if: ${{ !(github.event_name == 'workflow_dispatch' && inputs.dry_run) }}
        run: |
          git config user.name "judgment-pipeline[bot]"
          git config user.email "actions@users.noreply.github.com"
          git add src/content/articles pipeline/state/seen-jids.json
          if git diff --cached --quiet; then
            echo "No changes to commit"
          else
            git commit -m "content: auto-publish judgment case stories ($(date -u +%F))"
            git push
          fi

      - name: Upload quarantine artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: quarantine-${{ github.run_id }}
          path: pipeline/quarantine/
          if-no-files-found: ignore
```

- [ ] **Step 2: YAML 語法檢查**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/judgment-pipeline.yml','utf8');if(!s.includes('judgment-pipeline'))process.exit(1);console.log('yaml-present')"`
Expected: `yaml-present`（完整 lint 由 GitHub 端進行）

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/judgment-pipeline.yml
git commit -m "ci: schedule daily judgment pipeline workflow"
```

---

### Task 11: 全套單元測試 + 文件

**Files:**
- Create: `pipeline/README.md`
- Modify: `package.json`（加 test script）

- [ ] **Step 1: package.json 加測試指令**

在 `scripts` 加入：
```json
    "test:pipeline": "node --test pipeline/*.test.mjs"
```

- [ ] **Step 2: 跑全部純函式測試**

Run: `pnpm test:pipeline`
Expected: 全數 PASS（jid / classify / guard / state / markdown）

- [ ] **Step 3: 建立 README**

```markdown
# 每日判決擷取 pipeline（Part B）

每日從司法院開放資料 API 擷取最新相關判決，用 Claude Batch API（Sonnet 4.6）化名改編成案例故事，通過防護閘門後自動發佈。

## 設定（一次性）
於 GitHub repo Settings → Secrets and variables → Actions 設定：
- `JUD_USER` / `JUD_PASS`：司法院資料開放平臺帳號密碼
- `ANTHROPIC_API_KEY`：Anthropic API key

## 流程
`auth → JList(7日前異動) → 字別預過濾(民事V/行政A) → 比對帳本去重 → JDoc 取全文 → 關鍵字分類 → 每分眾上限 → Batch 改編 → 化名正則+模型自評雙閘門 → 寫檔/隔離 → commit`

## 防護閘門（寧缺勿濫）
- 化名正則掃描（身分證/統編/電話/遮蔽殘留/門牌）→ 命中即隔離
- 模型自評 relevance/quality（門檻見 config）+ anonymization_ok
- 任一不過 → 寫入 `pipeline/quarantine/`（不發佈），並上傳為 Actions artifact

## 上限
每分眾每日 ≤ 1 篇、全站每日 ≤ 4 篇（`pipeline/config.mjs`）。

## 乾跑（首次驗證）
Actions → judgment-pipeline → Run workflow → dry_run = true。
會抓取+分類+改編+閘門全跑，但不寫正式檔、不 commit、不更新帳本；結果在 quarantine artifact。
**注意：API 僅每日台灣 00:00–06:00 開放**，手動觸發請在此時段（cron 已設台灣 01:00）。

## 字號
開放 API 不含法院中文全名，`caseSource` 以「年度+字別+號（JID）」記錄；JID 內含法院代碼可回溯。

## 本機測試
`pnpm test:pipeline`（純函式單元測試，不呼叫網路）。
```

- [ ] **Step 4: Commit**

```bash
git add package.json pipeline/README.md
git commit -m "docs(pipeline): add README and test script"
```

---

### Task 12: 整合健檢

**Files:** 無（驗證）

- [ ] **Step 1: 全測試**

Run: `pnpm test:pipeline`
Expected: 全 PASS

- [ ] **Step 2: 所有模組可載入**

Run: `node -e "Promise.all(['config','jid','classify','guard','state','markdown','judicial','rewrite'].map(m=>import('./pipeline/'+m+'.mjs'))).then(()=>console.log('all-import-ok')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: `all-import-ok`

- [ ] **Step 3: run.mjs 缺 env 時優雅報錯**

Run: `node pipeline/run.mjs; echo "exit=$?"`
Expected: 印出 `Missing JUD_USER / JUD_PASS` 且 `exit=1`（不崩潰堆疊）

- [ ] **Step 4: 既有網站建置不受影響**

Run: `pnpm build 2>&1 | tail -3`
Expected: `[build] Complete!`（pipeline 不影響 Astro 建置）

---

## 完成後

- 推送分支並開 PR（待使用者示意）：`git push -u origin feature/judgment-pipeline`
- 使用者設定三個 GitHub secrets。
- 使用者於台灣 0–6 點以 `workflow_dispatch`（dry_run=true）首次乾跑，檢視 quarantine artifact 的改編品質與閘門行為。
- 觀察數日輸出無誤後，讓 cron 正式自動發佈。

## 已知限制（誠實揭露）
> 下列前三項已於強化階段（feature/pipeline-hardening）處理：加獨立 `claude -p` 查核關卡（`verify.mjs`，含 worthiness 故事性評分）、字號改從全文擷取法院中文名（`courts.mjs`）。
- ~~**模型自評**非獨立驗證~~ → 已加第二關獨立查核。
- ~~**「最新 ≠ 最有故事性」**~~ → 第二關 worthiness 門檻過濾。
- ~~**字號可讀性**缺法院中文名~~ → 已從全文擷取。
- **仍可能多日無產出**（無相關判決或皆未過關），屬正常。
- **API 服務窗 0–6 點**：cron 已對齊；手動乾跑須在此時段。
- **Actions runner IP**：本環境（雲端）可連 `data.judicial.gov.tw`（回 405＝可連），但首次乾跑仍是對 Actions runner IP 的實測；若被擋，改用 self-hosted runner（台灣）或本機 cron。
