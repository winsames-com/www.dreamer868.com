// pipeline/rewrite.mjs
// 改編引擎：用 Claude Code CLI 的 `claude -p`（headless / print 模式），以本機登入的
// 訂閱帳戶執行，不走 Anthropic API 計費。每日候選 ≤4 件，逐件同步呼叫即可。

import { askJson } from './claude.mjs';

function promptFor(candidate) {
  const { doc, category, fullTextStr } = candidate;
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
${fullTextStr.slice(0, 12000)}`;
}

// 逐件呼叫 claude -p，回傳 Map：custom_id（cand-${i}）-> 解析後物件或 {error}。
export async function rewriteCandidates(candidates) {
  const out = new Map();
  for (let i = 0; i < candidates.length; i++) {
    const id = `cand-${i}`;
    try {
      out.set(id, await askJson(promptFor(candidates[i])));
    } catch (e) {
      out.set(id, { error: String((e && e.message) || e) });
    }
  }
  return out;
}
