// pipeline/insights/buckets.mjs
// 把 GSC 搜尋字詞分流到四分眾的關鍵字表（口語＋法律混合，刻意比 config.mjs 的
// classify keywords 更寬）。此表僅決定「字詞給哪個分眾參考」，完全不影響判決分類。

export const BUCKETS = {
  'wealth-tax': ['遺產稅', '贈與稅', '節稅', '課稅', '實質課稅', '補稅', '稅務'],
  family: ['繼承', '遺產', '分遺產', '分家產', '留給子女', '特留分', '贍養', '監護', '遺囑'],
  corporate: ['股權', '股東', '借名登記', '經營權', '董事', '公司分割', '出資'],
  personal: ['保險', '受益人', '連帶保證', '保證人', '本票', '債務', '清償'],
};

export function emptyBuckets() {
  const out = { _unbucketed: [] };
  for (const k of Object.keys(BUCKETS)) out[k] = [];
  return out;
}

// rows: [{ query, clicks, impressions }, ...]
// 回傳 { 'wealth-tax':[...], family:[...], corporate:[...], personal:[...], _unbucketed:[...] }
// query 含某分眾任一分流詞即歸該分眾（可同時落入多分眾）；皆未命中則歸 _unbucketed。
export function bucketize(rows) {
  const out = emptyBuckets();
  for (const row of rows || []) {
    const q = (row.query || '').toString();
    let matched = false;
    for (const [cat, words] of Object.entries(BUCKETS)) {
      if (words.some((w) => q.includes(w))) { out[cat].push(row); matched = true; }
    }
    if (!matched) out._unbucketed.push(row);
  }
  return out;
}
