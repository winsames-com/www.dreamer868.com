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

去 AI 味／文風要求（body_markdown、description、faq 都適用；本站有 check-content 守門，違反者直接被隔離不發佈）：
- 禁「不是X，而是Y」下定義；禁「不僅…更/還/也」「不只是…而是/更是」「並非…而是」這類排比句。
- 禁「值得注意的是」「值得一提的是」「換句話說」。
- 禁空泛收束（總的來說／綜上所述／總而言之／歸根結底／整體而言）；結語要落在本案的具體啟示，不要用萬用結論句收尾。
- 禁「真正的問題/關鍵是…」；禁「隨著…的發展/普及」「在…的今天」這類開場公式。
- 禁拔高套語「至關重要／不可或缺／舉足輕重」。
- 禁模糊引用（研究顯示／有研究指出／專家認為／學者認為／普遍認為）——要附具體來源，否則不寫。
- 禁用破折號（——）下定義。
- 禁模板化第一人稱開場（如以「我」「最近有讀者/客戶/朋友」「在這個…」「近年來」開頭）。
- 正向：長短句交錯（不要每句都工整等長）、每段換一種開頭方式、每段至少落一個本判決的具體事實（金額、年度、法律關係、判決結果——判決本就有具體情節，善加運用）、用台灣口語、容許一點口語瑕疵。

忠實與去識別要求（最重要，第二關會獨立查核忠實度）：
1. 「困境」與「問題剖析」只能根據判決**實際載明**的事實、金額、年度、法律關係與結果撰寫；**不得虛構、誇大或加入判決未提及的情節**（例如判決沒提到的保險、扶養費、第三人、其他資產等，一律不得寫成本案發生的事實）。可省略細節，但不得改寫成不同事實。
2. 完全化名／去識別：**嚴禁出現任何「姓＋名」的全名**（姓氏後面直接接一到兩個字的名字，即三字或兩字的完整姓名寫法，一律禁止，即使是虛構的也不行）。所有人物一律只用下列兩種寫法之一：(a)「姓氏＋通用稱謂」如陳先生、王小姐、林太太、陳女士；(b)「身分／關係角色」如駕駛人、車主、長子、次子、配偶。**同姓氏又有多人時**（如父子、兄弟），用角色區分（長子、次子）或稱謂區分（陳先生、陳老太太），不得各自安上不同的名字。另遮蔽身分證、統一編號、電話、完整地址門牌、公司全名等可辨識資訊。**化名與去識別不算扭曲事實。**
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
