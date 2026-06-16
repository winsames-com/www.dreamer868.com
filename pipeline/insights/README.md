# 內容洞察 pipeline（GA4 + Search Console）

用 Google service account 拉 **Search Console 搜尋字詞** 與 **GA4 站內行為**，產出內容優化報告。目的：把「使用者實際搜什麼、看什麼」回饋到文章撰寫（選題、改標題、補缺）。唯讀，不寫網站、不 commit 報告。

## 認證

- service account：`ga4-insights@yaocare.iam.gserviceaccount.com`（project `yaocare`）
- 金鑰：`pipeline/.secrets/ga4-insights.json`（**已 gitignore，絕不進 repo**）。換機器時把金鑰放到同路徑，或設環境變數 `GOOGLE_INSIGHTS_KEY` 指向金鑰絕對路徑。
- 已啟用 API：Google Analytics Admin API、Google Analytics Data API、Search Console API。
- 已授權資源（見 `config.mjs`）：
  - GA4 property `541900210`（www.dreamer868.com，對應 Measurement ID `G-YE9TBVK70Y`）
  - Search Console `sc-domain:dreamer868.com`（domain 資源）

## 指令

```bash
pnpm insights:probe   # 探測：列出 service account 能存取的 GA4 資源與 GSC 站台（確認授權/連線）
pnpm insights         # 拉資料並產報告到 pipeline/insights/reports/insights-YYYY-MM-DD.md
```

## 檔案

- `config.mjs` — property ID、GSC 站台、scope、觀察窗（預設 28 天；GSC 延遲 3 天）、Top N
- `auth.mjs` — 共用 service account 認證與 REST GET/POST（統一錯誤處理）
- `probe.mjs` — 列可存取資源（拿 property ID、確認授權）
- `run.mjs` — 拉 GSC 字詞/到達頁 + GA4 熱門頁，印摘要並寫 markdown 報告

## 報告內容

1. **搜尋字詞 Top**（點擊／曝光／CTR／平均排名）— 曝光高但 CTR 低 → 改標題；高曝光主題 → 加強或新增文章。
2. **搜尋到達頁 Top** — 哪些頁面實際從搜尋帶進流量。
3. **GA4 熱門頁** — 站內最被瀏覽的頁面。

## 資料延遲與現況

- GA4：`G-YE9TBVK70Y` 於 2026-06-16 才換上線，property 為新建，**需數日累積**才有量。
- GSC：`sc-domain:dreamer868.com` 為新資源，Google 索引 + 搜尋資料需時間累積（且 API 資料約延遲 2–3 天）。
- 連線/授權已於建置時驗證成功（`pnpm insights:probe` 與 `pnpm insights` 皆正常回應，僅暫無資料）。

## 定期執行（資料累積後）

可加 cron（與 judgment pipeline 同機）每週拉一次報告供撰寫參考，例如每週一 09:00：

```
0 9 * * 1 cd /path/to/repo && /usr/local/bin/node pipeline/insights/run.mjs >> /tmp/insights.log 2>&1
```

報告產在 `pipeline/insights/reports/`（已 gitignore）。後續可再把高需求字詞回饋到 `pipeline/config.mjs` 的分類關鍵字。
