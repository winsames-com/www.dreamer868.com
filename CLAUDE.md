# 尊茂財務規劃網站 (www.dreamer868.com)

## 專案概述

台中尊茂財務規劃公司的官方網站，以 Astro 靜態網站產生器建置，部署於 GitHub Pages。

本 repo 同時承載三塊：(1) **Astro 網站**本體；(2) **判決 pipeline**（`pipeline/`，每日自動抓司法院判決改編成案例故事並發佈）；(3) **內容洞察 insights**（`pipeline/insights/`，拉 GA4 + Search Console 資料供選題/改標題）。下方各有專節，詳細操作見 `pipeline/README.md`、`pipeline/OPERATIONS.md`、`pipeline/insights/README.md`。

## 技術棧

- **框架**: Astro 6.x（靜態輸出）
- **套件管理**: pnpm
- **部署**: GitHub Pages（自動 CI/CD）
- **網域**: www.dreamer868.com（CNAME → winsames-com.github.io）

## 目錄結構

```
src/
├── content/articles/   # Markdown 文章內容（各服務分類）
├── components/         # Astro 元件（Header, Footer, ArticleCard 等）
├── data/navigation.ts  # 導覽列、聯絡資訊集中管理
├── layouts/            # BaseLayout（含 SEO meta）、ArticleLayout
├── pages/              # 路由頁面
│   ├── articles/[...slug].astro  # 文章動態路由
│   ├── services/       # 各服務分類頁
│   └── 404.astro
└── styles/             # global.css、variables.css
public/
├── CNAME               # GitHub Pages 自訂網域
├── robots.txt          # 搜尋引擎爬取指引
└── favicon.*
pipeline/               # 判決 pipeline（每日 cron 自動產文）
├── run.mjs             # 全流程編排（entry point）
├── rewrite.mjs         # claude -p 改編引擎
├── verify.mjs          # 獨立 claude -p 查核關卡（第二關）
├── guard.mjs           # 化名正則掃描 + 閘門邏輯（第一關）
├── classify/jid/courts/markdown/state.mjs  # 分類、JID 解析、法院名、frontmatter、帳本
├── judicial.mjs        # 司法院 API client（自帶公共 DNS 繞過）
├── cron.sh             # cron 包裝（載 .env → run → commit+push）
├── fixtures/ dev-run.mjs  # 離線開發（不碰 API）
├── quarantine/         # 未過閘門的草稿（gitignore 內容）
└── insights/           # GA4 + Search Console 內容洞察子系統
docs/                   # 文章素材與規劃（superpowers/ 為 specs/plans）
```

## 常用指令

```bash
pnpm dev        # 本地開發
pnpm build      # 建置靜態檔案
pnpm preview    # 預覽建置結果

pnpm test:pipeline   # pipeline 純函式單元測試（不碰網路/claude）
pnpm insights:probe  # 測 GA4/GSC 授權與連線
pnpm insights        # 拉資料產內容洞察報告
```

## CI/CD 流程

`.github/workflows/deploy.yml` 定義三階段：
1. **build** — pnpm install + build
2. **deploy** — 部署到 GitHub Pages
3. **verify** — 從 sitemap 檢查所有 URL 回應 200

## SEO/AEO 配置

- BaseLayout 已內建：canonical URL、Open Graph、Twitter Card、BreadcrumbList JSON-LD
- 首頁：FinancialService JSON-LD
- 文章頁：Article JSON-LD
- sitemap 由 @astrojs/sitemap 自動產生

## 判決 pipeline（`pipeline/`）

每日 cron（**台灣 01:00**，落在司法院 API 服務窗 0–6 點）自動跑：

> auth → JList(7 日內異動) → 字別預過濾(民事 V/行政 A) → 比對帳本去重 → JDoc 取全文 → 關鍵字分類 → 每分眾上限 → `claude -p` 改編 → **第一關**(化名正則+自評) → **第二關**(獨立 `claude -p` 查核 anonymization/faithful/relevant/worthiness) → 過關寫檔 git commit+push（觸發部署）／不過關進 `quarantine/`

- **用訂閱帳戶的 `claude -p`，不走 Anthropic API 計費**（model `claude-sonnet-4-6`）。
- 上限：每分眾每日 ≤1 篇、全站每日 ≤4 篇（`config.mjs` 的 `LIMITS`）；每件最多 2 次 `claude -p`（改編+查核），每日 ≤8 次。
- **DNS 坑**：系統 DNS 對 `*.judicial.gov.tw` 回 SERVFAIL；`judicial.mjs` 用 node:https + 自訂 lookup 走公共 DNS（1.1.1.1/8.8.8.8），勿改回系統 DNS。
- 機密在 `pipeline/.env`（`JUD_USER`/`JUD_PASS`、server 認證用 `CLAUDE_CODE_OAUTH_TOKEN`），已 gitignore。
- 首次驗證設 `DRY_RUN=1` 於台灣 0–6 點跑 `pipeline/cron.sh`；離線開發跑 `node pipeline/dev-run.mjs`（用 fixtures，不碰 API/不發佈）。
- 詳細部署與排錯見 `pipeline/README.md`、`pipeline/OPERATIONS.md`。

## 內容洞察 insights（`pipeline/insights/`）

用 Google service account 拉 **Search Console 搜尋字詞 + GA4 站內行為**，唯讀、不寫網站、不 commit 報告。

- service account `ga4-insights@yaocare.iam.gserviceaccount.com`；金鑰 `pipeline/.secrets/ga4-insights.json`（**已 gitignore，絕不進 repo**，換機器放同路徑或設 `GOOGLE_INSIGHTS_KEY`）。
- 資源：GA4 property `541900210`（Measurement ID `G-YE9TBVK70Y`）、Search Console `sc-domain:dreamer868.com`。
- 報告產到 `pipeline/insights/reports/`（gitignore）：搜尋字詞 Top、搜尋到達頁、GA4 熱門頁、**選題缺口 + 未分類字詞**。
- **與判決 pipeline 整合**：`run.mjs` 啟動時拉一次 GSC 字詞融入改編 prompt（拉取失敗自動降級為無字詞，判決照常發佈）。→ 在 server 跑判決 pipeline 也要部署同一把金鑰。
- **現況**：GA4/GSC 為 2026-06-16 才上線的新資源，授權/連線已驗證 OK，但**需數日累積才有資料**（GSC API 另約延遲 2–3 天）。

## 注意事項

- 沒有 base path，所有內部連結直接用絕對路徑（如 `/contact`）
- 聯絡表單為 mailto fallback（無後端）
- `source/` 目錄是舊網站爬取的素材，已加入 .gitignore
- 文章圖片來源：Pexels（需保留 credit）、doing-housework.com（公司自有圖片）
