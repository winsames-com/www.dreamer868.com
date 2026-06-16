// pipeline/insights/fixtures/queries.mjs
// 合成 GSC 搜尋字詞（無真實個資），供離線開發/dev-run 用，與真實 GSC rows 同形。
export const FIXTURE_QUERY_ROWS = [
  { query: '遺產稅 怎麼 計算', clicks: 8, impressions: 220 },
  { query: '贈與稅 節稅 方法', clicks: 5, impressions: 140 },
  { query: '兄弟 分遺產 不公平 怎麼辦', clicks: 6, impressions: 180 },
  { query: '父母 遺產 繼承 順位', clicks: 4, impressions: 130 },
  { query: '公司 股權 借名登記 風險', clicks: 3, impressions: 90 },
  { query: '連帶保證人 責任 範圍', clicks: 3, impressions: 80 },
  { query: '保險 受益人 變更', clicks: 2, impressions: 60 },
  { query: '台中 財務顧問 推薦', clicks: 1, impressions: 40 },
];
