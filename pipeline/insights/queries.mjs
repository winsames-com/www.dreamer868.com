// pipeline/insights/queries.mjs
// 拉 GSC 搜尋字詞並用 buckets 分流。容錯：任何失敗/逾時/空資料都回 emptyBuckets()，
// 絕不丟例外（判決 pipeline 不可因搜尋資料故障而中斷發佈）。

import { postJson } from './auth.mjs';
import { GSC_SITE, WINDOW_DAYS, GSC_LAG_DAYS, TOP_N } from './config.mjs';
import { bucketize, emptyBuckets } from './buckets.mjs';

const fmtDate = (d) => d.toISOString().slice(0, 10);

function windowDates() {
  const end = new Date();
  end.setDate(end.getDate() - GSC_LAG_DAYS);
  const start = new Date(end);
  start.setDate(start.getDate() - WINDOW_DAYS);
  return { startDate: fmtDate(start), endDate: fmtDate(end) };
}

// 預設 fetcher：打 GSC search analytics（query 維度）。回傳 auth.mjs 的 {ok,data}/{ok:false,...}。
function defaultFetcher() {
  const { startDate, endDate } = windowDates();
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`;
  return postJson(url, { startDate, endDate, dimensions: ['query'], rowLimit: TOP_N });
}

// 回傳分流後的字詞物件；失敗一律降級為 emptyBuckets()。
export async function fetchBucketedQueries({ fetcher = defaultFetcher } = {}) {
  try {
    const r = await fetcher();
    if (!r || !r.ok) {
      console.log('[insights] GSC 字詞拉取失敗，降級為無字詞:', r && (r.message || r.status));
      return emptyBuckets();
    }
    const rows = (r.data.rows || []).map((row) => ({
      query: row.keys[0], clicks: row.clicks, impressions: row.impressions,
    }));
    return bucketize(rows);
  } catch (e) {
    console.log('[insights] GSC 字詞拉取例外，降級為無字詞:', e.message);
    return emptyBuckets();
  }
}
