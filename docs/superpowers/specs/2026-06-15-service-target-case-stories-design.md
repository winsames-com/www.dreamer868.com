# 服務對象案例故事系列 — 設計文件

- 日期：2026-06-15
- 專案：www.dreamer868.com（尊茂財務規劃官網，Astro 6.x 靜態站）
- 狀態：設計定稿，待實作

## 1. 目標

為四個服務對象分眾各建立一個「客戶案例故事」系列，以一天一篇的節奏（內容量目標，非排程機制）持續累積。故事改編自**真實法院判決**，全部化名、改編情節並附免責聲明。

四個分眾：
- 個人財務規劃（personal）
- 家庭財務規劃（family）
- 公司財務規劃（corporate）
- 財富稅務規劃（wealth-tax）

## 2. 關鍵決策彙整

| 項目 | 決策 |
|------|------|
| 「一天一篇」 | 僅為內容量／節奏目標，**不需任何排程機制**；文章寫好直接 commit 上線 |
| 導覽結構 | 方案 A：擴充既有「服務對象」為兩層下拉（不另開平行 nav，避免語意重複）|
| 內容型態 | 客戶案例故事，**改編自真實法院判決** |
| 真實性定位 | 化名代表性案例：化去身份、可綜合多例、附免責 |
| 首批交付 | 結構 + 每分眾 1 篇範例（共 4 篇）|

## 3. 導覽結構（`src/data/navigation.ts`）

「服務對象」改為下拉，父項仍指向 `/service-targets`：

```
服務對象  /service-targets                 ← 總覽 hub
  ├ 個人財務規劃  /service-targets/personal
  ├ 家庭財務規劃  /service-targets/family
  ├ 公司財務規劃  /service-targets/corporate
  └ 財富稅務規劃  /service-targets/wealth-tax
```

沿用既有「服務項目」的 `children` 下拉模式，無需新增導覽元件。

## 4. 內容分類（content collection）

### 4.1 新增四個 subcategory

- `personal-stories`
- `family-stories`
- `corporate-stories`
- `wealth-tax-stories`

### 4.2 重用既有四篇介紹文為各系列「導讀文」（order: 1）

避免內容重複，把現有四篇分眾介紹文改 subcategory：

| 現有檔 | 標題 | 新 subcategory | order |
|--------|------|----------------|-------|
| service-targets-02.md | 個人財務規劃 | personal-stories | 1 |
| service-targets-03.md | 家庭財務規劃 | family-stories | 1 |
| service-targets-04.md | 公司財務規劃 | corporate-stories | 1 |
| service-targets-05.md | 財富稅務規劃 | wealth-tax-stories | 1 |

（注意：導讀文 order 維持原值 2〜5 亦可，列表頁以 order 排序，導讀文排在案例故事 order:10+ 之前即可；本計畫統一將導讀文設為 order:1、案例故事自 order:10 起。）

`service-targets-01.md`（服務對象介紹）維持 `subcategory: service-targets`，作為 hub 的總覽引文。其 slug／URL 不變。

## 5. 頁面

### 5.1 改寫 `src/pages/service-targets.astro` → 總覽 hub

- 版面：`BaseLayout` + `PageBanner` + 4 張卡片
- 卡片資料來源：查詢四個系列的 `order: 1` 導讀文（title／hero 圖／alt），重用既有 `ArticleCard`，但 `href` 指向系列頁（`/service-targets/{target}`）而非文章頁
- 頂部引文：簡短說明 + 連到 `service-targets-01`（完整服務對象介紹）

### 5.2 新增四個系列列表頁 `src/pages/service-targets/{target}.astro`

四個明確檔案（對齊 `src/pages/services/` 既有「一服務一檔」模式）：
- `personal.astro` / `family.astro` / `corporate.astro` / `wealth-tax.astro`

每頁以既有 `CategoryPage` 元件，過濾自己的 subcategory 並列出該分眾所有文章（導讀文 order:1 在前，案例故事 order:2+ 隨後）。`description` 帶一句免責聲明（涵蓋直接搜尋落地的訪客）。

## 6. Schema 變更（`src/content.config.ts`）

新增兩個 optional 欄位（不影響既有文章）：

```ts
caseStory: z.boolean().optional(),   // 是否為判決改編案例
caseSource: z.string().optional(),   // 參考判決字號，如「臺灣高等法院 101 年度上易字第 797 號」
```

## 7. 免責機制（`src/layouts/ArticleLayout.astro`）

