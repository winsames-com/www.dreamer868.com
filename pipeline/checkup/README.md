# 每日驗收 checkup（判決 pipeline 品管稽核）

每日 **06:00（台灣）** 由 cron 觸發，主動驗收前一夜（台灣 01:11）判決 pipeline 那次執行的產出，
用 `claude -p`（本機訂閱身分，與 pipeline 同）判讀後，產出**本機私有報告**並累積、跨日比對趨勢。
**唯讀、不 commit、不 push、不碰網站、不公開。**

## 回答三問

1. **文章撰寫結果是否正確** — 檢視已發佈文章的化名/忠實度/frontmatter/CTA，以及被隔離草稿的關卡原因是否合理。
2. **有沒有抓到 Google Search / GA 參考資料** — 由 log 判讀 GSC 抓取狀態：
   - `ok`：連線成功，counts 為各分眾融入字詞數（**0 代表 GSC 新資源尚無資料，屬正常待累積**）。
   - `degraded`：抓取失敗已降級（看訊息，注意授權/金鑰）。
   - ⚠️ 夜間判決 pipeline **只抓 GSC 搜尋字詞**融入改編，**不抓 GA4**。GA4 屬另一支每週報告，需要時跑 `pnpm insights`。
3. **有沒有拿到新案例** — 異動清單→候選→發佈/隔離。候選 0 或 nothing to do 屬常態（非每日都有適配判決）。

報告尾端另有 **📈 趨勢**（對照近 7 份歷史報告）與 **🔔 待辦/警示**（FATAL、push 失敗、GSC 授權失效、長期 0 發佈等需人介入者）。

## 報告位置

`pipeline/checkup/reports/YYYY-MM-DD.md`（台灣日期，**已 gitignore**）。即使 `claude -p` 失敗，報告仍含「確定性事實」區塊。

## 安裝 cron

接在判決 pipeline 那行下面（共用 `CRON_TZ=Asia/Taipei` 與 `PATH`）：

```
0 6 * * * /root/www.dreamer868.com/pipeline/checkup/cron.sh >> /tmp/judgment-checkup.log 2>&1
```

## 手動執行 / 測試

```bash
node pipeline/checkup/run.mjs          # 立即跑一次（讀現有 log，產今日報告）
PIPELINE_LOG=/path/to/log node pipeline/checkup/run.mjs   # 指定 log 路徑
pnpm test:pipeline                     # 含 checkup/parse 純函式單元測試
```

## 檔案

- `parse.mjs` — 純函式：從 cron log 抽「最近一次 run」結構化事實（可測試）
- `parse.test.mjs` — 單元測試
- `collect.mjs` — I/O：讀 log/已發佈文章/隔離/帳本/歷史報告 + git 交叉驗證
- `run.mjs` — 編排：蒐集事實 → `claude -p` 判讀 → 寫報告（entry point）
- `cron.sh` — cron 包裝（本機，不 push）
- `reports/` — 每日報告（gitignore 內容、保留目錄）
