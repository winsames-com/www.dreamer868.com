// scripts/indexnow-submit.mjs
// 把「本次變動的頁面 URL」提交給 IndexNow（Bing/Yandex 等；Bing 索引餵 ChatGPT Search / Copilot）。
// 由 CI 在部署後呼叫，傳入 git 變動的檔案路徑；對應出對外 URL 後 POST。
// 純發現加速：純 LLM 訓練爬蟲(GPTBot/ClaudeBot…)不走 IndexNow。
//
// 用法：node scripts/indexnow-submit.mjs <changed-file> [<changed-file> ...]
//       node scripts/indexnow-submit.mjs --all      # 提交全部文章＋主要頁面
// 環境變數：INDEXNOW_KEY（必填）

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const HOST = 'www.dreamer868.com';
const SITE = `https://${HOST}`;
const ARTICLES = 'src/content/articles';
const PAGES = 'src/pages';

const KEY = process.env.INDEXNOW_KEY;
if (!KEY) { console.error('缺 INDEXNOW_KEY'); process.exit(1); }

const slugOf = async (file) => {
  try {
    const raw = await fs.readFile(path.join(REPO, file), 'utf8');
    const m = raw.match(/^slug:\s*(.+)$/m);
    return m ? m[1].trim().replace(/^["'](.*)["']$/, '$1') : path.basename(file, '.md');
  } catch { return path.basename(file, '.md'); }
};

// src/pages/foo/bar.astro → /foo/bar/；index → 上層；動態/端點略過
function pageUrl(file) {
  let rel = file.slice(`${PAGES}/`.length);
  if (rel.includes('[')) return null;                 // 動態路由由文章 md 處理
  if (!rel.endsWith('.astro')) return null;           // .ts 端點(rss/llms)略過
  rel = rel.replace(/\.astro$/, '');
  if (rel === 'index') return `${SITE}/`;
  if (rel.endsWith('/index')) rel = rel.slice(0, -'/index'.length);
  if (rel === '404') return null;
  return `${SITE}/${rel}/`;
}

async function urlsFromChanged(files) {
  const out = new Set();
  for (const f of files) {
    if (f.startsWith(`${ARTICLES}/`) && f.endsWith('.md')) out.add(`${SITE}/articles/${await slugOf(f)}/`);
    else if (f.startsWith(`${PAGES}/`)) { const u = pageUrl(f); if (u) out.add(u); }
  }
  return [...out];
}

async function allUrls() {
  const out = new Set([`${SITE}/`]);
  const files = (await fs.readdir(path.join(REPO, ARTICLES))).filter((f) => f.endsWith('.md'));
  for (const f of files) out.add(`${SITE}/articles/${await slugOf(`${ARTICLES}/${f}`)}/`);
  return [...out];
}

async function main() {
  let args = process.argv.slice(2);
  const DRY = args.includes('--dry');
  args = args.filter((a) => a !== '--dry');
  const urls = args[0] === '--all' ? await allUrls() : await urlsFromChanged(args);
  if (!urls.length) { console.log('IndexNow：無對應 URL，略過'); return; }

  const body = { host: HOST, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls };
  console.log(`IndexNow ${DRY ? '(DRY) ' : ''}提交 ${urls.length} 筆：`, urls.join(' '));
  if (DRY) return;

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  console.log(`IndexNow 回應：${res.status} ${res.statusText}`);
  // 200/202 為成功；其餘印出內容但不讓部署失敗
  if (res.status >= 400) console.error(await res.text().catch(() => ''));
}

main().catch((e) => { console.error('IndexNow 提交失敗（不阻斷部署）：', e.message); });
