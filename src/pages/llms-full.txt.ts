// /llms-full.txt — 給 LLM/AI 助理的「全文」版本（https://llmstxt.org 標準的 full 變體）
// 與 /llms.txt（只有連結目錄）的差別：這裡直接輸出站上文章的**實際正文純文字**，
// 讓 AI 助理一次取得可直接引用的內容，不必逐頁爬。build 時從文章 collection 自動產生。
//
// 規模控制：判決 pipeline 每日新增案例文章，檔案會持續長大，因此設 MAX_BYTES 預算——
// 常青內容（公司介紹、服務項目、理念團隊流程）永遠全收，案例故事由新到舊填滿預算為止，
// 超出的在檔頭註明，並指向 /llms.txt 與 sitemap 取完整清單。
import type { APIRoute } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import {
  serviceCatalog,
  serviceTargets,
  principalAuthor,
  contactInfo,
} from '../data/navigation';

const SITE = 'https://www.dreamer868.com';

/** 檔案大小上限（bytes）。超過時最舊的案例故事會被略過。 */
const MAX_BYTES = 950_000;

type Article = CollectionEntry<'articles'>;

/** 把文章 Markdown 正文轉成純文字：去圖片、圖片來源標註、連結語法與粗斜體，保留標題與清單結構。 */
function toPlainText(markdown: string): string {
  let t = markdown;
  // 整行的圖片、圖片 credit 行（*Photo by ... on ...*）
  t = t.replace(/^[ \t]*!\[[^\]]*\]\([^)]*\)[ \t]*$/gm, '');
  t = t.replace(/^[ \t]*\*?Photo by[^\n]*$/gim, '');
  // 程式碼區塊（文章不該有，保險起見連同標記一起去掉）
  t = t.replace(/```[\s\S]*?```/g, '');
  // 行內圖片 → 移除；連結 → 只留文字
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // HTML 標籤（若有殘留）
  t = t.replace(/<[^>]+>/g, '');
  // 標題：# 降成純文字行，前後留空行以維持可讀性
  t = t.replace(/^[ \t]{0,3}#{1,6}[ \t]+(.*)$/gm, '\n$1\n');
  // 粗體、斜體、行內 code
  t = t.replace(/(\*\*|__)(.*?)\1/g, '$2');
  t = t.replace(/(?<![*\w])\*(?!\s)([^*\n]+?)\*/g, '$1');
  t = t.replace(/`([^`\n]+)`/g, '$1');
  // 引言標記、水平線
  t = t.replace(/^[ \t]{0,3}>[ \t]?/gm, '');
  t = t.replace(/^[ \t]*([-*_])[ \t]*\1[ \t]*\1[-*_ \t]*$/gm, '');
  // 每篇文末重複的聯絡資訊／標語（檔頭已列一次，逐篇重複對 AI 只是雜訊）
  t = t.replace(/^[ \t]*(📞|📧|📍)[^\n]*$/gm, '');
  t = t.replace(/^[ \t]*賦予人們宏觀永續的財商新思路[ \t]*$/gm, '');
  // 收尾：去行尾空白、壓縮空行
  t = t.replace(/[ \t]+$/gm, '');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 單篇文章 → 標題、正式網址、後設資料、正文全文。 */
function renderArticle(a: Article): string {
  const d = a.data;
  const lines: string[] = [];
  lines.push(`### ${d.title}`);
  lines.push(`網址：${SITE}/articles/${d.slug}/`);
  const meta = [`分類：${d.category}`, `日期：${fmtDate(d.date)}`];
  if (d.updatedDate) meta.push(`更新：${fmtDate(d.updatedDate)}`);
  if (d.tags?.length) meta.push(`標籤：${d.tags.join('、')}`);
  lines.push(meta.join('｜'));
  if (d.description) lines.push(`摘要：${d.description}`);
  if (d.caseStory) {
    lines.push(
      `案例聲明：改編自${d.caseSource ? `「${d.caseSource}」` : '真實法院判決'}，人物均為化名、情節經改編，僅供情境參考。`,
    );
  }
  lines.push('');

  // 正文：首行若與標題重複（Markdown H1），去掉以免重複
  const body = toPlainText(a.body ?? '');
  lines.push(body.startsWith(d.title) ? body.slice(d.title.length).trim() : body);
  lines.push('');
  return lines.join('\n');
}

