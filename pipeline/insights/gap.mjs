// pipeline/insights/gap.mjs
// 選題缺口：對每分眾，找出「其搜尋字詞中的分流命中詞，未出現在該分眾任何現有文章標題」的 query。
import { BUCKETS } from './buckets.mjs';

// bucketed: bucketize() 輸出；titlesByCat: { categoryKey: [title, ...] }
// 回傳 { categoryKey: [{ query, impressions }, ...] }（僅缺口；不含 _unbucketed）
export function gapAnalysis(bucketed, titlesByCat = {}) {
  const out = {};
  for (const cat of Object.keys(BUCKETS)) {
    const titles = titlesByCat[cat] || [];
    const rows = bucketed[cat] || [];
    out[cat] = rows.filter((row) => {
      const hitWords = BUCKETS[cat].filter((w) => (row.query || '').includes(w));
      // 命中詞若有任一出現在某現有標題 → 視為已涵蓋（非缺口）
      const covered = hitWords.some((w) => titles.some((t) => t.includes(w)));
      return !covered;
    }).map((row) => ({ query: row.query, impressions: row.impressions }));
  }
  return out;
}
