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
  return `你是台灣尊茂財務規劃公司的內容編輯。以下是一則真實法院判決，請「忠於判決事實」改寫成「${category.label}」分眾的客戶案例故事——只做去識別與敘事化，不虛構情節。

只輸出一個 JSON 物件（不要任何其他文字、不要 markdown 程式碼圍欄），欄位如下：
- title：字串，吸引人但不誇大、與判決事實/金額一致。
- body_markdown：字串，約 500–800 字繁體中文，用 Markdown ## 小標，結構為：困境（依判決載明事實鋪陳當事人處境）→ 問題剖析（點出本案的法律爭點與財務問題）→ 規劃啟示（一般性的財務規劃建議）→ 結語。不要寫聯絡資訊或 CTA（系統會自動附加）。
- description：字串，48–80 字繁體中文，精準摘要本案例與財務啟示，供搜尋與 AI 引用；完全化名、不得含可辨識資訊。
- faq：陣列 2–4 組，每組 {q, a}。q 為讀者就此主題會實際搜尋/詢問的自然問句；a 為 30–90 字精簡回答，須以本故事呈現的財務規劃觀念為依據、不杜撰、完全化名。
- relevance_score：整數 1–5，此判決情境與「${category.label}」的契合度。
- quality_score：整數 1–5，故事完整性與可讀性。
- anonymization_ok：布林，是否確實完全化名、無殘留可辨識資訊。
- residual_identifiers：字串陣列，若有殘留可辨識資訊則列出，無則空陣列。

忠實與去識別要求（最重要，第二關會獨立查核忠實度）：
1. 「困境」與「問題剖析」只能根據判決**實際載明**的事實、金額、年度、法律關係與結果撰寫；**不得虛構、誇大或加入判決未提及的情節**（例如判決沒提到的保險、扶養費、第三人、其他資產等，一律不得寫成本案發生的事實）。可省略細節，但不得改寫成不同事實。
2. 完全化名／去識別：所有人物用化名（如陳小姐、王先生），遮蔽身分證、統一編號、電話、完整地址門牌、公司全名等可辨識資訊。**化名與去識別不算扭曲事實。**
3. 「規劃啟示」段可給一般性的財務規劃建議，但須讓讀者看得出是「通則建議」，**不得偽裝成本案曾發生過的事實**。

判決案由：${doc.JTITLE || ''}
判決字號（JID）：${doc.JID}
判決全文（節錄）：
${fullTextStr.slice(0, 12000)}${termsBlock}`;
}

// 單件改編（供 run.mjs 重試迴圈逐件呼叫）。terms 為該分眾的搜尋詞字串陣列。
// 大判決全文（可達上萬字）prompt 較大，逾時拉長到 300s，降低偶發逾時。
export async function rewriteOne(candidate, terms = []) {
  try {
    return await askJson(promptFor(candidate, terms), { timeoutMs: 300000 });
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

// 取某分眾前 8 個搜尋詞字串（termsByCategory 為 bucketize() 輸出）。
export function termsForCategory(termsByCategory, categoryKey) {
  return (termsByCategory[categoryKey] || [])
    .slice(0, 8)
    .map((t) => (typeof t === 'string' ? t : t.query));
}

// candidates 逐件呼叫 claude -p（供 dev-run 等批次情境）。
export async function rewriteCandidates(candidates, termsByCategory = {}) {
  const out = new Map();
  for (let i = 0; i < candidates.length; i++) {
    const terms = termsForCategory(termsByCategory, candidates[i].category.key);
    out.set(`cand-${i}`, await rewriteOne(candidates[i], terms));
  }
  return out;
}
