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
- 模型自評 relevance/quality（門檻見 `config.mjs`）+ anonymization_ok
- 任一不過 → 寫入 `pipeline/quarantine/`（不發佈），並上傳為 Actions artifact

## 上限
每分眾每日 ≤ 1 篇、全站每日 ≤ 4 篇（`pipeline/config.mjs` 的 `LIMITS`）。

## 乾跑（首次驗證）
Actions → judgment-pipeline → Run workflow → dry_run = true。
會抓取＋分類＋改編＋閘門全跑，但不寫正式檔、不 commit、不更新帳本；結果在 quarantine artifact。
**注意：API 僅每日台灣 00:00–06:00 開放**，手動觸發請在此時段（cron 已設台灣 01:00）。

## 字號
開放 API 不含法院中文全名，`caseSource` 以「年度+字別+號（JID）」記錄；JID 內含法院代碼可回溯。

## 本機測試
`pnpm test:pipeline`（純函式單元測試 jid/classify/guard/state/markdown，不呼叫網路）。

## 檔案
- `config.mjs` — 四分眾關鍵字/門檻/上限/hero 圖/模型
- `jid.mjs` — JID 解析與裁判類別
- `classify.mjs` — 字別預過濾 + 關鍵字分類
- `guard.mjs` — 化名正則掃描 + 閘門邏輯
- `state.mjs` — 已處理 JID 帳本（`state/seen-jids.json`）
- `markdown.mjs` — 文章 frontmatter/CTA 產生器
- `judicial.mjs` — 司法院 API client（Auth/JList/JDoc）
- `rewrite.mjs` — Claude Batch 改編（結構化輸出）
- `run.mjs` — 全流程編排（entry point）
- `quarantine/` — 未過閘門的草稿（git 忽略內容、保留目錄）
