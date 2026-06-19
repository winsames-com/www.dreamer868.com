# 尊茂財務規劃網站 (www.dreamer868.com)

> 本檔（`CLAUDE.md`）與根目錄 `README.md` **內容對齊**：不論 AI/維護者讀哪一份，都能正確分流到「開發優化」或「內容營運」兩種情境並找到對應指令與細節文件。改了其中一份的路由表，請同步另一份。

## 專案概述

台中尊茂財務規劃公司的官方網站，以 Astro 靜態網站產生器建置，部署於 GitHub Pages。

本 repo 同時承載三塊：(1) **Astro 網站**本體；(2) **判決 pipeline**（`pipeline/`，每日自動抓司法院判決改編成案例故事並發佈，已上線）；(3) **內容洞察 / 品管**（`pipeline/insights/` 拉 GA4 + Search Console 看曝光；`pipeline/checkup/` 每日稽核產出品質）。

## § 兩種維護情境（先讀這裡分流）

維護工作分兩種使用情境，先判斷你屬於哪一種，再進對應章節 / 文件：

### 情境 A — 開發人員「優化、更新本專案」（工程）
改網站本體、版面樣式、SEO/AEO 結構、CI、或 pipeline 程式碼。

| 想做的事 | 動哪裡 | 指令 / 文件 |
|---|---|---|
| 本地開發、改版面/元件/頁面 | `src/`（components/layouts/pages/styles/data） | `pnpm dev` → `pnpm build` |
| 改導覽列、聯絡資訊、作者 E-E-A-T | `src/data/navigation.ts`（含 `principalAuthor`） | — |
| 改 SEO/AEO 結構化資料 | `src/layouts/BaseLayout.astro`、`ArticleLayout.astro`、`src/pages/llms.txt.ts`、`rss.xml.ts` | 見下「SEO/AEO 配置」 |
| 替既有文章補 meta description / FAQ | `scripts/gen-descriptions.mjs`、`scripts/gen-faq.mjs` | 見下「GEO/AEO 腳本」 |
| 改 CI/部署流程 | `.github/workflows/deploy.yml` | 見下「CI/CD 流程」 |
| 維護判決 pipeline 程式 | `pipeline/*.mjs` | `pnpm test:pipeline`；細節 `pipeline/README.md` |

### 情境 B — 「增加內容、了解網路曝光量」（內容營運）
讓更多文章上站，並用搜尋/流量數據回饋選題。

| 想做的事 | 動哪裡 | 指令 / 文件 |
|---|---|---|
| 自動產判決案例故事（每日 cron，已上線） | `pipeline/` | `pipeline/OPERATIONS.md`（運作+上線 runbook）、`pipeline/README.md` |
| 手動新增文章 | 寫 md 進 `src/content/articles/`，或放 `docs/` 後 `node scripts/prepare-content.mjs` | **新文章記得補** `gen-descriptions` + `gen-faq`（見下） |
| 看「使用者搜什麼、看什麼」做選題 | `pipeline/insights/`（GA4 + Search Console） | `pnpm insights`；細節 `pipeline/insights/README.md` |
| 看每日 pipeline 產出品質/趨勢 | `pipeline/checkup/`（每日稽核報告，本機私有不 push） | `pipeline/checkup/README.md` |
| 加速搜尋引擎/AI 收錄新頁 | `scripts/indexnow-submit.mjs`（CI 已自動，亦可手動） | 見下「GEO/AEO 腳本」 |

> 機密憑證一律在 `pipeline/.env`、`pipeline/.secrets/`（皆 gitignore，**絕不進 repo**）。本機/伺服器部署的 cron 時間、deploy key 等屬機器專屬設定，不寫進這個 public repo。

## 技術棧

- **框架**: Astro 6.x（靜態輸出）
- **套件管理**: pnpm（Node ≥ 22.12）
- **部署**: GitHub Pages（自動 CI/CD）
- **網域**: www.dreamer868.com（CNAME → winsames-com.github.io）

## 目錄結構