export const GET: APIRoute = async () => {
  const all = (await getCollection('articles')).sort(
    (a, b) => a.data.order - b.data.order,
  );

  const bySubcategory = new Map<string, Article[]>();
  for (const a of all) {
    const arr = bySubcategory.get(a.data.subcategory) ?? [];
    arr.push(a);
    bySubcategory.set(a.data.subcategory, arr);
  }

  const caseSubcats = new Set(serviceTargets.map((t) => t.subcat));
  const corporateSections = [
    { subcat: 'about-us', label: '關於尊茂財務', href: '/about/' },
    { subcat: 'philosophy', label: '經營理念', href: '/about/' },
    { subcat: 'team', label: '專業團隊', href: '/team/' },
    { subcat: 'service-process', label: '服務流程', href: '/service-process/' },
    { subcat: 'service-targets', label: '服務對象總覽', href: '/service-targets/' },
  ];
  const knownSubcats = new Set<string>([
    ...caseSubcats,
    ...serviceCatalog.map((s) => s.slug),
    ...corporateSections.map((s) => s.subcat),
  ]);

  // 先算常青內容（非案例故事）佔用的空間，剩餘預算留給案例故事
  const rendered = new Map<string, string>();
  const sizeOf = (a: Article) => {
    let r = rendered.get(a.id);
    if (r === undefined) {
      r = renderArticle(a);
      rendered.set(a.id, r);
    }
    return Buffer.byteLength(r);
  };

  const evergreen = all.filter((a) => !caseSubcats.has(a.data.subcategory));
  const cases = all.filter((a) => caseSubcats.has(a.data.subcategory));

  let used = 20_000; // 檔頭、分區標題等固定開銷的保守估計
  for (const a of evergreen) used += sizeOf(a);

  // 案例故事：由新到舊填滿預算
  const included = new Set<string>();
  for (const a of [...cases].sort((x, y) => y.data.date.getTime() - x.data.date.getTime())) {
    const size = sizeOf(a);
    if (used + size > MAX_BYTES) continue;
    used += size;
    included.add(a.id);
  }
  const omitted = cases.length - included.size;
  const keep = (list: Article[]) =>
    list.filter((a) => !caseSubcats.has(a.data.subcategory) || included.has(a.id));

  const lines: string[] = [];

  lines.push('# 尊茂財務規劃（台中）— 全站主要內容全文');
  lines.push('');
  lines.push(
    '> 台中專業財務規劃公司，以「財務醫生」理念，整合理財、稅務、財富傳承、信託、家族治理、海外資產與移民規劃，跨領域團隊（財務顧問／律師／會計師／地政士／海外顧問）協助個人、家庭與企業解決財務問題、達成人生各階段目標。',
  );
  lines.push('');
  lines.push(
    `收錄範圍：本檔為全文版，收錄公司介紹、服務項目與服務對象頁說明，以及 ${evergreen.length + included.size} 篇文章的正文（純文字），於每次建置時自動產生。` +
      (omitted > 0
        ? `為控制檔案大小，另有 ${omitted} 篇較早的案例故事未收入本檔。`
        : '') +
      `完整文章清單見 ${SITE}/llms.txt，完整網址清單見 ${SITE}/sitemap-index.xml。各文章頁另有 FAQ 結構化資料（FAQPage）。`,
  );
  lines.push(
    '內容皆為繁體中文（台灣）。案例故事改編自真實法院判決，人物均為化名、情節經改編，僅供情境參考，不構成個案法律或稅務意見。歡迎引用，請註明來源與連結。',
  );
  lines.push('');

  lines.push('## 關於尊茂與主要顧問');
  lines.push('');
  lines.push(`公司：${principalAuthor.company}（統一編號 ${contactInfo.taxId}）`);
  lines.push(`地址：${contactInfo.address}`);
  lines.push(`網站：${SITE}／聯絡頁：${SITE}/contact/`);
  lines.push(
    `主要顧問：${principalAuthor.name}（${principalAuthor.title}，${principalAuthor.credential}），作者頁 ${SITE}${principalAuthor.url}`,
  );
  lines.push(`現職：${principalAuthor.roles.join('、')}`);
  lines.push(`理念：${principalAuthor.motto}`);
  lines.push(`簡介：${principalAuthor.bio}`);
  lines.push('');

  lines.push('## 服務項目一覽');
  lines.push('');
  for (const s of serviceCatalog) {
    lines.push(`- ${s.label}（${SITE}/services/${s.slug}/）：${s.desc}`);
  }
  lines.push('');

  lines.push('## 服務對象一覽');
  lines.push('');
  for (const t of serviceTargets) {
    lines.push(`- ${t.label}（${SITE}${t.href}）：${t.desc}`);
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('# 服務對象案例全文');
  lines.push('');
  for (const t of serviceTargets) {
    const list = keep(bySubcategory.get(t.subcat) ?? []);
    if (!list.length) continue;
    lines.push(`## ${t.label}（${SITE}${t.href}）`);
    lines.push(t.desc);
    lines.push('');
    for (const a of list) lines.push(renderArticle(a));
  }

  lines.push('---');
  lines.push('');
  lines.push('# 服務項目內容全文');
  lines.push('');
  for (const s of serviceCatalog) {
    const list = bySubcategory.get(s.slug) ?? [];
    if (!list.length) continue;
    lines.push(`## ${s.label}（${SITE}/services/${s.slug}/）`);
    lines.push(s.desc);
    lines.push('');
    for (const a of list) lines.push(renderArticle(a));
  }

  lines.push('---');
  lines.push('');
  lines.push('# 公司介紹、理念、團隊與服務流程全文');
  lines.push('');
  for (const sec of corporateSections) {
    const list = bySubcategory.get(sec.subcat) ?? [];
    if (!list.length) continue;
    lines.push(`## ${sec.label}（${SITE}${sec.href}）`);
    lines.push('');
    for (const a of list) lines.push(renderArticle(a));
  }

  // 未歸入上述分區的文章（例如新分類尚未建頁）也收錄，避免漏內容
  const rest = all.filter((a) => !knownSubcats.has(a.data.subcategory));
  if (rest.length) {
    lines.push('---');
    lines.push('');
    lines.push('# 其他文章全文');
    lines.push('');
    for (const a of rest) lines.push(renderArticle(a));
  }

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
