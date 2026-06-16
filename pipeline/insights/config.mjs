// pipeline/insights/config.mjs
// GA4 + Search Console 資料拉取的固定設定（探測腳本已確認以下值）。

export const KEY_FILE = process.env.GOOGLE_INSIGHTS_KEY || 'pipeline/.secrets/ga4-insights.json';

// GA4 數字資源 ID（非 Measurement ID）。對應 property「www.dreamer868.com」。
export const GA4_PROPERTY_ID = '541900210';

// Search Console 資源（domain property，需含 sc-domain: 前綴）。
export const GSC_SITE = 'sc-domain:dreamer868.com';

export const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
];

export const REPORTS_DIR = 'pipeline/insights/reports';

// 預設觀察窗（天）。GSC 資料約延遲 2–3 天，故結束日取 today-3。
export const WINDOW_DAYS = 28;
export const GSC_LAG_DAYS = 3;
export const TOP_N = 25;
