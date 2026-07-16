# 尊茂財務規劃網站 — www.dreamer868.com

台中尊茂財務規劃公司官方網站。Astro 6 靜態網站 → GitHub Pages。

> **給維護者（人或 AI）**：本 `README.md` 與 `CLAUDE.md` **內容對齊**，任讀一份都能正確維護本專案。維護工作分兩種情境——**A 開發/優化**與 **B 增加內容/看曝光**——下方「兩種維護情境」先幫你分流，再帶到對應的細節文件。改了路由表請同步另一份。

本 repo 同時承載：

1. **Astro 網站**本體（`src/`）。
2. **判決 pipeline**（`pipeline/`）— 每日 cron 自動抓司法院判決，用 `claude -p` 化名改編成案例故事，過雙重防護閘門後自動發佈。**已上線**。
3. **內容洞察 / 品管**（`pipeline/insights/` 看 GA4 + Search Console 曝光；`pipeline/checkup/` 每日稽核產出品質）。

---

## 快速開始

```bash
pnpm install     # Node ≥ 22.12
pnpm dev         # 本地開發 http://localhost:4321
pnpm build       # 建置到 dist/
pnpm preview     # 預覽建置結果
```

部署：push 到 `main` 觸發 `.github/workflows/deploy.yml`（build → deploy → verify → indexnow）。

---

## 兩種維護情境（先看這裡分流）

### 情境 A — 開發人員「優化、更新本專案」（工程）

改網站本體、版面樣式、SEO/AEO 結構、CI、或 pipeline 程式碼。

| 想做的事 | 動哪裡 | 指令 / 文件 |
|---|---|---|
| 本地開發、改版面/元件/頁面 | `src/`（components / layouts / pages / styles / data） | `pnpm dev` → `pnpm build` |
| 改導覽列、聯絡資訊、作者 E-E-A-T | `src/data/navigation.ts`（含 `principalAuthor`） | — |
| 改 SEO/AEO 結構化資料 | `src/layouts/BaseLayout.astro`、`ArticleLayout.astro`、`src/pages/llms.txt.ts`、`rss.xml.ts` | 見「SEO / AEO 配置」 |
| 替既有文章補 meta description / FAQ | `scripts/gen-descriptions.mjs`、`scripts/gen-faq.mjs` | 見「GEO/AEO 腳本」 |
| 改 CI / 部署流程 | `.github/workflows/deploy.yml` | 見「CI/CD」 |
| 維護判決 pipeline 程式 | `pipeline/*.mjs` | `pnpm test:pipeline`；[`pipeline/README.md`](pipeline/README.md) |

### 情境 B — 「增加內容、了解網路曝光量」（內容營運）

讓更多文章上站，並用搜尋/流量數據回饋選題。

| 想做的事 | 動哪裡 | 指令 / 文件 |
|---|---|---|
| 自動產判決案例故事（每日 cron，已上線） | `pipeline/` | [`pipeline/OPERATIONS.md`](pipeline/OPERATIONS.md)（運作+上線 runbook）、[`pipeline/README.md`](pipeline/README.md) |
| 手動新增一篇文章 | 寫 md 進 `src/content/articles/`，或放 `docs/` 後跑 `node scripts/prepare-content.mjs` | **新文章記得補** `gen-descriptions` + `gen-faq`（見「GEO/AEO 腳本」） |
| 看「使用者搜什麼、看什麼」做選題 | `pipeline/insights/`（GA4 + Search Console） | `pnpm insights`；[`pipeline/insights/README.md`](pipeline/insights/README.md) |
| 看每日 pipeline 產出品質 / 趨勢 | `pipeline/checkup/`（每日稽核報告，本機私有不 push） | [`pipeline/checkup/README.md`](pipeline/checkup/README.md) |
| 加速搜尋引擎 / AI 收錄新頁 | `scripts/indexnow-submit.mjs`（CI 已自動，亦可手動） | 見「GEO/AEO 腳本」 |

> 🔐 機密憑證一律在 `pipeline/.env`、`pipeline/.secrets/`（皆 gitignore，**絕不進 repo**）。部署用的 cron 時間、deploy key 等屬機器專屬設定，不放進這個 public repo。

---

## 目錄結構