- 新增 props：`caseStory?: boolean`、`caseSource?: string`
- `[...slug].astro` 把這兩欄位傳入 ArticleLayout
- 當 `caseStory === true`：於文章正文（`.prose`）上方渲染免責提示框，內容：

  > 本文改編自真實法院判決，為保護當事人隱私，人物均為化名、情節經改編，僅供財務規劃情境參考，不構成法律或稅務意見。

- 若有 `caseSource`，於免責框內或文末顯示「參考判決：{caseSource}」

## 8. 案例故事寫作規範

每篇案例故事 frontmatter 需含（沿用既有 schema 全部必填欄位）：
- `caseStory: true`、`caseSource: "<字號>"`
- `subcategory: <該系列>`、`order: 2`（含以上）
- `category: 服務對象`、`author: Writer`、`status: draft`、`version: 1`、`task`、`section: "new"`
- `images.hero`：Pexels 圖 + 完整 credit（沿用既有慣例）
- `slug`：`{target}-story-NN`（如 `personal-story-01`）

內文結構（沿用既有文章調性）：
1. Hero 圖 + credit
2. 困境（化名主角遇到的財務／法律問題）
3. 問題剖析（為何會發生、一般人忽略的盲點）
4. 規劃過程（尊茂如何協助／正確做法）
5. 結果與啟示
6. CTA + 聯絡資訊（電話 0909-230140、email、地址，沿用既有結尾）

寫作紅線：
- **完全化名、改編情節**，不影射特定可辨識企業或個人（知名案件如三民書局、味王僅取法律情境骨架）
- 字號正式採用前須核對判決全文（見第 10 節）

## 9. 首批範例內容（4 篇，每分眾 1 篇）

| slug | 分眾 | 故事主題 | 參考字號 |
|------|------|----------|----------|
| wealth-tax-story-01 | 財富稅務 | 生前未規劃贈與，子女繼承少卻背鉅額遺產稅 | 113 年憲判字第 11 號 |
| corporate-story-01 | 公司 | 家族企業股權借名登記沒寫清楚，出名人奪經營權興訟 | 最高法院 112 年度台上字第 610 號（併參臺灣高等法院 101 年度上易字第 797 號）|
| personal-story-01 | 個人 | 保險受益人填「法定繼承人」，拋棄繼承後分配生爭議 | 臺北地院 95 年度保險簡上字第 11 號 |
| family-story-01 | 家庭 | 遺產房產無法實物分割，法院判變價拍賣，手足失和 | 遺產分割變價分割實務（字號待核全文確認）|

## 10. 資料來源與查證流程

- **官方檢索（人工挑案／核全文）**：司法院法學資料檢索系統 FJUD `https://law.judicial.gov.tw/FJUD/`
  - 註：FJUD 對開發環境出口 IP 連線被拒；由使用者於台灣本機瀏覽器取得全文後提供
- **開放資料 API**（`https://data.judicial.gov.tw/jdg/api/`，需平臺帳號 + Token，僅每日 00:00–06:00 服務，且只能取「7 日前異動清單」非主題搜尋）→ 不適合本用途
- **授權**：政府資料開放授權條款第 1 版（每日更新、免費、可商業利用與改作；正式使用前再核條款全文）
- 查證原則：每篇正式發布前，`caseSource` 字號須核對判決全文，確認情節改編無誤

## 11. 驗證

- 本地 `pnpm build` 必須通過（content schema 驗證新欄位與四篇新文）
- 確認產出：4 個系列頁 + hub 改寫頁 + 4 篇新文 + 4 篇導讀文改類後皆正常
- CI `verify` job 部署後從 sitemap 檢查所有 URL 回應 200

## 12. 影響檔案清單

新增：
- `src/pages/service-targets/personal.astro`
- `src/pages/service-targets/family.astro`
- `src/pages/service-targets/corporate.astro`
- `src/pages/service-targets/wealth-tax.astro`
- `src/content/articles/personal-story-01.md`
- `src/content/articles/family-story-01.md`
- `src/content/articles/corporate-story-01.md`
- `src/content/articles/wealth-tax-story-01.md`

修改：
- `src/data/navigation.ts`（服務對象下拉）
- `src/pages/service-targets.astro`（改寫為 hub）
- `src/content.config.ts`（新增 caseStory / caseSource）
- `src/layouts/ArticleLayout.astro`（免責框 + 字號）
- `src/pages/articles/[...slug].astro`（傳遞新 props）
- `src/content/articles/service-targets-02.md`〜`05.md`（改 subcategory）

