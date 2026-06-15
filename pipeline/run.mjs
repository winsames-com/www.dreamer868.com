// pipeline/run.mjs
// 全流程：auth -> JList -> 字別預過濾 -> dedup -> JDoc -> 分類 -> 取每分眾上限 ->
//         claude -p 改編 -> 第一關(化名正則+自評) -> 第二關(獨立 claude -p 查核+故事性) ->
//         寫檔/隔離 -> 更新帳本 -> summary。
// 環境變數：JUD_USER, JUD_PASS, DRY_RUN（"1" 則不寫正式檔、不更新帳本）。
// 改編用 claude -p（本機訂閱帳戶），須先 `claude` 登入；無需 ANTHROPIC_API_KEY。

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CATEGORIES, LIMITS, PATHS, THRESHOLDS } from './config.mjs';
import { auth, getChangeList, getDoc, fullText, caseSourceOf } from './judicial.mjs';
import { prefilterJids, classifyDoc } from './classify.mjs';
import { loadSeen, saveSeen } from './state.mjs';
import { rewriteCandidates } from './rewrite.mjs';
import { verifyDraft, verifyPasses } from './verify.mjs';
import { scanAnonymization, passesGates } from './guard.mjs';
import { buildArticle, nextSlug } from './markdown.mjs';

const DRY_RUN = process.env.DRY_RUN === '1';

function log(...a) { console.log('[pipeline]', ...a); }

async function existingSlugs() {
  const files = await fs.readdir(PATHS.articles);
  return files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
}

async function main() {
  const user = process.env.JUD_USER, pass = process.env.JUD_PASS;
  if (!user || !pass) throw new Error('Missing JUD_USER / JUD_PASS');

  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);

  const token = await auth(user, pass);
  log('authenticated');

  const rawJids = await getChangeList(token);
  log('change list size', rawJids.length);

  const seen = await loadSeen(PATHS.seen);
  const candidatesJids = prefilterJids(rawJids).filter((j) => !seen.has(j));
  log('after prefilter+dedup', candidatesJids.length);

  // 取文 + 分類，依分眾收集（每分眾收到上限即停）
  const perCategory = new Map(CATEGORIES.map((c) => [c.key, []]));
  for (const jid of candidatesJids) {
    const allFull = [...perCategory.values()].every((arr) => arr.length >= LIMITS.perCategoryPerDay);
    if (allFull) break;
    let doc;
    try { doc = await getDoc(token, jid); } catch (e) { log('getDoc err', jid, e.message); continue; }
    if (!doc) { seen.add(jid); continue; }
    seen.add(jid); // 已檢視即記錄，避免重複處理
    const cls = classifyDoc(doc);
    if (!cls) continue;
    const bucket = perCategory.get(cls.category.key);
    if (bucket.length >= LIMITS.perCategoryPerDay) continue;
    bucket.push({ doc, category: cls.category, fullTextStr: fullText(doc), score: cls.score });
  }

  let candidates = [].concat(...perCategory.values());
  if (candidates.length > LIMITS.perDayTotal) candidates = candidates.slice(0, LIMITS.perDayTotal);
  log('candidates to rewrite', candidates.length);

  if (candidates.length === 0) {
    if (!DRY_RUN) await saveSeen(PATHS.seen, seen);
    log('nothing to do');
    return;
  }

  const results = await rewriteCandidates(candidates);

  const slugs = await existingSlugs();
  const published = [];
  const quarantined = [];

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const a = results.get(`cand-${i}`);
    if (!a || a.error) { quarantined.push({ cand, reason: `rewrite:${a && a.error}` }); continue; }

    // 第一關：改編自評 + 確定性化名正則
    const scan = scanAnonymization(a.body_markdown);
    const gate1 = passesGates(a, scan) && typeof a.title === 'string' && a.title.length > 0;

    // 第二關（獨立查核）：僅對第一關通過者呼叫，省 claude -p
    let verdict = null;
    let gate2 = false;
    if (gate1) {
      verdict = await verifyDraft(cand, a);
      gate2 = verifyPasses(verdict, THRESHOLDS.worthinessMin);
    }
    const ok = gate1 && gate2;

    const slug = nextSlug(cand.category, slugs);
    slugs.push(slug);
    const order = 10 + slugs.filter((s) => s.startsWith(cand.category.slugPrefix)).length; // 確保 >10 且遞增
    const md = buildArticle({
      category: cand.category,
      slug,
      title: a.title || `${cand.category.label}案例`,
      bodyMarkdown: a.body_markdown || '',
      caseSource: caseSourceOf(cand.doc, cand.fullTextStr),
      order,
      dateStr,
    });

    if (ok && !DRY_RUN) {
      published.push({ slug, path: path.join(PATHS.articles, `${slug}.md`), md });
    } else {
      const reason = !gate1
        ? `gate1(rel=${a.relevance_score},qual=${a.quality_score},anon=${a.anonymization_ok},scan=${scan.ok})`
        : !gate2
          ? `gate2(${verdict && verdict.error ? verdict.error : `anon=${verdict.anonymization_ok},faithful=${verdict.faithful},relevant=${verdict.relevant},worth=${verdict.worthiness}`})`
          : 'dry_run';
      quarantined.push({ cand, slug, md, reason });
    }
  }

  // 寫檔
  for (const p of published) await fs.writeFile(p.path, p.md, 'utf8');
  for (const q of quarantined) {
    const name = `${q.slug || 'cand'}-${q.cand.doc.JID.replace(/[^A-Za-z0-9]/g, '_')}.md`;
    await fs.writeFile(path.join(PATHS.quarantine, name), `<!-- reason: ${q.reason} -->\n${q.md || ''}`, 'utf8');
  }

  if (!DRY_RUN) await saveSeen(PATHS.seen, seen);

  // GitHub Actions job summary
  const summary = [
    `## 判決 pipeline ${dateStr}`,
    `- 異動清單：${rawJids.length}`,
    `- 候選：${candidates.length}`,
    `- 發佈：${published.length}（${published.map((p) => p.slug).join(', ') || '—'}）`,
    `- 隔離：${quarantined.length}（${quarantined.map((q) => q.reason).join('; ') || '—'}）`,
    DRY_RUN ? '- 模式：DRY_RUN（未寫正式檔、未更新帳本）' : '- 模式：正式',
  ].join('\n');
  log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
}

main().catch((e) => { console.error('[pipeline] FATAL', e); process.exit(1); });
