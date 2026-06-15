# 每日判決擷取 pipeline（Part B）

本機 cron 每日從司法院開放資料 API 擷取最新相關判決，用 **`claude -p`（本機登入的訂閱帳戶）** 化名改編成案例故事，通過防護閘門後自動 commit + push（觸發 GitHub Pages 部署）。不走 Anthropic API 計費。

## 設定（一次性）
1. `claude` 已登入訂閱帳戶（`claude` 互動一次或 `claude setup-token`）。
2. 複製 `pipeline/.env.example` 為 `pipeline/.env`，填入司法院資料開放平臺帳密（`JUD_USER` / `JUD_PASS`）。`.env` 已 gitignore。
3. 安裝 crontab（台灣機器，每日凌晨 1 點，落在 API 服務窗 0–6 點）：
   ```
   crontab -e
   0 1 * * * /Users/lightman/myGithub/www.dreamer868.com/pipeline/cron.sh >> /tmp/judgment-pipeline.log 2>&1
   ```

## 流程
`auth → JList(7日前異動) → 字別預過濾(民事V/行政A) → 比對帳本去重 → JDoc 取全文 → 關鍵字分類 → 每分眾上限 → claude -p 改編 → 化名正則+模型自評雙閘門 → 寫檔/隔離 → git commit+push`

## 改編引擎
`pipeline/rewrite.mjs` 以 `claude -p --output-format json --model claude-sonnet-4-6` 逐件呼叫（每日 ≤4 件），用本機訂閱身分；prompt 要求只輸出 JSON，解析信封的 `result` 欄位。

## DNS 注意
本機系統 DNS（如阿里 223.6.6.6）對 `*.judicial.gov.tw` 回 SERVFAIL。`pipeline/judicial.mjs` 用 `node:https` + 自訂 lookup 走公共 DNS（1.1.1.1 / 8.8.8.8）解析，已實測可連。無需改本機 DNS 設定。

## 防護閘門（寧缺勿濫）
- 化名正則掃描（身分證/統編/手機/遮蔽殘留/門牌地址）→ 命中即隔離
- 模型自評 relevance/quality（門檻見 `config.mjs`）+ anonymization_ok
- 任一不過 → 寫入 `pipeline/quarantine/`（不發佈，已 gitignore）

## 上限
每分眾每日 ≤ 1 篇、全站每日 ≤ 4 篇（`pipeline/config.mjs` 的 `LIMITS`）。

## 字號
開放 API 不含法院中文全名，`caseSource` 以「年度+字別+號（JID）」記錄；JID 內含法院代碼可回溯。

## 乾跑（首次驗證）
在 `pipeline/.env` 設 `DRY_RUN=1`，於台灣 0–6 點執行 `pipeline/cron.sh`（或 `node pipeline/run.mjs`）。會全跑但不寫正式檔、不 commit、不更新帳本；結果在 `pipeline/quarantine/` 供檢視。確認品質後移除 `DRY_RUN` 再交給 cron。

## 本機測試
`pnpm test:pipeline`（純函式單元測試 jid/classify/guard/state/markdown，不呼叫網路或 claude）。

## 檔案
- `config.mjs` — 四分眾關鍵字/門檻/上限/hero 圖/模型
- `jid.mjs` — JID 解析與裁判類別
- `classify.mjs` — 字別預過濾 + 關鍵字分類
- `guard.mjs` — 化名正則掃描 + 閘門邏輯
- `state.mjs` — 已處理 JID 帳本（`state/seen-jids.json`）
- `markdown.mjs` — 文章 frontmatter/CTA 產生器
- `judicial.mjs` — 司法院 API client（node:https + 公共 DNS）
- `rewrite.mjs` — `claude -p` 改編引擎
- `run.mjs` — 全流程編排（entry point）
- `cron.sh` — 本機 cron 包裝（載入 .env、跑 run、commit+push）
- `quarantine/` — 未過閘門的草稿（gitignore 內容、保留目錄）