---

# Part B：每日判決擷取 pipeline

## B1. 目標與決策

每日自動擷取最新相關判決，化名改編成案例故事並全自動發佈。內建強制防護，寧缺勿濫（信心不足即隔離，不誤發）。

| 項目 | 決策 |
|------|------|
| 自動化程度 | 全自動發佈（含強制防護閘門）|
| 執行環境 | GitHub Actions cron |
| 發佈節奏 | 有合格就發；上限：每分眾每日 ≤ 1 篇、全站每日 ≤ 4 篇 |
| 配圖 | 每分眾一張固定 hero 圖（4 張，重複使用，附 credit）|
| 改編模型 | Claude API，Sonnet 4.6（法律改編品質要求高，可升 Opus）|

## B2. 資料流

1. GitHub Actions cron（17:00 UTC = 台灣 01:00，落在 API 服務窗 0–6 時）
2. `Auth` 換 Token（6 小時有效）
3. `JList` 取當日（7 日前）異動 JID 清單
4. 用 JID 內含「字別」**預過濾**（繼承／家事／稅／保險／股權），縮小範圍
5. 對命中 JID 呼叫 `JDoc` 取全文
6. 關鍵字相關性確認 + 分類到四分眾 + 評分
7. 去重：比對 `seen-jids.json` 帳本
8. Claude API 化名改編成故事（符合 Part A 第 8 節寫作規範）
9. **防護閘門**：
   - 化名殘留掃描（人名／公司名／地址／可辨識資訊）→ 不過則隔離
   - 相關性／品質評分低於門檻 → 隔離
   - 通過 → 產出 `.md`（含 `caseStory: true` / `caseSource: <字號>`）
10. commit + push → 觸發既有 `deploy.yml` 自動建置上線
11. 隔離項目寫入 `pipeline/quarantine/` + job summary（選配 Slack 通知）

## B3. 元件與檔案

新增：
- `pipeline/fetch.ts` — Auth → JList → 字別預過濾 → JDoc 抓全文
- `pipeline/classify.ts` — 相關性確認 + 四分眾分類 + 評分
- `pipeline/rewrite.ts` — 呼叫 Claude API 化名改編，產出符合 schema 的 .md
- `pipeline/guard.ts` — 化名殘留掃描 + 品質閘門
- `pipeline/config.ts` — 四分眾字別碼 + 關鍵字 + 門檻 + 每日上限
- `pipeline/state/seen-jids.json` — 已處理 JID 帳本（commit 回 repo 防重複）
- `pipeline/quarantine/` — 未過閘門的草稿暫存
- `.github/workflows/judgment-pipeline.yml` — cron 排程工作流

## B4. 防護閘門細則（全自動但安全）

- **化名強制檢查**：發佈前正則 + LLM 掃描殘留人名／公司全名／身分證／地址／可辨識細節；命中即隔離
- **相關性閘門**：LLM 評分判決是否真屬該分眾財務情境，低分隔離
- **品質閘門**：LLM 評分故事完整性（困境→剖析→規劃→啟示結構），低分隔離
- **免責永遠附帶**：套用 Part A 的 `caseStory` 機制，每篇強制掛免責框 + 字號
- **保守失敗**：任一步例外或信心不足 → 隔離，絕不誤發

## B5. 前置條件（使用者準備）

- 「司法院資料開放平臺」註冊帳號 → GitHub secrets `JUD_USER` / `JUD_PASS`
- `ANTHROPIC_API_KEY` → GitHub secret
- 〔選配〕Slack webhook URL → secret（隔離／錯誤通知）

## B6. 待實作期驗證的風險

- **Actions runner IP 連線**：本環境（雲端）可達 `data.judicial.gov.tw`（回 405＝可連）；gov 站可能地域限制，計畫**第一步先在 Actions 實測 API 連線**，失敗則改用 self-hosted runner（台灣）或使用者本機 cron 備案
- **字別碼對應**：四分眾精確「字別」清單需查證後寫入 `config.ts`（以候選研究為種子）
- **API 服務窗**：僅 0–6 時提供，cron 時間須精準落在窗內並含重試

## B7. Pipeline 驗證

- 乾跑（dry-run）模式：抓取＋過濾＋改編＋閘門全跑，但不 commit，輸出到 `quarantine/` 供檢視
- 確認帳本去重、閘門隔離、免責掛載皆正常後，才開啟自動 commit
- 首次正式啟用建議連續觀察數日輸出品質
