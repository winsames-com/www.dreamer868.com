// scripts/gen-faq.mjs
// 一次性內容工具：替文章產生 2–4 組「常見問答」(faq) 寫入 frontmatter（GEO/AEO #3）。
// 問題＝讀者就此主題會問的自然問句；答案＝以「文章既有內容」為依據的精簡回答，
// 不得加入文章未提及的數字/事實（YMYL 防杜撰）。已有 faq 的檔案略過、可重跑。
//
// 用法：node scripts/gen-faq.mjs [--limit N] [--dry]

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudePrint } from '../pipeline/claude.mjs';

// 從 claude -p 回傳中穩健擷取 JSON 陣列（容忍前後贅字/```fence）
async function askJsonArray(prompt, opts) {
  const env = JSON.parse(await claudePrint(prompt, opts));
  if (env.is_error || typeof env.result !== 'string') throw new Error('claude_error');
  const s = env.result;
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('no JSON array in result: ' + s.slice(0, 80));
  return JSON.parse(s.slice(start, end + 1));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '../src/content/articles');
const BATCH = 5;

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const limIdx = args.indexOf('--limit');
const LIMIT = limIdx >= 0 ? Number(args[limIdx + 1]) : Infinity;

function splitFrontmatter(raw) {
  if (!raw.startsWith('---')) return null;
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return null;
  return { fm: raw.slice(0, end + 4), body: raw.slice(end + 4) };
}
const fieldOf = (fm, key) => {
  const v = (fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm')) || [])[1]?.trim();
  return v?.replace(/^["'](.*)["']$/, '$1');
};
const cleanBody = (b) => b.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/^\*Photo by.*$/gim, '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2200);
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s+/g, ' ').trim();

function injectFaq(fm, body, faq) {
  const yaml = 'faq:\n' + faq.map((f) => `  - q: "${esc(f.q)}"\n    a: "${esc(f.a)}"`).join('\n');
  // 接在 description 後；無 description 則接在 title 後
  if (/^description:\s*.+$/m.test(fm)) return fm.replace(/^(description:\s*.+)$/m, `$1\n${yaml}`) + body;
  return fm.replace(/^(title:\s*.+)$/m, `$1\n${yaml}`) + body;
}

async function main() {
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.md')).sort();
  const todo = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(DIR, f), 'utf8');
    const parts = splitFrontmatter(raw);
    if (!parts) continue;
    if (/^faq:/m.test(parts.fm)) continue; // 已有
    todo.push({ file: f, raw, ...parts, slug: fieldOf(parts.fm, 'slug') || f.replace(/\.md$/, ''), title: fieldOf(parts.fm, 'title'), category: fieldOf(parts.fm, 'category') });
    if (todo.length >= LIMIT) break;
  }
  console.log(`待產生 faq：${todo.length} 篇（batch=${BATCH}${DRY ? '，DRY' : ''}）`);

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const prompt = [
      '你是台灣財務規劃網站的 AEO 編輯。為每篇文章產生「常見問答」(FAQ)，規則：',
      '- 每篇 2–4 組，繁體中文（台灣用語）。',
      '- 問題：讀者就此主題會實際搜尋/詢問的自然問句（口語、具體）。',
      '- 答案：30–90 字，精簡直球，**只能根據該篇文章已陳述的內容**作答，不得加入文章未提及的數字、法條、事實；若文章未涵蓋就不要編。',
      '- 不要用雙引號。問答要能獨立被引用（答案自成完整句）。',
      '- 去 AI 味（本站有 check-content 守門）：禁破折號（——）、禁「不是X而是Y」句式、禁「值得注意的是/換句話說」、禁「研究顯示/專家認為」等無出處模糊引用、禁「至關重要/不可或缺」拔高語。',
      '只輸出 JSON 陣列，每元素 {slug, faq:[{q,a},...]}，slug 用我給的值。',
      '',
      ...batch.map((a) => `=== slug: ${a.slug} ｜ 標題: ${a.title} ｜ 分類: ${a.category} ===\n${cleanBody(a.body)}`),
    ].join('\n');

    let arr;
    try { arr = await askJsonArray(prompt, { timeoutMs: 280000 }); }
    catch (e) { console.error(`batch ${i / BATCH + 1} 失敗：${e.message}`); continue; }
    const bySlug = new Map((Array.isArray(arr) ? arr : []).map((x) => [x.slug, x.faq]));

    for (const a of batch) {
      const faq = bySlug.get(a.slug);
      if (!Array.isArray(faq) || !faq.length) { console.log('  ⚠ 無回傳:', a.slug); continue; }
      const clean = faq.filter((f) => f && f.q && f.a).slice(0, 4);
      console.log(`  ${a.slug}: ${clean.length} 組 Q&A`);
      if (!DRY) await fs.writeFile(path.join(DIR, a.file), injectFaq(a.fm, a.body, clean), 'utf8');
    }
    console.log(`batch ${i / BATCH + 1}/${Math.ceil(todo.length / BATCH)} 完成`);
  }
  console.log('完成。');
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