```
src/
├── content/articles/   # Markdown 文章內容（各服務分類，含判決案例故事）
├── components/         # Astro 元件（Header, Footer, ArticleCard 等）
├── data/navigation.ts  # 導覽列、聯絡資訊、principalAuthor（作者 E-E-A-T）集中管理
├── layouts/            # BaseLayout（SEO/JSON-LD）、ArticleLayout（Article/FAQPage JSON-LD）
├── pages/              # 路由頁面
│   ├── articles/[...slug].astro  # 文章動態路由
│   ├── service-targets/  # 四分眾案例列表頁（自動撈 content collection）
│   ├── services/       # 各服務分類頁
│   ├── author/         # 作者頁（Person + ProfilePage）
│   ├── llms.txt.ts     # /llms.txt（AI 引擎索引，自動產）
│   ├── rss.xml.ts      # /rss.xml
│   └── 404.astro
└── styles/             # global.css、variables.css
scripts/                # 一次性 / CI 內容工具（情境 A、B 共用）
├── prepare-content.mjs    # docs/ → content collection（補 frontmatter）
├── gen-descriptions.mjs   # claude -p 替文章產 meta description（冪等）
├── gen-faq.mjs            # claude -p 產 FAQ frontmatter（→ FAQPage JSON-LD）
├── indexnow-submit.mjs    # 提交變動 URL 給 IndexNow（CI 部署後自動呼叫）
└── publish-from-cache.mjs / retest-failed.mjs  # 判決快取重跑工具
public/
├── CNAME / robots.txt / favicon.* / <indexnow-key>.txt
pipeline/               # 判決 pipeline（每日 cron 自動產文，已上線）
├── run.mjs             # 全流程編排（entry point）
├── rewrite.mjs         # claude -p 改編引擎（同時產 description + faq）
├── verify.mjs          # 獨立 claude -p 查核關卡（第二關）
├── guard.mjs           # 化名正則掃描 + 閘門邏輯（第一關）
├── classify/jid/courts/markdown/state.mjs  # 分類、JID 解析、法院名、frontmatter、帳本
├── judicial.mjs        # 司法院 API client（自帶公共 DNS 繞過）
├── cron.sh             # cron 包裝（載 .env → run → commit+push）
├── fixtures/ dev-run.mjs  # 離線開發（不碰 API）
├── quarantine/         # 未過閘門的草稿（gitignore 內容）
├── insights/           # GA4 + Search Console 內容洞察子系統（看曝光）
└── checkup/            # 每日品管稽核（讀 log 產報告，本機私有不 push）
docs/                   # 文章素材與規劃（superpowers/ 為 specs/plans）
```

## 常用指令

```bash
# 情境 A：開發 / 建置
pnpm dev        # 本地開發
pnpm build      # 建置靜態檔案
pnpm preview    # 預覽建置結果
pnpm test:pipeline   # pipeline + checkup 純函式單元測試（不碰網路/claude）

# 情境 A：替既有文章補 GEO/AEO 欄位（需 claude 已登入）
node scripts/gen-descriptions.mjs [--limit N] [--dry]   # 補 meta description
node scripts/gen-faq.mjs [--limit N] [--dry]            # 補 FAQ

# 情境 B：內容 / 曝光
node scripts/prepare-content.mjs   # 把 docs/ 轉成 content collection 文章
node pipeline/dev-run.mjs          # 離線跑判決 pipeline（fixtures，不碰 API/不發佈）
pnpm insights:probe                # 測 GA4/GSC 授權與連線
pnpm insights                      # 拉資料產內容洞察報告
node pipeline/checkup/run.mjs      # 立即產一次每日品管報告
```

## CI/CD 流程

`.github/workflows/deploy.yml` 定義四個 job（依序 needs）：
1. **build** — pnpm install + build
2. **deploy** — 部署到 GitHub Pages
3. **verify** — 從 sitemap 檢查所有 URL 回應 200
4. **indexnow** — 依本次 commit 變動的頁面提交 IndexNow（Bing→ChatGPT Search/Copilot 加速收錄）

## SEO/AEO 配置

- BaseLayout 每頁內建：canonical URL、Open Graph、Twitter Card、BreadcrumbList + Organization/FinancialService(@id) + WebSite JSON-LD。
- 首頁：FinancialService JSON-LD；文章頁：Article + （有 `faq:` 時）FAQPage JSON-LD；作者頁：Person + ProfilePage。
- 作者 E-E-A-T：`src/data/navigation.ts` 的 `principalAuthor`（吳芳圳｜財務醫師）集中管理，所有文章自動掛具名作者。
- `/llms.txt`、`/rss.xml`、`robots.txt`（明確歡迎 AI 爬蟲）、sitemap（`@astrojs/sitemap` 自動產，含 changefreq/priority）。

## GEO/AEO 腳本（`scripts/`）

讓 LLM/AI 答題引擎更願意引用本站。判決 pipeline 產的新文章已「出生即完整」（`rewrite.mjs` 一併產 description + faq）；**手動新增的文章需補跑**：

