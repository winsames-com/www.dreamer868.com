// pipeline/guard.mjs
import { THRESHOLDS } from './config.mjs';

// 確定性化名掃描：偵測殘留的可辨識資訊。
// 注意：判決全文常將姓名遮成「甲○○」等，改編稿不應出現身分證、統編、完整電話、地址號樓。
const PATTERNS = [
  { kind: 'national_id', re: /[A-Z][12]\d{8}/g },                 // 身分證字號
  { kind: 'tax_id', re: /統一?編號\s*[:：]?\s*\d{8}/g },          // 統一編號
  { kind: 'tax_id', re: /(?<!\d)\d{8}(?!\d)/g },                  // 裸 8 碼（統編）
  { kind: 'phone', re: /09\d{2}[-\s]?\d{3}[-\s]?\d{3}/g },        // 手機
  { kind: 'redacted_name', re: /[甲乙丙丁戊][○Ｏ]{1,3}/g },        // 判決遮蔽殘留（甲○○）
  { kind: 'address_no', re: /\d+號(?:\d+樓)?(?:之\d+)?/g },        // 門牌號樓
];

export function scanAnonymization(markdown) {
  const text = (markdown || '').toString();
  const hits = [];
  for (const { kind, re } of PATTERNS) {
    const matches = text.match(re);
    if (matches) {
      for (const m of matches) hits.push({ kind, value: m });
    }
  }
  return { ok: hits.length === 0, hits };
}

export function passesGates(assessment, scanResult) {
  if (!assessment) return false;
  if (!scanResult || !scanResult.ok) return false;
  if (assessment.anonymization_ok !== true) return false;
  if (Number(assessment.relevance_score) < THRESHOLDS.relevanceMin) return false;
  if (Number(assessment.quality_score) < THRESHOLDS.qualityMin) return false;
  return true;
}
