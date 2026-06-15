// pipeline/rewrite.mjs
// 改編引擎：用 Claude Code CLI 的 `claude -p`（headless / print 模式），以本機登入的
// 訂閱帳戶執行，不走 Anthropic API 計費。每日候選 ≤4 件，逐件同步呼叫即可。
//
// `claude -p --output-format json` 回傳信封：{type:"result", result:"<助手最終文字>", ...}。
// prompt 要求模型只輸出 JSON 物件，故 envelope.result 即我們要的 JSON 字串（再 parse）。
// 已於本機實測此機制可運作。

import { spawn } from 'node:child_process';
import { MODEL } from './config.mjs';

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

function parseJsonLoose(s) {
  const t = String(s).trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();
  return JSON.parse(t);
}

function claudePrint(prompt, { timeoutMs = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--output-format', 'json', '--model', MODEL], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('claude -p timeout')); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude exit ${code}: ${err.slice(0, 200)}`));
      resolve(out);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// 逐件呼叫 claude -p，回傳 Map：custom_id（cand-${i}）-> 解析後物件或 {error}。
export async function rewriteCandidates(candidates) {
  const out = new Map();
  for (let i = 0; i < candidates.length; i++) {
    const id = `cand-${i}`;
    try {
      const raw = await claudePrint(promptFor(candidates[i]));
      const envelope = JSON.parse(raw);
      if (envelope.is_error || typeof envelope.result !== 'string') {
        out.set(id, { error: 'claude_error' });
        continue;
      }
      out.set(id, parseJsonLoose(envelope.result));
    } catch (e) {
      out.set(id, { error: String((e && e.message) || e) });
    }
  }
  return out;
}
