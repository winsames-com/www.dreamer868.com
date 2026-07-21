// scripts/gen-descriptions.mjs
// 一次性內容工具：替 src/content/articles/*.md 產生每篇獨立 meta description（GEO/AEO #2）。
// 用 claude -p（本機訂閱身分）摘要「文章自身內容」（非捏造），寫回 frontmatter 的 description。
// 已有 description 的檔案略過。可重跑（冪等）。
//
// 用法：
//   node scripts/gen-descriptions.mjs            # 全量
//   node scripts/gen-descriptions.mjs --limit 6  # 先抽樣 N 篇驗證品質
//   node scripts/gen-descriptions.mjs --dry       # 只印不寫檔

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { askJson } from '../pipeline/claude.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '../src/content/articles');
const BATCH = 8;

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const limIdx = args.indexOf('--limit');
const LIMIT = limIdx >= 0 ? Number(args[limIdx + 1]) : Infinity;

function splitFrontmatter(raw) {
  if (!raw.startsWith('---')) return null;
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return null;
  const fm = raw.slice(0, end + 4); // 含結尾 ---
  const body = raw.slice(end + 4);
  return { fm, body };
}

const fieldOf = (fm, key) => {
  const v = (fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm')) || [])[1]?.trim();
  return v?.replace(/^["'](.*)["']$/, '$1'); // 去除外層引號
};

function cleanBody(body) {
  return body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // 圖片
    .replace(/^\*Photo by.*$/gim, '')           // 圖片 credit
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 1800);
}

function injectDescription(raw, fm, body, desc) {
  const esc = desc.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const newFm = fm.replace(/^(title:\s*.+)$/m, `$1\ndescription: "${esc}"`);
  return newFm + body;
}

async function main() {
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.md')).sort();
  const todo = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(DIR, f), 'utf8');
    const parts = splitFrontmatter(raw);
    if (!parts) { console.log('略過(無 frontmatter):', f); continue; }
    if (fieldOf(parts.fm, 'description')) continue; // 已有
    const slug = fieldOf(parts.fm, 'slug') || f.replace(/\.md$/, '');
    todo.push({ file: f, slug, title: fieldOf(parts.fm, 'title'), category: fieldOf(parts.fm, 'category'), raw, ...parts });
    if (todo.length >= LIMIT) break;
  }
  console.log(`待產生：${todo.length} 篇（batch=${BATCH}${DRY ? '，DRY' : ''}）`);

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const prompt = [
      '你是台灣財務規劃網站的 SEO/AEO 編輯。為每篇文章寫一句 meta description，規則：',
      '- 繁體中文（台灣用語），48–80 字，單行，精準摘要「該篇實際內容」，不得杜撰未提及的事實。',
      '- 開頭點出主題，讓搜尋者與 AI 一眼知道這篇在講什麼、能解決什麼問題。自然帶到主題關鍵字。',
      '- 不要用雙引號、不要以標點開頭、不要寫「本文/這篇文章」這類贅詞。',
      '- 去 AI 味（本站有 check-content 守門）：禁破折號（——）、禁「不是X而是Y」句式、禁「值得注意的是/換句話說」、禁「研究顯示/專家認為」等無出處模糊引用、禁「至關重要/不可或缺」拔高語。',
      '只輸出 JSON 陣列，每元素 {slug, description}，slug 用我給的值。',
      '',
      ...batch.map((a) => `=== slug: ${a.slug} ｜ 標題: ${a.title} ｜ 分類: ${a.category} ===\n${cleanBody(a.body)}`),
    ].join('\n');

    let arr;
    try {
      arr = await askJson(prompt, { timeoutMs: 240000 });
    } catch (e) {
      console.error(`batch ${i / BATCH + 1} 失敗：${e.message}（跳過此批）`);
      continue;
    }
    const bySlug = new Map((Array.isArray(arr) ? arr : []).map((x) => [x.slug, x.description]));

    for (const a of batch) {
      const desc = bySlug.get(a.slug);
      if (!desc || typeof desc !== 'string') { console.log('  ⚠ 無回傳:', a.slug); continue; }
      const clean = desc.replace(/\s+/g, ' ').trim();
      console.log(`  ${a.slug}: ${clean}`);
      if (!DRY) {
        const out = injectDescription(a.raw, a.fm, a.body, clean);
        await fs.writeFile(path.join(DIR, a.file), out, 'utf8');
      }
    }
    console.log(`batch ${i / BATCH + 1}/${Math.ceil(todo.length / BATCH)} 完成`);
  }
  console.log('完成。');
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
