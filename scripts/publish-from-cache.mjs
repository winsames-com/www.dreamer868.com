// 一次性：用本機快取的判決（pipeline/.cache/judgments.json）跑完整發佈流程，
// 過雙關卡者寫入 src/content/articles 並加入帳本。讓「今天就有文章」（服務窗外亦可，不連 API）。
// 每件最多嘗試 MAX_TRIES 次以吸收 claude 跨次變動。
//   node scripts/publish-from-cache.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THRESHOLDS, PATHS } from '../pipeline/config.mjs';
import { fullText, caseSourceOf } from '../pipeline/judicial.mjs';
import { classifyDoc } from '../pipeline/classify.mjs';
import { rewriteOne } from '../pipeline/rewrite.mjs';
import { verifyDraft, verifyPasses } from '../pipeline/verify.mjs';
import { scanAnonymization, passesGates } from '../pipeline/guard.mjs';
import { buildArticle, nextSlug } from '../pipeline/markdown.mjs';
import { loadSeen, saveSeen } from '../pipeline/state.mjs';

const CACHE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../pipeline/.cache/judgments.json');
const MAX_TRIES = 2;
const dateStr = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10); // 台灣日期

const docs = JSON.parse(await fs.readFile(CACHE, 'utf8'));
const seen = await loadSeen(PATHS.seen);
const existing = (await fs.readdir(PATHS.articles)).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
const slugs = [...existing];
const published = [];

for (const [jid, doc] of Object.entries(docs)) {
  const ft = fullText(doc);
  const cls = classifyDoc(doc);
  if (!cls || !ft.trim()) { console.log(jid, 'skip（無分類/全文）'); continue; }
  const cand = { doc, category: cls.category, fullTextStr: ft };
  let done = false;
  for (let t = 1; t <= MAX_TRIES && !done; t++) {
    const a = await rewriteOne(cand, []);
    if (a.error) { console.log(`${jid} try${t} rewrite err: ${a.error}`); continue; }
    const faqText = Array.isArray(a.faq) ? a.faq.map((f) => `${f.q} ${f.a}`).join(' ') : '';
    const scan = scanAnonymization([a.body_markdown, a.description, faqText].filter(Boolean).join('\n'));
    const gate1 = passesGates(a, scan) && typeof a.title === 'string' && a.title.length > 0;
    let v = null, gate2 = false;
    if (gate1) { v = await verifyDraft(cand, a); gate2 = verifyPasses(v, THRESHOLDS.worthinessMin); }
    if (gate1 && gate2) {
      const slug = nextSlug(cls.category, slugs); slugs.push(slug);
      const order = 10 + slugs.filter((s) => s.startsWith(cls.category.slugPrefix)).length;
      const md = buildArticle({
        category: cls.category, slug, title: a.title,
        bodyMarkdown: a.body_markdown || '', description: a.description, faq: a.faq,
        caseSource: caseSourceOf(doc, ft), order, dateStr,
      });
      await fs.writeFile(path.join(PATHS.articles, `${slug}.md`), md, 'utf8');
      seen.add(jid);
      published.push({ slug, title: a.title });
      console.log(`${jid} ✅ 發佈 ${slug}「${a.title}」`);
      done = true;
    } else {
      const reason = !gate1
        ? `gate1(rel=${a.relevance_score},qual=${a.quality_score},scan=${scan.ok})`
        : `gate2(${v && v.error ? v.error : `faithful=${v.faithful},worth=${v.worthiness}`})`;
      console.log(`${jid} try${t} ✗ ${reason}`);
    }
  }
  if (!done) console.log(`${jid} ${MAX_TRIES} 次未過，略過`);
}
await saveSeen(PATHS.seen, seen);
console.log(`\n=== 發佈 ${published.length} 篇 ===`);
for (const p of published) console.log(`  ${p.slug}：${p.title}`);
