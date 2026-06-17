// pipeline/dev-run.mjs
// 開發專用：用 fixtures/judgments.mjs 的範例判決跑「分類 → claude -p 改編 →
// 雙關卡查核 → 產出」整條，**不碰即時 API、不 commit、不更新帳本**。
// 結果寫到 pipeline/quarantine/ 供檢視。需 `claude` 已登入訂閱帳戶。
//
// 用途：API 限時（台灣 0–6 點）時仍可隨時開發/驗證改編與閘門品質。
// 執行：node pipeline/dev-run.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { THRESHOLDS, PATHS } from './config.mjs';
import { fullText, caseSourceOf } from './judicial.mjs';
import { classifyDoc } from './classify.mjs';
import { rewriteCandidates } from './rewrite.mjs';
import { verifyDraft, verifyPasses } from './verify.mjs';
import { scanAnonymization, passesGates } from './guard.mjs';
import { buildArticle, nextSlug } from './markdown.mjs';
import { FIXTURES } from './fixtures/judgments.mjs';
import { FIXTURE_QUERY_ROWS } from './insights/fixtures/queries.mjs';
import { bucketize } from './insights/buckets.mjs';

function log(...a) { console.log('[dev-run]', ...a); }

async function main() {
  const dateStr = new Date().toISOString().slice(0, 10);

  // 分類
  const candidates = [];
  for (const doc of FIXTURES) {
    const cls = classifyDoc(doc);
    log(`分類 ${doc.JID} JTITLE="${doc.JTITLE}" →`, cls ? `${cls.category.key} (score=${cls.score})` : '無相關，略過');
    if (cls) candidates.push({ doc, category: cls.category, fullTextStr: fullText(doc), score: cls.score });
  }
  if (candidates.length === 0) { log('無候選'); return; }

  // claude -p 改編
  log(`改編 ${candidates.length} 件（claude -p，可能需數十秒/件）…`);
  const termsByCategory = bucketize(FIXTURE_QUERY_ROWS);
  log('GSC 字詞分流(fixture)：', Object.entries(termsByCategory).map(([k, v]) => `${k}=${v.length}`).join(' '));
  const results = await rewriteCandidates(candidates, termsByCategory);

  await fs.mkdir(PATHS.quarantine, { recursive: true });
  const slugs = [];
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const a = results.get(`cand-${i}`);
    if (!a || a.error) { log(`✗ ${cand.doc.JID} 改編失敗:`, a && a.error); continue; }

    const faqText = Array.isArray(a.faq) ? a.faq.map((f) => `${f.q || ''} ${f.a || ''}`).join(' ') : '';
    const scan = scanAnonymization([a.body_markdown, a.description, faqText].filter(Boolean).join('\n'));
    const gate1 = passesGates(a, scan) && typeof a.title === 'string' && a.title.length > 0;
    let verdict = null, gate2 = false;
    if (gate1) { verdict = await verifyDraft(cand, a); gate2 = verifyPasses(verdict, THRESHOLDS.worthinessMin); }

    const slug = nextSlug(cand.category, slugs);
    slugs.push(slug);
    const md = buildArticle({
      category: cand.category,
      slug,
      title: a.title || `${cand.category.label}案例`,
      bodyMarkdown: a.body_markdown || '',
      description: a.description,
      faq: a.faq,
      caseSource: caseSourceOf(cand.doc, cand.fullTextStr),
      order: 10 + i,
      dateStr,
    });

    const status = gate1 && gate2 ? '✅ 兩關通過（dev：仍寫 quarantine，不發佈）' : (!gate1
      ? `✗ 第一關擋（rel=${a.relevance_score},qual=${a.quality_score},anon=${a.anonymization_ok},scan=${scan.ok}）`
      : `✗ 第二關擋（${verdict && verdict.error ? verdict.error : `anon=${verdict.anonymization_ok},faithful=${verdict.faithful},relevant=${verdict.relevant},worth=${verdict.worthiness}`}）`);
    log(`${cand.category.key} / ${slug}: ${status}`);
    log(`   字號：${caseSourceOf(cand.doc, cand.fullTextStr)}`);
    log(`   標題：${a.title}`);

    const out = path.join(PATHS.quarantine, `dev-${slug}.md`);
    await fs.writeFile(out, `<!-- dev-run ${status} -->\n${md}`, 'utf8');
    log(`   已寫 ${out}`);
  }
  log('完成。檢視 pipeline/quarantine/dev-*.md');
}

main().catch((e) => { console.error('[dev-run] FATAL', e); process.exit(1); });
