// pipeline/rewrite.mjs
// 改編引擎：用 Claude Code CLI 的 `claude -p`（headless / print 模式），以本機登入的
// 訂閱帳戶執行，不走 Anthropic API 計費。每日候選 ≤4 件，逐件同步呼叫即可。
// 可選的 searchTerms（由 insights/queries.mjs 分流而來）會融入改編 prompt 引導標題措辭。
import { askJson } from './claude.mjs';

export function promptFor(candidate, searchTerms = []) {
  const { doc, category, fullTextStr } = candidate;
  const termsBlock = searchTerms.length
    ? `

參考：使用者常以下列詞語在搜尋引擎尋找「${category.label}」相關資訊。改編 title 與開頭時，在貼切且不失真的前提下，自然融入與本篇判決主題相關的詞語（不得硬塞無關詞、不得為了塞詞而扭曲事實）：
${searchTerms.map((t) => `- ${t}`).join('\n')}`
    : '';
  return `你是台灣尊茂財務規劃公司的內容編輯。以下是一則真實法院判決，請改編成「${category.label}」分眾的客戶案例故事。

只輸出一個 JSON 物件（不要任何其他文字、不要 markdown 程式碼圍欄），欄位如下：
- title：字串，吸引人但不誇大、與內文金額/事實一致。
- body_markdown：字串，約 500–800 字繁體中文，結構為 困境 → 問題剖析 → 正確規劃做法 → 啟示，用 Markdown ## 小標。不要寫聯絡資訊或 CTA（系統會自動附加）。
- relevance_score：整數 1–5，此判決情境與「${category.label}」的契合度。
- quality_score：整數 1–5，故事完整性與可讀性。
- anonymization_ok：布林，是否確實完全化名、無殘留可辨識資訊。
- residual_identifiers：字串陣列，若有殘留可辨識資訊則列出，無則空陣列。

嚴格要求：
1. 完全化名：所有人物用化名（如陳小姐、王先生），不得出現任何真實姓名、公司全名、身分證、統一編號、電話、完整地址門牌。
2. 改編情節、不影射特定可辨識企業或個人，只取法律與財務情境骨架。

判決案由：${doc.JTITLE || ''}
判決字號（JID）：${doc.JID}
判決全文（節錄）：
${fullTextStr.slice(0, 12000)}${termsBlock}`;
}

// candidates 逐件呼叫 claude -p。termsByCategory 為 bucketize() 的輸出
// （{ categoryKey: [{query,...}] }）；每件取自身分眾前 8 個 query 字串。
export async function rewriteCandidates(candidates, termsByCategory = {}) {
  const out = new Map();
  for (let i = 0; i < candidates.length; i++) {
    const id = `cand-${i}`;
    const terms = (termsByCategory[candidates[i].category.key] || [])
      .slice(0, 8)
      .map((t) => (typeof t === 'string' ? t : t.query));
    try {
      out.set(id, await askJson(promptFor(candidates[i], terms)));
    } catch (e) {
      out.set(id, { error: String((e && e.message) || e) });
    }
  }
  return out;
}
