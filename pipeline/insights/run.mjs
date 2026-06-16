// pipeline/insights/run.mjs
// 拉 Search Console 搜尋字詞/頁面 + GA4 熱門頁，印出並寫成 markdown 報告。
// 用途：把搜尋需求回饋到文章撰寫（選題、標題、補缺）。
// 跑法（repo 根目錄）：node pipeline/insights/run.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { postJson } from './auth.mjs';
import {
  GA4_PROPERTY_ID, GSC_SITE, REPORTS_DIR, WINDOW_DAYS, GSC_LAG_DAYS, TOP_N,
} from './config.mjs';
import { bucketize } from './buckets.mjs';
import { gapAnalysis } from './gap.mjs';
import { CATEGORIES } from '../config.mjs';

const fmtDate = (d) => d.toISOString().slice(0, 10);

function windowDates() {
  const end = new Date();
  end.setDate(end.getDate() - GSC_LAG_DAYS);
  const start = new Date(end);
  start.setDate(start.getDate() - WINDOW_DAYS);
  return { startDate: fmtDate(start), endDate: fmtDate(end) };
}

// Search Console search analytics：依指定維度取 top N。
async function gscTop(dimension, startDate, endDate) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`;
  const r = await postJson(url, { startDate, endDate, dimensions: [dimension], rowLimit: TOP_N });
  if (!r.ok) return { error: `${r.status} ${r.reason || ''} ${r.message}` };
  return { rows: r.data.rows || [] };
}

// GA4 熱門頁（過去 WINDOW_DAYS 天的 pageviews）。
async function ga4TopPages() {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`;
  const r = await postJson(url, {
    dateRanges: [{ startDate: `${WINDOW_DAYS}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: TOP_N,
  });
  if (!r.ok) return { error: `${r.status} ${r.reason || ''} ${r.message}` };
  return { rows: r.data.rows || [] };
}

function mdTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return rows.length ? `${head}\n${body}` : '（無資料）';
}

async function main() {
  const { startDate, endDate } = windowDates();
  console.log(`[insights] GSC 窗 ${startDate} ~ ${endDate}；GA4 窗 ${WINDOW_DAYS}daysAgo ~ today`);

  // 依分眾收集現有文章標題（用 subcategory 對應 category.key）
  const subToKey = Object.fromEntries(CATEGORIES.map((c) => [c.subcategory, c.key]));
  const titlesByCat = {};
  try {
    const dir = 'src/content/articles';
    for (const f of await fs.readdir(dir)) {
      if (!f.endsWith('.md')) continue;
      const txt = await fs.readFile(`${dir}/${f}`, 'utf8');
      const sub = (txt.match(/^subcategory:\s*"?([^"\n]+)"?/m) || [])[1];
      const title = (txt.match(/^title:\s*(.+)$/m) || [])[1];
      const key = subToKey[sub];
      if (key && title) (titlesByCat[key] ||= []).push(title.trim());
    }
  } catch (e) { console.log('[insights] 讀文章標題失敗，缺口分析略過涵蓋比對:', e.message); }

  const [queries, pages, ga4] = await Promise.all([
    gscTop('query', startDate, endDate),
    gscTop('page', startDate, endDate),
    ga4TopPages(),
  ]);

  // 搜尋字詞表（含曝光高/CTR 低 → 改標題的訊號）
  const qRows = (queries.rows || []).map((r) => [
    r.keys[0], r.clicks, r.impressions, `${(r.ctr * 100).toFixed(1)}%`, r.position.toFixed(1),
  ]);
  const pRows = (pages.rows || []).map((r) => [
    r.keys[0].replace('https://www.dreamer868.com', ''), r.clicks, r.impressions,
    `${(r.ctr * 100).toFixed(1)}%`, r.position.toFixed(1),
  ]);
  const gRows = (ga4.rows || []).map((r) => [r.dimensionValues[0].value, r.metricValues[0].value]);

  const bucketed = bucketize((queries.rows || []).map((r) => ({
    query: r.keys[0], clicks: r.clicks, impressions: r.impressions,
  })));
  const gaps = gapAnalysis(bucketed, titlesByCat);
  const gapSection = Object.entries(gaps)
    .map(([cat, rows]) => `### ${cat}\n` + (rows.length
      ? mdTable(['缺口字詞', '曝光'], rows.map((r) => [r.query, r.impressions]))
      : '（無缺口）'))
    .join('\n\n');
  const unbucketed = bucketed._unbucketed.length
    ? mdTable(['字詞', '曝光'], bucketed._unbucketed.map((r) => [r.query, r.impressions]))
    : '（無）';

  const report = [
    `# 內容洞察報告（${startDate} ~ ${endDate}）`,
    '',
    `> 資料來源：Search Console（${GSC_SITE}）+ GA4（property ${GA4_PROPERTY_ID}）`,
    '',
    '## 搜尋字詞 Top（用來：選題、改標題）',
    queries.error ? `⚠️ ${queries.error}` : mdTable(['查詢字詞', '點擊', '曝光', 'CTR', '平均排名'], qRows),
    '',
    '## 搜尋到達頁 Top',
    pages.error ? `⚠️ ${pages.error}` : mdTable(['頁面', '點擊', '曝光', 'CTR', '平均排名'], pRows),
    '',
    '## GA4 熱門頁（站內瀏覽）',
    ga4.error ? `⚠️ ${ga4.error}` : mdTable(['頁面路徑', '瀏覽數'], gRows),
    '',
    '## ③ 選題缺口（有人搜、站上分眾文章標題未涵蓋）',
    gapSection,
    '',
    '## 未分類搜尋詞（潛在全新主題線索）',
    unbucketed,
    '',
  ].join('\n');

  // 終端摘要
  console.log(`[insights] GSC 查詢字詞: ${queries.error ? '✗ ' + queries.error : qRows.length + ' 筆'}`);
  console.log(`[insights] GSC 到達頁:   ${pages.error ? '✗ ' + pages.error : pRows.length + ' 筆'}`);
  console.log(`[insights] GA4 熱門頁:    ${ga4.error ? '✗ ' + ga4.error : gRows.length + ' 筆'}`);

  await fs.mkdir(REPORTS_DIR, { recursive: true });
  const out = path.join(REPORTS_DIR, `insights-${endDate}.md`);
  await fs.writeFile(out, report, 'utf8');
  console.log(`[insights] 報告已寫入 ${out}`);
}

main().catch((e) => { console.error('[insights] FATAL', e); process.exit(1); });
