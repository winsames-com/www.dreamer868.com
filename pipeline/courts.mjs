// pipeline/courts.mjs
// 從判決全文開頭擷取法院中文名（全文首行通常為「臺灣臺中地方法院民事判決」之類）。
// 開放 API 不直接提供法院中文名，但全文開頭一定有，故從文字擷取最準確、零猜測。

const COURT_RE = /([一-龥]{2,12}?法院(?:[一-龥]{1,6}分院)?)/;

export function extractCourtName(fullText) {
  const head = String(fullText || '').slice(0, 60);
  const m = COURT_RE.exec(head);
  return m ? m[1] : null;
}