```
src/
├── content/articles/   # Markdown 文章（各服務分類 + 判決案例故事）
├── components/         # Astro 元件（Header, Footer, ArticleCard…）
├── data/navigation.ts  # 導覽列、聯絡資訊、principalAuthor（作者 E-E-A-T）
├── layouts/            # BaseLayout（SEO/JSON-LD）、ArticleLayout（Article/FAQPage）
├── pages/              # 路由：articles/[...slug]、service-targets/（四分眾列表）、
│                       #       services/、author/、llms.txt.ts、rss.xml.ts、404
└── styles/             # global.css、variables.css
scripts/                # 一次性 / CI 內容工具（情境 A、B 共用）
├── prepare-content.mjs    # docs/ → content collection（補 frontmatter）
├── gen-descriptions.mjs   # claude -p 產 meta description（冪等）
├── gen-faq.mjs            # claude -p 產 FAQ → FAQPage JSON-LD
├── indexnow-submit.mjs    # 提交變動 URL 給 IndexNow（CI 部署後自動）
└── publish-from-cache.mjs / retest-failed.mjs  # 判決快取重跑工具
pipeline/               # 判決 pipeline（每日 cron 自動產文，已上線）
├── run.mjs rewrite.mjs verify.mjs guard.mjs …  # 流程/改編/雙關卡（見 pipeline/README.md）
├── insights/           # GA4 + Search Console 內容洞察（看曝光）
└── checkup/            # 每日品管稽核（本機私有不 push）
docs/                   # 文章素材與規劃（superpowers/ 為 specs/plans）
public/                 # CNAME、robots.txt、favicon、IndexNow 金鑰檔
```

---

## 常用指令

```bash
# 情境 A：開發 / 建置 / 測試
pnpm dev / build / preview
pnpm check:design                        # 設計規範守門（oklch token/--text-* 階梯/禁 px 字級，build 前自動跑；規範細節見 CLAUDE.md「設計規範」）
pnpm test:pipeline                       # pipeline + checkup 純函式單元測試

# 情境 A：替既有文章補 GEO/AEO 欄位（需 claude 已登入）
node scripts/gen-descriptions.mjs [--limit N] [--dry]
node scripts/gen-faq.mjs [--limit N] [--dry]

# 情境 B：內容 / 曝光
node scripts/prepare-content.mjs         # docs/ → content collection 文章
node pipeline/dev-run.mjs                # 離線跑判決 pipeline（fixtures，不發佈）
pnpm insights:probe                      # 測 GA4/GSC 授權與連線
pnpm insights                            # 拉資料產內容洞察報告
node pipeline/checkup/run.mjs            # 立即產一次每日品管報告
```

---

## SEO / AEO 配置

- BaseLayout 每頁輸出 canonical、Open Graph、Twitter Card、BreadcrumbList + Organization/FinancialService(@id) + WebSite JSON-LD。
- 文章頁：Article +（有 `faq:` 時）FAQPage JSON-LD；作者頁：Person + ProfilePage。
- 作者 E-E-A-T 由 `src/data/navigation.ts` 的 `principalAuthor`（吳芳圳｜財務醫師）集中管理。
- `/llms.txt`、`/rss.xml`、`robots.txt`（歡迎 AI 爬蟲）、sitemap（`@astrojs/sitemap` 自動產）。

## GEO/AEO 腳本（`scripts/`）

讓 LLM/AI 答題引擎更願意引用本站。判決 pipeline 產的新文章已「出生即完整」（改編時一併產 description + faq）；**手動新增的文章需補跑** `gen-descriptions.mjs` 與 `gen-faq.mjs`（皆冪等、已有則略過）。`indexnow-submit.mjs` 在 CI 部署後自動依本次 commit 變動提交。

## CI/CD

`.github/workflows/deploy.yml` 四個 job（依序 needs）：**build**（install+build）→ **deploy**（GitHub Pages）→ **verify**（從 sitemap 檢查所有 URL 回 200）→ **indexnow**（提交變動頁面）。

---

## 判決 pipeline / insights / checkup

三個子系統各有專屬文件，需要時直接讀：

- **判決 pipeline 運作與上線**：[`pipeline/OPERATIONS.md`](pipeline/OPERATIONS.md)（端到端流程圖 + 伺服器 runbook + 排錯）、[`pipeline/README.md`](pipeline/README.md)（模組 / DNS / 字號等技術細節）。
- **內容洞察（看曝光）**：[`pipeline/insights/README.md`](pipeline/insights/README.md)。
- **每日品管稽核**：[`pipeline/checkup/README.md`](pipeline/checkup/README.md)。

關鍵點：用**訂閱帳戶**的 `claude -p`（不走 Anthropic API 計費）；雙重防護閘門（化名正則自評 + 獨立 `claude -p` 查核），不過關進 `pipeline/quarantine/`（不發佈）；司法院 API 限**台灣 0–6 點**服務窗，`judicial.mjs` 自帶公共 DNS 繞過 `*.judicial.gov.tw` 的 SERVFAIL。

---

## 注意事項

- 沒有 base path，內部連結用絕對路徑（如 `/contact`）。
- 聯絡表單為 mailto fallback（無後端）。
- `source/`、`dist/`、`node_modules/`、各機密與報告目錄已 gitignore。
- 文章圖片：Pexels（需保留 credit）、doing-housework.com（公司自有）。
