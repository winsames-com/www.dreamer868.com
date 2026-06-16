# GSC 搜尋資料整合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Search Console 搜尋字詞接進判決案例故事流程：改編時融入該分眾熱門搜尋詞（②），並在 insights 報告產出選題缺口（③）。

**Architecture:** 新增 `buckets.mjs`（分流關鍵字表 + 純函式 `bucketize`）與 `queries.mjs`（拉 GSC + 分流 + 容錯）。`rewrite.mjs` 改編 prompt 接受該分眾字詞；`run.mjs` 每次啟動拉一次並分流；`insights/run.mjs` 加缺口分析。判決分類（`classify.mjs`/`config.mjs` keywords）完全不動。

**Tech Stack:** Node 22 ESM、`node --test`、`google-auth-library`（已裝）、`claude -p`。

**Spec:** `docs/superpowers/specs/2026-06-16-gsc-search-insights-integration-design.md`

**前置：** 所有測試用 `pnpm test:pipeline`。本計畫第一步先把該指令改為遞迴涵蓋 `pipeline/insights/` 子目錄。所有檔案路徑相對 repo 根 `/Users/lightman/myGithub/www.dreamer868.com`。

---

### Task 1: 測試指令涵蓋子目錄

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 改 test:pipeline glob 為遞迴**

把 `package.json` 的 scripts 中：
```json
    "test:pipeline": "node --test pipeline/*.test.mjs",
```
改為（給目錄，Node test runner 會遞迴尋找 `*.test.mjs`，涵蓋 `pipeline/insights/`）：
```json
    "test:pipeline": "node --test pipeline/",
```

- [ ] **Step 2: 確認既有測試仍可跑**

Run: `pnpm test:pipeline`
Expected: 既有 jid/classify/guard/state/markdown/courts/verify 測試全部 PASS（pass 數不為 0）。

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(pipeline): test:pipeline 改為遞迴涵蓋子目錄測試"
```

---

### Task 2: 分流關鍵字表 + bucketize 純函式

**Files:**
- Create: `pipeline/insights/buckets.mjs`
- Test: `pipeline/insights/buckets.test.mjs`

- [ ] **Step 1: 寫失敗測試**

Create `pipeline/insights/buckets.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketize, BUCKETS, emptyBuckets } from './buckets.mjs';

test('emptyBuckets 含四分眾與 _unbucketed，皆空陣列', () => {
  const e = emptyBuckets();
  assert.deepEqual(Object.keys(e).sort(), ['_unbucketed', 'corporate', 'family', 'personal', 'wealth-tax'].sort());
  for (const k of Object.keys(e)) assert.deepEqual(e[k], []);
});

test('bucketize 依分流詞把 query 分到對應分眾', () => {
  const rows = [
    { query: '遺產稅 試算', clicks: 5, impressions: 100 },
    { query: '兄弟 分遺產 怎麼辦', clicks: 2, impressions: 50 },
    { query: '公司 借名登記 股權', clicks: 1, impressions: 20 },
    { query: '台中 天氣', clicks: 0, impressions: 8 },
  ];
  const b = bucketize(rows);
  assert.ok(b['wealth-tax'].some((r) => r.query === '遺產稅 試算'));
  assert.ok(b.family.some((r) => r.query === '兄弟 分遺產 怎麼辦'));
  assert.ok(b.corporate.some((r) => r.query === '公司 借名登記 股權'));
  assert.ok(b._unbucketed.some((r) => r.query === '台中 天氣'));
});

test('一個 query 命中多分眾時可同時落入', () => {
  const b = bucketize([{ query: '遺產 與 遺產稅 規劃', clicks: 1, impressions: 10 }]);
  assert.ok(b.family.length === 1 && b['wealth-tax'].length === 1);
});

