// pipeline/verify.mjs
// 獨立驗證關卡：改編完成後，用「另一次」claude -p 以不同視角獨立查核改編稿，
// 對抗「同一模型自評」的盲點，並評故事性（解決「最新 ≠ 最有故事性」）。

import { askJson } from './claude.mjs';

function verifyPrompt(candidate, draft) {
  const { doc, category, fullTextStr } = candidate;
  return `你是嚴格的審稿員。請獨立查核以下「改編稿」是否可安全發佈，預設從嚴。

只輸出一個 JSON 物件（不要其他文字、不要程式碼圍欄）：
- anonymization_ok：布林，改編稿是否確實無任何真實姓名、公司全名、身分證、統編、電話、完整門牌等可辨識資訊。
- faithful：布林，改編稿是否忠於原判決的法律與財務情境、未嚴重扭曲或杜撰關鍵事實。
- relevant：布林，內容是否確實屬於「${category.label}」分眾。
- worthiness：整數 1–5，此故事對一般讀者的故事性與啟發性（5 最高）。
- issues：字串陣列，列出你發現的問題；無則空陣列。

原判決案由：${doc.JTITLE || ''}
原判決全文（節錄）：
${fullTextStr.slice(0, 8000)}

改編稿標題：${draft.title || ''}
改編稿內文：
${(draft.body_markdown || '').slice(0, 6000)}`;
}

// 對單篇改編稿做獨立查核，回傳 verdict 物件或 {error}。
export async function verifyDraft(candidate, draft) {
  try {
    return await askJson(verifyPrompt(candidate, draft));
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

// 獨立查核是否通過（預設從嚴：缺欄位或出錯一律不過）。
export function verifyPasses(verdict, worthinessMin) {
  if (!verdict || verdict.error) return false;
  if (verdict.anonymization_ok !== true) return false;
  if (verdict.faithful !== true) return false;
  if (verdict.relevant !== true) return false;
  if (Number(verdict.worthiness) < worthinessMin) return false;
  return true;
}
