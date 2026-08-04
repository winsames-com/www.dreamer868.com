// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// sitemap 的 lastmod 來源（2026-08-04 補）。
//
// 原本整份 sitemap 一個 lastmod 都沒有，只給 changefreq 與 priority，而 Google 公開說過那兩個
// 它不看，lastmod 才是它排爬取順序、以及判斷「這份清單值不值得重讀」的依據。
// 同批發現：本站在 Search Console **從未提交過任何 sitemap**（sitemaps.list 回空陣列），
// 線上卻有 293 個網址；2026-08-04 已補登記。沒有 lastmod 時，seo-ops 每日的「sitemap 過期就
// 重新提交」只剩「網址數變了」這一個判準會生效——內容更新（改寫既有文章）永遠不會觸發重送。
//
// 鐵律：逐頁給真實日期。整份塞 new Date() 等於宣稱全站今天都改過，Google 會折扣整份 sitemap。
function contentDates() {
  const map = new Map();
  const dir = 'src/content/articles';
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const src = readFileSync(`${dir}/${f}`, 'utf8');
    const slug = src.match(/^slug:\s*"?([^"\s]+)"?/m);
    if (!slug) continue;
    // updatedDate 是「真實最後更新日」，沒填才退回 date（見 src/content.config.ts 的欄位註解）
    const day = src.match(/^updatedDate:\s*"?(\d{4}-\d{2}-\d{2})/m) ?? src.match(/^date:\s*"?(\d{4}-\d{2}-\d{2})/m);
    if (day) map.set(`/articles/${slug[1]}`, day[1]);
  }
  return map;
}

// 靜態頁沒有 frontmatter，用該頁原始檔的最後一次 commit 日期當 lastmod。
// 查不到就不給——寧可缺 lastmod，也不給一個編出來的日期。
function pageGitDate(path) {
  const candidates = path === '/'
    ? ['src/pages/index.astro']
    : [`src/pages${path}/index.astro`, `src/pages${path}.astro`];
  for (const file of candidates) {
    try {
      const out = execSync(`git log -1 --format=%cs -- ${file}`, { encoding: 'utf8' }).trim();
      if (out) return out;
    } catch { /* 不在 git 或查不到就略過 */ }
  }
  return null;
}

const CONTENT_DATES = contentDates();

export default defineConfig({
  site: 'https://www.dreamer868.com',
  output: 'static',
  build: {
    format: 'directory',
  },
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      serialize(item) {
        const path = new URL(item.url).pathname.replace(/\/$/, '') || '/';
        const day = CONTENT_DATES.get(path) ?? pageGitDate(path);
        if (day) item.lastmod = new Date(`${day}T00:00:00Z`).toISOString();
        return item;
      },
    }),
  ],
});