- `node scripts/gen-descriptions.mjs` — `claude -p` 摘要文章「自身內容」（不杜撰）寫入 frontmatter `description`，已有則略過、冪等可重跑。
- `node scripts/gen-faq.mjs` — 產 2–4 組 FAQ 寫入 frontmatter `faq:`，ArticleLayout 輸出 FAQPage JSON-LD + 可見 `<details>`。
- `node scripts/indexnow-submit.mjs <changed-file>...`（或 `--all`）— 提交 URL 給 IndexNow；CI 部署後已自動跑，手動少用。IndexNow 金鑰檔在 `public/`。

## 判決 pipeline（`pipeline/`）— 情境 B 主力

每日 cron（**台灣凌晨**，落在司法院 API 服務窗 0–6 點）自動跑，**已上線 live 發佈**：

> auth → JList(7 日內異動) → 字別預過濾(民事 V/行政 A) → 比對帳本去重 → JDoc 取全文 → 關鍵字分類 → 每分眾上限 → `claude -p` 改編 → **第一關**(化名正則+自評) → **第二關**(獨立 `claude -p` 查核 anonymization/faithful/relevant/worthiness) → 過關寫檔 git commit+push（觸發部署）／不過關進 `quarantine/`

- 產出落在四分眾列表頁 `/service-targets/{family|wealth-tax|corporate|personal}`（由 content collection 自動撈，不寫死）。
- **用訂閱帳戶的 `claude -p`，不走 Anthropic API 計費**（model `claude-sonnet-4-6`）。
- 上限：每分眾每日 ≤1 篇、全站每日 ≤4 篇（`config.mjs` 的 `LIMITS`）；每件最多 2 次 `claude -p`（改編+查核），每日 ≤8 次。
- **DNS 坑**：系統 DNS 對 `*.judicial.gov.tw` 回 SERVFAIL；`judicial.mjs` 用 node:https + 自訂 lookup 走公共 DNS（1.1.1.1/8.8.8.8），勿改回系統 DNS。
- 機密在 `pipeline/.env`（`JUD_USER`/`JUD_PASS`、伺服器 headless 認證用 `CLAUDE_CODE_OAUTH_TOKEN`），已 gitignore。
- 離線開發跑 `node pipeline/dev-run.mjs`（用 fixtures，不碰 API/不發佈）；想驗證真判決品質可在 `.env` 設 `DRY_RUN=1` 於服務窗內跑。
- **運作原理、端到端流程圖、伺服器上線 runbook、排錯**：`pipeline/OPERATIONS.md`；模組/DNS/字號等技術細節：`pipeline/README.md`。

## 內容洞察 insights（`pipeline/insights/`）— 看曝光

用 Google service account 拉 **Search Console 搜尋字詞 + GA4 站內行為**，唯讀、不寫網站、不 commit 報告。回饋「使用者實際搜什麼/看什麼」到選題與改標題。

- service account `ga4-insights@yaocare.iam.gserviceaccount.com`；金鑰 `pipeline/.secrets/ga4-insights.json`（**已 gitignore，絕不進 repo**，換機器放同路徑或設 `GOOGLE_INSIGHTS_KEY`）。
- 資源：GA4 property `541900210`（Measurement ID `G-YE9TBVK70Y`）、Search Console `sc-domain:dreamer868.com`。
- `pnpm insights` 產報告到 `pipeline/insights/reports/`（gitignore）：搜尋字詞 Top、搜尋到達頁、GA4 熱門頁。
- **與判決 pipeline 整合**：`run.mjs` 啟動時拉一次 GSC 字詞融入改編 prompt（拉取失敗自動降級為無字詞，判決照常發佈）→ 在伺服器跑判決 pipeline 也要部署同一把金鑰。
- **現況**：GA4/GSC 為新上線資源，授權/連線已驗證 OK，但**需數日累積才有資料**（GSC API 另約延遲 2–3 天）。

## 每日品管 checkup（`pipeline/checkup/`）— 顧品質

每日 cron 自動讀前一夜 pipeline 的 log，用 `claude -p` 判讀三問（文章是否正確/有無抓到 GSC·GA 參考/有無新案例）+ 歷史趨勢，產出**本機私有報告**（`reports/YYYY-MM-DD.md`，**gitignore、不 push、不公開**，因 repo 為 public）。手動跑 `node pipeline/checkup/run.mjs`。細節見 `pipeline/checkup/README.md`。

## 注意事項

- 沒有 base path，所有內部連結直接用絕對路徑（如 `/contact`）
- 聯絡表單為 mailto fallback（無後端）
- `source/` 目錄是舊網站爬取的素材，已加入 .gitignore
- 文章圖片來源：Pexels（需保留 credit）、doing-housework.com（公司自有圖片）
