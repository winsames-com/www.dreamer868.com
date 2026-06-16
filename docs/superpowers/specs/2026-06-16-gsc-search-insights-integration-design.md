# GSC 搜尋資料整合設計（②改編措辭 + ③選題缺口）

日期：2026-06-16
狀態：設計已同意，待寫實作計畫

## 目標

把 Search Console 的真實搜尋字詞接進判決案例故事的產製流程，達成兩件事：

- **②（改編措辭）**：判決 pipeline 改編某篇判決時，參考「該分眾熱門搜尋詞」，讓文章標題／開頭／SEO 描述更貼近使用者實際在搜的語言，提升被搜到與被點擊的機會。
- **③（選題缺口）**：在 insights 報告中比對「有人搜的主題」與「站上已有文章」，標出缺口主題，供人（或未來流程）決定要補寫什麼。

## 非目標（明確排除）

- **不做 ①「回寫判決分類關鍵字」**：經討論排除。`config.mjs` 的 classify `keywords` 比對的是判決書法律用語，而 GSC 字詞是使用者口語，灌進去會污染分類、打亂「每天選哪篇判決」這個 pipeline 核心，風險高且效果不確定。
- 本設計**完全不改動判決分類邏輯**（`classify.mjs` 與 `config.mjs` 的 classify keywords 不動）。

## 背景（現況）

- 判決 pipeline 流程：`抓判決 → classify.mjs 分類挑出 → rewrite.mjs 用 claude -p 改編 → 雙關卡 → 發佈`。
- insights pipeline（`pipeline/insights/`）已建：service account 唯讀拉 GSC（`sc-domain:dreamer868.com`）+ GA4（property 541900210），`auth.mjs` 提供共用認證與 REST。
- **資料現況為 0**：GA4 於 2026-06-16 才換上線、GSC 網域為新資源，需時間累積。故本功能用合成 fixture 開發，等真實資料進來再實證。

## 架構與元件

| 元件 | 新/改 | 職責 |
|---|---|---|
| `pipeline/insights/buckets.mjs` | 新 | 四分眾的**分流關鍵字表**（口語＋法律混合詞），獨立於 `config.mjs` classify keywords，**不影響判決分類** |
| `pipeline/insights/queries.mjs` | 新 | **共用核心**：拉 GSC top queries → 用 buckets 分流 → 回傳 `{ 'wealth-tax':[...], family:[...], corporate:[...], personal:[...], _unbucketed:[...] }`。每筆含 `{ query, clicks, impressions }`。judgment 與 insights 共用 |
| `pipeline/insights/fixtures/queries.mjs` | 新 | 合成 GSC 字詞（無真實個資），供離線開發/測試 |
| `pipeline/rewrite.mjs` | 改 | prompt 增加「本分眾熱門搜尋詞；改編標題/開頭時，自然融入與本篇判決主題相關的詞，不得硬塞無關詞」 |
| `pipeline/run.mjs` | 改 | run 啟動時拉一次全站 queries 並分流；改編每篇時取對應分眾字詞傳入 rewrite |
| `pipeline/insights/run.mjs` | 改 | 報告新增「③選題缺口」區塊 |
| `pipeline/insights/README.md` | 改 | 補：judgment pipeline 即時拉 GSC 需在 server 部署金鑰 |

## 資料流

### ②（每天，在 server 跑判決 pipeline 時）

1. `run.mjs` 啟動 → 呼叫 `queries.mjs` 拉一次 GSC 全站 top queries → 分流到四分眾（**整個 run 只拉一次**，不是每篇拉）。
2. 對每篇通過分類的判決，取其分眾對應的字詞清單，傳入 `rewrite.mjs`。
3. `rewrite.mjs` 把字詞放進 prompt，要求 claude 改編標題/開頭時自然融入「與本篇相關」的搜尋詞。

### ③（手動或每週）

1. `insights/run.mjs` 呼叫同一個 `queries.mjs` 分流。
2. 比對各分眾的 top 搜尋詞 vs 站上該 subcategory 現有文章標題。
3. 報告標出「高曝光但站上無對應文章」的主題；並列出 `_unbucketed`（落不進任何分眾的 query）作為全新主題線索。

## 容錯（關鍵原則）

搜尋資料是「錦上添花」，**絕不可阻斷判決發佈主流程**：

- GSC 拉取失敗 / 逾時 / 回空資料 → `queries.mjs` 回傳各分眾為空陣列。
- `rewrite.mjs` 收到空字詞 → prompt **不含**字詞段，判決照常改編、照常走雙關卡、照常發佈。
- 所有降級都寫 log（例如 `[pipeline] GSC 字詞拉取失敗，本次改編不含搜尋詞`）。

## 分流關鍵字策略（方案 B 的核心）

- `buckets.mjs` 用**比 classify keywords 更寬的口語詞**分流，提高命中率。範例：
  - family：繼承、遺產、分家產、留給子女、特留分、贍養、監護
  - wealth-tax：遺產稅、贈與稅、節稅、課稅、實質課稅
  - corporate：股權、借名登記、經營權、董事、公司分割
  - personal：保險、受益人、連帶保證、本票、債務
- query 含某分眾任一分流詞即歸該分眾；可同時落入多分眾（字詞可重複參考，無害）。
- 落不進任何分眾的 query → 歸 `_unbucketed`，**不丟棄**，供③當新主題線索。
- 分流字詞**只決定字詞給哪個分眾參考**，完全不影響判決選擇，故放寬很安全。

## 測試

- **單元測試**（`pipeline/insights/queries.test.mjs`）：給定 query 清單 + buckets → 驗證分流結果正確、`_unbucketed` 收容落單者。
- **容錯測試**：模擬 GSC 回空 → 驗證 `queries.mjs` 回空結構、rewrite prompt 不含字詞段。
- **離線 dev-run**：用 `fixtures/queries.mjs` 跑判決 dev-run，確認 prompt 帶入字詞、產出標題確實融入相關詞。
- 既有 `pnpm test:pipeline` 涵蓋純函式測試，新測試併入。

## 開發方式

資料現為 0，採與判決 pipeline 一致的 fixture 離線開發：先用合成字詞把功能做完、跑通 dev-run 與單元測試；待 GSC 累積真實資料後，於 server 以真實字詞實證。

## 金鑰部署

judgment pipeline 在 server 即時拉 GSC，需把 service account 金鑰部署到 server 的 `pipeline/.secrets/ga4-insights.json`（或設 `GOOGLE_INSIGHTS_KEY` 指向路徑）。README 補充此步驟。

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| GSC 故障拖垮每日發佈 | 容錯降級：拉取失敗即無字詞，主流程不受影響 |
| claude 硬塞無關搜尋詞進標題 | prompt 明確要求「只融入與本篇相關者，不得硬塞」；雙關卡的忠實性查核把關 |
| 口語 query 分流命中率低 | buckets 用寬鬆口語詞；落單者進 `_unbucketed` 不丟失 |
| 分流字詞被誤認為會改判決分類 | buckets 與 classify keywords 完全分離，文件明示 |
