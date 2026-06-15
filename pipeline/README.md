# 每日判決擷取 pipeline（Part B）

cron 每日從司法院開放資料 API 擷取最新相關判決，用 **`claude -p`（訂閱帳戶）** 化名改編成案例故事，通過防護閘門後自動 commit + push（觸發 GitHub Pages 部署）。不走 Anthropic API 計費。設計與機器無關：Node ESM + `cron.sh` + `.env` + 自帶 DNS 繞過，本機或伺服器皆可跑。

## 設定（一次性）
1. `claude` 已登入訂閱帳戶（本機 `claude` 互動一次；伺服器見下方）。
2. 複製 `pipeline/.env.example` 為 `pipeline/.env`，填入司法院資料開放平臺帳密（`JUD_USER` / `JUD_PASS`）。`.env` 已 gitignore。
3. 安裝 crontab（每日凌晨 1 點台灣時間，落在 API 服務窗 0–6 點）：
   ```
   crontab -e
   0 1 * * * /path/to/repo/pipeline/cron.sh >> /tmp/judgment-pipeline.log 2>&1
   ```

## 在伺服器部署（headless）
目標部署環境。需求與本機相同，外加：
1. **安裝**：Node ≥ 22 與 Claude Code CLI（`claude`）。
2. **claude 認證（無互動登入）**：在已登入的機器執行 `claude setup-token`，把產生的長效 token 設為 `.env` 的 `CLAUDE_CODE_OAUTH_TOKEN`（`cron.sh` 會 source `.env`，`claude -p` 自動讀取）。
3. **cron 時區**：API 服務窗以**台灣時間** 0–6 點為準。
   - 伺服器時區為台灣：用上面 `0 1 * * *`。
   - 伺服器為 UTC：用 `0 17 * * *`（=台灣 01:00），或在 crontab 上方加 `TZ=Asia/Taipei` 再用 `0 1 * * *`。
4. **git push 認證**：伺服器需有對本 repo 的 push 權限（部署金鑰 / PAT），`cron.sh` 才能 `git push` 觸發網站部署。
5. **連線**：伺服器需連得到 `data.judicial.gov.tw`（本環境實測非台灣雲端 IP 亦可連；DNS 解析由 `judicial.mjs` 內建公共 DNS 處理）。首次以 `DRY_RUN=1` 於服務窗內驗證。

## 流程
`auth → JList(7日前異動) → 字別預過濾(民事V/行政A) → 比對帳本去重 → JDoc 取全文 → 關鍵字分類 → 每分眾上限 → claude -p 改編 → 第一關(化名正則+自評) → 第二關(獨立 claude -p 查核+故事性) → 寫檔/隔離 → git commit+push`

## 改編引擎
`pipeline/rewrite.mjs` 以 `claude -p --output-format json --model claude-sonnet-4-6` 逐件呼叫（每日 ≤4 件），用訂閱身分（本機登入或伺服器 `CLAUDE_CODE_OAUTH_TOKEN`）；prompt 要求只輸出 JSON，解析信封的 `result` 欄位。

## DNS 注意
本機系統 DNS（如阿里 223.6.6.6）對 `*.judicial.gov.tw` 回 SERVFAIL。`pipeline/judicial.mjs` 用 `node:https` + 自訂 lookup 走公共 DNS（1.1.1.1 / 8.8.8.8）解析，已實測可連。無需改本機 DNS 設定。

## 防護閘門（雙關卡，寧缺勿濫）
- **第一關**：化名正則掃描（身分證/統編/手機/遮蔽殘留/門牌地址）+ 改編自評 relevance/quality（門檻見 `config.mjs`）。
- **第二關（獨立查核）**：第一關通過者再用**另一次 `claude -p`** 以不同視角獨立判斷 anonymization/faithful（忠於原判決）/relevant/worthiness（故事性 1–5）。對抗同一模型自評盲點，並挑掉「最新但無故事性」的判決。
- 任一不過 → 寫入 `pipeline/quarantine/`（不發佈，已 gitignore）。每件最多 2 次 `claude -p`（改編+查核），每日 ≤8 次。

## 上限
每分眾每日 ≤ 1 篇、全站每日 ≤ 4 篇（`pipeline/config.mjs` 的 `LIMITS`）。

## 字號
法院中文名從判決全文開頭擷取（`courts.mjs`），產出如「臺灣臺中地方法院 113 年度家繼訴字第 5 號」；取不到才退回「年度+字別+號（JID）」。

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
- `courts.mjs` — 從全文擷取法院中文名
- `claude.mjs` — 共用 `claude -p` 呼叫（askJson）
- `rewrite.mjs` — `claude -p` 改編引擎
- `verify.mjs` — 獨立 `claude -p` 查核關卡
- `run.mjs` — 全流程編排（entry point）
- `cron.sh` — 本機 cron 包裝（載入 .env、跑 run、commit+push）
- `quarantine/` — 未過閘門的草稿（gitignore 內容、保留目錄）
