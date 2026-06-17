// 一次性：對今晚被擋的 4 件判決，用「新 prompt + 新查核」重跑，看是否過關。
// 判決全文快取在 pipeline/.cache/judgments.json：有快取就讀快取、不連 API（也不受服務窗限制）；
// 無快取才 auth + getDoc 抓一次並存檔。重跑改編/查核時不會重抓。
//   node scripts/retest-failed.mjs            # 用快取（無則抓一次）
//   REFETCH=1 node scripts/retest-failed.mjs  # 強制重抓並更新快取
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auth, getDoc, fullText } from '../pipeline/judicial.mjs';
import { classifyDoc } from '../pipeline/classify.mjs';
import { rewriteOne } from '../pipeline/rewrite.mjs';
import { verifyDraft, verifyPasses } from '../pipeline/verify.mjs';
import { scanAnonymization, passesGates } from '../pipeline/guard.mjs';
import { THRESHOLDS } from '../pipeline/config.mjs';

const CACHE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../pipeline/.cache/judgments.json');
const JIDS = [
  'STEV,114,店簡,1456,20260609,1', // 不當得利（corporate）
  'SLDV,110,婚,328,20260529,3',     // 離婚/夫妻財產（family）
  'ILDV,115,司促,1717,20260423,1',  // 支付命令/卡債（personal）
  'TPAA,114,再,56,20260528,1',      // 遺產稅再審（wealth-tax）
];

async function loadDocs() {
  if (!process.env.REFETCH) {
    try {
      const cached = JSON.parse(await fs.readFile(CACHE, 'utf8'));
      if (JIDS.every((j) => cached[j])) { console.log('（使用快取，未連 API）\n'); return cached; }
    } catch { /* 無快取 */ }
  }
  console.log('（抓取判決並寫入快取）');
  const token = await auth(process.env.JUD_USER, process.env.JUD_PASS);
  const docs = {};
  for (const jid of JIDS) { try { docs[jid] = await getDoc(token, jid); } catch (e) { console.log(jid, 'getDoc err', e.message); } }
  await fs.mkdir(path.dirname(CACHE), { recursive: true });
  await fs.writeFile(CACHE, JSON.stringify(docs), 'utf8');
  console.log('已快取 →', CACHE, '\n');
  return docs;
}

const docs = await loadDocs();
for (const jid of JIDS) {
  const doc = docs[jid];
  if (!doc) { console.log(jid, '無資料'); continue; }
  const ft = fullText(doc);
  const cls = classifyDoc(doc);
  if (!cls) { console.log(jid, `未分類（全文 ${ft.length} 字）`); continue; }
  const cand = { doc, category: cls.category, fullTextStr: ft };
  const a = await rewriteOne(cand, []);
  if (a.error) { console.log(jid, 'rewrite err', a.error); continue; }
  const faqText = Array.isArray(a.faq) ? a.faq.map((f) => `${f.q} ${f.a}`).join(' ') : '';
  const scan = scanAnonymization([a.body_markdown, a.description, faqText].filter(Boolean).join('\n'));
  const gate1 = passesGates(a, scan) && typeof a.title === 'string' && a.title.length > 0;
  let v = null, gate2 = false;
  if (gate1) { v = await verifyDraft(cand, a); gate2 = verifyPasses(v, THRESHOLDS.worthinessMin); }
  console.log(`${jid} [${cls.category.key}]（全文 ${ft.length} 字）`);
  console.log(`  標題：${a.title}`);
  console.log(`  gate1=${!!gate1}（rel=${a.relevance_score} qual=${a.quality_score} scan=${scan.ok}）`);
  console.log(`  gate2=${gate2}（${v && !v.error ? `faithful=${v.faithful} relevant=${v.relevant} worth=${v.worthiness}` : (v && v.error)}）`);
  console.log(`  ==> ${gate1 && gate2 ? '✅ 通過（可發佈）' : '✗ 擋'}\n`);
}