test('BUCKETS 四分眾 key 與 config 一致', () => {
  assert.deepEqual(Object.keys(BUCKETS).sort(), ['corporate', 'family', 'personal', 'wealth-tax'].sort());
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test:pipeline`
Expected: FAIL（`Cannot find module './buckets.mjs'`）。

- [ ] **Step 3: 實作 buckets.mjs**

Create `pipeline/insights/buckets.mjs`:
```js
// pipeline/insights/buckets.mjs
// 把 GSC 搜尋字詞分流到四分眾的關鍵字表（口語＋法律混合，刻意比 config.mjs 的
// classify keywords 更寬）。此表僅決定「字詞給哪個分眾參考」，完全不影響判決分類。

export const BUCKETS = {
  'wealth-tax': ['遺產稅', '贈與稅', '節稅', '課稅', '實質課稅', '補稅', '稅務'],
  family: ['繼承', '遺產', '分遺產', '分家產', '留給子女', '特留分', '贍養', '監護', '遺囑'],
  corporate: ['股權', '股東', '借名登記', '經營權', '董事', '公司分割', '出資'],
  personal: ['保險', '受益人', '連帶保證', '保證人', '本票', '債務', '清償'],
};

export function emptyBuckets() {
  const out = { _unbucketed: [] };
  for (const k of Object.keys(BUCKETS)) out[k] = [];
  return out;
}

// rows: [{ query, clicks, impressions }, ...]
// 回傳 { 'wealth-tax':[...], family:[...], corporate:[...], personal:[...], _unbucketed:[...] }
// query 含某分眾任一分流詞即歸該分眾（可同時落入多分眾）；皆未命中則歸 _unbucketed。
export function bucketize(rows) {
  const out = emptyBuckets();
  for (const row of rows || []) {
    const q = (row.query || '').toString();
    let matched = false;
    for (const [cat, words] of Object.entries(BUCKETS)) {
      if (words.some((w) => q.includes(w))) { out[cat].push(row); matched = true; }
    }
    if (!matched) out._unbucketed.push(row);
  }
  return out;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test:pipeline`
Expected: PASS（含 4 個新 buckets 測試）。

- [ ] **Step 5: Commit**

```bash
git add pipeline/insights/buckets.mjs pipeline/insights/buckets.test.mjs
git commit -m "feat(insights): 分流關鍵字表 + bucketize（不碰判決分類）"
```

---

### Task 3: queries.mjs（拉 GSC + 分流 + 容錯）+ fixtures

**Files:**
- Create: `pipeline/insights/queries.mjs`
- Create: `pipeline/insights/fixtures/queries.mjs`
- Test: `pipeline/insights/queries.test.mjs`

- [ ] **Step 1: 寫失敗測試**

Create `pipeline/insights/queries.test.mjs`:
```js
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test:pipeline`
Expected: FAIL（`Cannot find module './queries.mjs'`）。

- [ ] **Step 3: 實作 queries.mjs**

Create `pipeline/insights/queries.mjs`:
```js
// pipeline/insights/queries.mjs
// 拉 GSC 搜尋字詞並用 buckets 分流。容錯：任何失敗/逾時/空資料都回 emptyBuckets()，
// 絕不丟例外（判決 pipeline 不可因搜尋資料故障而中斷發佈）。

import { postJson } from './auth.mjs';
import { GSC_SITE, WINDOW_DAYS, GSC_LAG_DAYS, TOP_N } from './config.mjs';
import { bucketize, emptyBuckets } from './buckets.mjs';

const fmtDate = (d) => d.toISOString().slice(0, 10);

function windowDates() {
  const end = new Date();
  end.setDate(end.getDate() - GSC_LAG_DAYS);
  const start = new Date(end);
  start.setDate(start.getDate() - WINDOW_DAYS);
  return { startDate: fmtDate(start), endDate: fmtDate(end) };
}

// 預設 fetcher：打 GSC search analytics（query 維度）。回傳 auth.mjs 的 {ok,data}/{ok:false,...}。
function defaultFetcher() {
  const { startDate, endDate } = windowDates();
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`;
  return postJson(url, { startDate, endDate, dimensions: ['query'], rowLimit: TOP_N });
}

// 回傳分流後的字詞物件；失敗一律降級為 emptyBuckets()。
export async function fetchBucketedQueries({ fetcher = defaultFetcher } = {}) {
  try {
    const r = await fetcher();
    if (!r || !r.ok) {
      console.log('[insights] GSC 字詞拉取失敗，降級為無字詞:', r && (r.message || r.status));
      return emptyBuckets();
    }
    const rows = (r.data.rows || []).map((row) => ({
      query: row.keys[0], clicks: row.clicks, impressions: row.impressions,
    }));
    return bucketize(rows);
  } catch (e) {
    console.log('[insights] GSC 字詞拉取例外，降級為無字詞:', e.message);
    return emptyBuckets();
  }
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test:pipeline`
Expected: PASS（含 3 個新 queries 測試）。

- [ ] **Step 5: 建合成 fixtures**

Create `pipeline/insights/fixtures/queries.mjs`:
```js
// pipeline/insights/fixtures/queries.mjs
// 合成 GSC 搜尋字詞（無真實個資），供離線開發/dev-run 用，與真實 GSC rows 同形。
export const FIXTURE_QUERY_ROWS = [
  { query: '遺產稅 怎麼 計算', clicks: 8, impressions: 220 },
  { query: '贈與稅 節稅 方法', clicks: 5, impressions: 140 },
  { query: '兄弟 分遺產 不公平 怎麼辦', clicks: 6, impressions: 180 },
  { query: '父母 遺產 繼承 順位', clicks: 4, impressions: 130 },
  { query: '公司 股權 借名登記 風險', clicks: 3, impressions: 90 },
  { query: '連帶保證人 責任 範圍', clicks: 3, impressions: 80 },
  { query: '保險 受益人 變更', clicks: 2, impressions: 60 },
  { query: '台中 財務顧問 推薦', clicks: 1, impressions: 40 },
];
```

- [ ] **Step 6: Commit**

```bash
git add pipeline/insights/queries.mjs pipeline/insights/queries.test.mjs pipeline/insights/fixtures/queries.mjs
git commit -m "feat(insights): GSC 字詞拉取+分流（容錯降級）+ 合成 fixtures"
```

---

### Task 4: rewrite.mjs 改編 prompt 融入搜尋詞

**Files:**
- Modify: `pipeline/rewrite.mjs`
- Test: `pipeline/rewrite.test.mjs`

- [ ] **Step 1: 寫失敗測試**

Create `pipeline/rewrite.test.mjs`:
```js
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test:pipeline`
Expected: FAIL（`promptFor` 未匯出 / undefined）。

- [ ] **Step 3: 修改 rewrite.mjs**

把 `pipeline/rewrite.mjs` 的 `promptFor` 改為接受 `searchTerms`、結尾加字詞段，並 export；`rewriteCandidates` 改為接受 `termsByCategory` 並取對應分眾字詞（取前 8 個 query 字串）：

```js
// pipeline/rewrite.mjs
import { askJson } from './claude.mjs';

export function promptFor(candidate, searchTerms = []) {
  const { doc, category, fullTextStr } = candidate;
  const termsBlock = searchTerms.length
    ? `

參考：使用者常以下列詞語在搜尋引擎尋找「${category.label}」相關資訊。改編 title 與開頭時，在貼切且不失真的前提下，自然融入與本篇判決主題相關的詞語（不得硬塞無關詞、不得為了塞詞而扭曲事實）：
${searchTerms.map((t) => `- ${t}`).join('\n')}`
    : '';
  return `你是台灣尊茂財務規劃公司的內容編輯。以下是一則真實法院判決，請改編成「${category.label}」分眾的客戶案例故事。

只輸出一個 JSON 物件（不要任何其他文字、不要 markdown 程式碼圍欄），欄位如下：
- title：字串，吸引人但不誇大、與內文金額/事實一致。
- body_markdown：字串，約 500–800 字繁體中文，結構為 困境 → 問題剖析 → 正確規劃做法 → 啟示，用 Markdown ## 小標。不要寫聯絡資訊或 CTA（系統會自動附加）。
- relevance_score：整數 1–5，此判決情境與「${category.label}」的契合度。
- quality_score：整數 1–5，故事完整性與可讀性。
- anonymization_ok：布林，是否確實完全化名、無殘留可辨識資訊。
- residual_identifiers：字串陣列，若有殘留可辨識資訊則列出，無則空陣列。

嚴格要求：
1. 完全化名：所有人物用化名（如陳小姐、王先生），不得出現任何真實姓名、公司全名、身分證、統一編號、電話、完整地址門牌。
2. 改編情節、不影射特定可辨識企業或個人，只取法律與財務情境骨架。

判決案由：${doc.JTITLE || ''}
判決字號（JID）：${doc.JID}
判決全文（節錄）：
${fullTextStr.slice(0, 12000)}${termsBlock}`;
}

// candidates 逐件呼叫 claude -p。termsByCategory 為 bucketize() 的輸出
// （{ categoryKey: [{query,...}] }）；每件取自身分眾前 8 個 query 字串。
export async function rewriteCandidates(candidates, termsByCategory = {}) {
  const out = new Map();
  for (let i = 0; i < candidates.length; i++) {
    const id = `cand-${i}`;
    const terms = (termsByCategory[candidates[i].category.key] || [])
      .slice(0, 8)
      .map((t) => (typeof t === 'string' ? t : t.query));
    try {
      out.set(id, await askJson(promptFor(candidates[i], terms)));
    } catch (e) {
      out.set(id, { error: String((e && e.message) || e) });
    }
  }
  return out;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test:pipeline`
Expected: PASS（含 2 個新 rewrite 測試）。`rewriteCandidates` 沿用舊呼叫（無第二參數）時 `termsByCategory` 預設空物件，行為等同舊版。

- [ ] **Step 5: Commit**

```bash
git add pipeline/rewrite.mjs pipeline/rewrite.test.mjs
git commit -m "feat(pipeline): 改編 prompt 可融入分眾搜尋詞（空則不含、向後相容）"
```

---

### Task 5: run.mjs 整合每日拉取

**Files:**
- Modify: `pipeline/run.mjs`

- [ ] **Step 1: 加 import**

在 `pipeline/run.mjs` 既有 import 區（`import { buildArticle, nextSlug } from './markdown.mjs';` 之後）加一行：
```js
import { fetchBucketedQueries } from './insights/queries.mjs';
```

- [ ] **Step 2: 啟動時拉一次並傳入改編**

在 `pipeline/run.mjs` 中，把：
```js
  const results = await rewriteCandidates(candidates);
```
改為：
```js
  const termsByCategory = await fetchBucketedQueries();
  log('GSC 字詞分流：', Object.entries(termsByCategory).map(([k, v]) => `${k}=${v.length}`).join(' '));
  const results = await rewriteCandidates(candidates, termsByCategory);
```

- [ ] **Step 3: 語法檢查**

Run: `node --check pipeline/run.mjs`
Expected: 無輸出（語法正確）。

- [ ] **Step 4: Commit**

```bash
git add pipeline/run.mjs
git commit -m "feat(pipeline): run 啟動時拉一次 GSC 字詞分流，傳入改編（容錯降級）"
```

---

### Task 6: dev-run.mjs 用 fixture 字詞離線驗證

**Files:**
- Modify: `pipeline/dev-run.mjs`

- [ ] **Step 1: 加 import**

在 `pipeline/dev-run.mjs` 既有 import 區（`import { FIXTURES } from './fixtures/judgments.mjs';` 之後）加：
```js
import { FIXTURE_QUERY_ROWS } from './insights/fixtures/queries.mjs';
import { bucketize } from './insights/buckets.mjs';
```

- [ ] **Step 2: 改編帶入 fixture 字詞**

在 `pipeline/dev-run.mjs` 中把：
```js
  const results = await rewriteCandidates(candidates);
```
改為：
```js
  const termsByCategory = bucketize(FIXTURE_QUERY_ROWS);
  log('GSC 字詞分流(fixture)：', Object.entries(termsByCategory).map(([k, v]) => `${k}=${v.length}`).join(' '));
  const results = await rewriteCandidates(candidates, termsByCategory);
```

- [ ] **Step 3: 語法檢查**

Run: `node --check pipeline/dev-run.mjs`
Expected: 無輸出。

- [ ] **Step 4: 離線實跑驗證（需 claude 已登入；非 0–6 點亦可，dev-run 不碰 API）**

Run: `node pipeline/dev-run.mjs`
Expected: log 顯示「GSC 字詞分流(fixture)：family=2 wealth-tax=2 ...」非全 0；產出的 `pipeline/quarantine/dev-*.md` 標題能看出有融入搜尋語言（如「遺產稅怎麼算」式用語）。若 claude 未登入則跳過此步、改由執行者稍後手動驗證。

- [ ] **Step 5: Commit**

```bash
git add pipeline/dev-run.mjs
git commit -m "feat(pipeline): dev-run 用 fixture GSC 字詞離線驗證改編融入"
```

---

### Task 7: insights 缺口分析純函式

**Files:**
- Create: `pipeline/insights/gap.mjs`
- Test: `pipeline/insights/gap.test.mjs`

- [ ] **Step 1: 寫失敗測試**

Create `pipeline/insights/gap.test.mjs`:
```js
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test:pipeline`
Expected: FAIL（`Cannot find module './gap.mjs'`）。

- [ ] **Step 3: 實作 gap.mjs**

Create `pipeline/insights/gap.mjs`:
```js
// pipeline/insights/gap.mjs
// 選題缺口：對每分眾，找出「其搜尋字詞中的分流命中詞，未出現在該分眾任何現有文章標題」的 query。
import { BUCKETS } from './buckets.mjs';

// bucketed: bucketize() 輸出；titlesByCat: { categoryKey: [title, ...] }
// 回傳 { categoryKey: [{ query, impressions }, ...] }（僅缺口；不含 _unbucketed）
export function gapAnalysis(bucketed, titlesByCat = {}) {
  const out = {};
  for (const cat of Object.keys(BUCKETS)) {
    const titles = titlesByCat[cat] || [];
    const rows = bucketed[cat] || [];
    out[cat] = rows.filter((row) => {
      const hitWords = BUCKETS[cat].filter((w) => (row.query || '').includes(w));
      // 命中詞若有任一出現在某現有標題 → 視為已涵蓋（非缺口）
      const covered = hitWords.some((w) => titles.some((t) => t.includes(w)));
      return !covered;
    }).map((row) => ({ query: row.query, impressions: row.impressions }));
  }
  return out;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test:pipeline`
Expected: PASS（含 2 個新 gap 測試）。

- [ ] **Step 5: Commit**

```bash
git add pipeline/insights/gap.mjs pipeline/insights/gap.test.mjs
git commit -m "feat(insights): 選題缺口分析純函式"
```

---

### Task 8: insights/run.mjs 接缺口報告 + README + 最終驗證

**Files:**
- Modify: `pipeline/insights/run.mjs`
- Modify: `pipeline/insights/README.md`

- [ ] **Step 1: run.mjs 加 import**

在 `pipeline/insights/run.mjs` 既有 import 區加：
```js
import { bucketize } from './buckets.mjs';
import { gapAnalysis } from './gap.mjs';
import { CATEGORIES } from '../config.mjs';
```

- [ ] **Step 2: 讀現有文章標題（依分眾）**

在 `pipeline/insights/run.mjs` 的 `main()` 內、`const { startDate, endDate } = windowDates();` 之後加入 helper 與呼叫：
```js
  // 依分眾收集現有文章標題（用 subcategory 對應 category.key）
  const subToKey = Object.fromEntries(CATEGORIES.map((c) => [c.subcategory, c.key]));
  const titlesByCat = {};
  try {
    const dir = 'src/content/articles';
    for (const f of await fs.readdir(dir)) {
      if (!f.endsWith('.md')) continue;
      const txt = await fs.readFile(`${dir}/${f}`, 'utf8');
      const sub = (txt.match(/^subcategory:\s*"?([^"\n]+)"?/m) || [])[1];
      const title = (txt.match(/^title:\s*(.+)$/m) || [])[1];
      const key = subToKey[sub];
      if (key && title) (titlesByCat[key] ||= []).push(title.trim());
    }
  } catch (e) { console.log('[insights] 讀文章標題失敗，缺口分析略過涵蓋比對:', e.message); }

（註：`insights/run.mjs` 開頭已 `import { promises as fs } from 'node:fs'`，直接用即可。）
```

- [ ] **Step 3: 由已拉的 query rows 分流並算缺口，加入報告**

`pipeline/insights/run.mjs` 既有程式已有 `queries`（GSC query 維度結果）。在組 `report` 陣列前加：
```js
  const bucketed = bucketize((queries.rows || []).map((r) => ({
    query: r.keys[0], clicks: r.clicks, impressions: r.impressions,
  })));
  const gaps = gapAnalysis(bucketed, titlesByCat);
  const gapSection = Object.entries(gaps)
    .map(([cat, rows]) => `### ${cat}\n` + (rows.length
      ? mdTable(['缺口字詞', '曝光'], rows.map((r) => [r.query, r.impressions]))
      : '（無缺口）'))
    .join('\n\n');
  const unbucketed = bucketed._unbucketed.length
    ? mdTable(['字詞', '曝光'], bucketed._unbucketed.map((r) => [r.query, r.impressions]))
    : '（無）';
```

然後在 `report` 陣列（`'## GA4 熱門頁（站內瀏覽）'` 區塊之後、最後的 `''` 之前）插入：
```js
    '## ③ 選題缺口（有人搜、站上分眾文章標題未涵蓋）',
    gapSection,
    '',
    '## 未分類搜尋詞（潛在全新主題線索）',
    unbucketed,
    '',
```

- [ ] **Step 4: 語法檢查 + 實跑**

Run: `node --check pipeline/insights/run.mjs && node pipeline/insights/run.mjs`
Expected: 無語法錯誤；報告產出含「③ 選題缺口」與「未分類搜尋詞」區塊（現階段資料為 0，區塊顯示「無缺口」/「無」屬正常，重點是不報錯、結構正確）。

- [ ] **Step 5: 更新 README 金鑰部署說明**

在 `pipeline/insights/README.md` 的「## 認證」段末尾加一段：
```markdown

### judgment pipeline 即時拉 GSC（②）

判決 pipeline（`pipeline/run.mjs`）每次啟動會拉一次 GSC 字詞融入改編。**在 server 跑判決 pipeline 時，需把同一把 service account 金鑰部署到 server 的 `pipeline/.secrets/ga4-insights.json`**（或設 `GOOGLE_INSIGHTS_KEY` 指向絕對路徑）。拉取失敗會自動降級為「無字詞」，判決照常發佈。
```

- [ ] **Step 6: 全測試 + Commit**

Run: `pnpm test:pipeline`
Expected: 全部 PASS。
```bash
git add pipeline/insights/run.mjs pipeline/insights/README.md
git commit -m "feat(insights): 報告加選題缺口+未分類字詞區塊；README 補 server 金鑰"
```

---

## 完成後

- 合併分支 `feature/gsc-insights-integration` 回 main 並 push（沿用專案 `--no-ff` 慣例）。
- 真實資料累積後，於 server 以真實 GSC 字詞跑判決 pipeline 與 `pnpm insights` 實證 ②③ 效果。
