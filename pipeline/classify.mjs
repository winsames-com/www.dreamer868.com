// pipeline/classify.mjs
import { CATEGORIES, ALLOWED_COURT_TYPES } from './config.mjs';
import { courtTypeOf } from './jid.mjs';

export function prefilterJids(jids) {
  return jids.filter((j) => ALLOWED_COURT_TYPES.has(courtTypeOf(j)));
}

// 案由（JTITLE）命中權重 3，全文命中權重 1。回傳得分最高的分眾；平手用 config 順序。
export function classifyDoc(doc) {
  const title = (doc.JTITLE || '').toString();
  const full = ((doc.JFULLX && doc.JFULLX.JFULLCONTENT) || '').toString();
  const courtType = courtTypeOf(doc.JID);

  let best = null;
  for (const cat of CATEGORIES) {
    if (cat.courtTypes.length && !cat.courtTypes.includes(courtType)) continue;
    let score = 0;
    for (const kw of cat.keywords) {
      if (title.includes(kw)) score += 3;
      if (full.includes(kw)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { category: cat, score };
    }
  }
  // 至少需要一次關鍵字命中（score>0）
  if (!best || best.score < 1) return null;
  return best;
}
