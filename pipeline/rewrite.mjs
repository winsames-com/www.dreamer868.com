// pipeline/rewrite.mjs
import Anthropic from '@anthropic-ai/sdk';
import { MODEL } from './config.mjs';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    body_markdown: { type: 'string' },
    relevance_score: { type: 'integer', enum: [1, 2, 3, 4, 5] },
    quality_score: { type: 'integer', enum: [1, 2, 3, 4, 5] },
    anonymization_ok: { type: 'boolean' },
    residual_identifiers: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'body_markdown', 'relevance_score', 'quality_score', 'anonymization_ok', 'residual_identifiers'],
};

function promptFor(candidate) {
  const { doc, category, fullTextStr } = candidate;
  return `你是台灣尊茂財務規劃公司的內容編輯。以下是一則真實法院判決，請改編成「${category.label}」分眾的客戶案例故事。

嚴格要求：
1. 完全化名：所有人物用化名（如陳小姐、王先生），不得出現任何真實姓名、公司全名、身分證、統一編號、電話、完整地址門牌。
2. 改編情節、不影射特定可辨識企業或個人，只取法律與財務情境骨架。
3. 結構：困境 → 問題剖析 → 正確規劃做法 → 啟示。用 Markdown，## 小標。不要寫聯絡資訊或 CTA（系統會自動附加）。
4. 標題吸引人但不誇大、與內文金額/事實一致。
5. body_markdown 約 500–800 字，繁體中文。

請同時自評：
- relevance_score：此判決情境與「${category.label}」的契合度（1–5）。
- quality_score：故事完整性與可讀性（1–5）。
- anonymization_ok：是否確實完全化名、無殘留可辨識資訊。
- residual_identifiers：若有殘留，列出；無則空陣列。

判決案由：${doc.JTITLE || ''}
判決字號（JID）：${doc.JID}
判決全文（節錄）：
${fullTextStr.slice(0, 12000)}`;
}

export function buildRequests(candidates) {
  return candidates.map((c, i) => ({
    custom_id: `cand-${i}`,
    params: {
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: promptFor(c) }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    },
  }));
}

export async function runBatch(candidates, { pollMs = 60000, maxPolls = 60 } = {}) {
  const client = new Anthropic(); // 讀 ANTHROPIC_API_KEY
  const requests = buildRequests(candidates);
  const batch = await client.messages.batches.create({ requests });

  let status = batch;
  for (let i = 0; i < maxPolls; i++) {
    status = await client.messages.batches.retrieve(batch.id);
    if (status.processing_status === 'ended') break;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  if (status.processing_status !== 'ended') {
    throw new Error(`Batch ${batch.id} did not end within poll window`);
  }

  // custom_id -> 解析後的 JSON
  const out = new Map();
  for await (const result of await client.messages.batches.results(batch.id)) {
    if (result.result.type !== 'succeeded') {
      out.set(result.custom_id, { error: result.result.type });
      continue;
    }
    const msg = result.result.message;
    const textBlock = msg.content.find((b) => b.type === 'text');
    let parsed = null;
    try { parsed = JSON.parse(textBlock.text); } catch { parsed = { error: 'parse_failed', raw: textBlock?.text }; }
    out.set(result.custom_id, parsed);
  }
  return out;
}
