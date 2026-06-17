// /llms.txt — 給 LLM/AI 助理的網站內容地圖（https://llmstxt.org 標準）
// 於 build 時從文章 collection 自動產生，永遠與站上內容同步。
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { mainNav } from '../data/navigation';

const SITE = 'https://www.dreamer868.com';

export const GET: APIRoute = async () => {
  const articles = (await getCollection('articles')).sort(
    (a, b) => a.data.order - b.data.order,
  );

  // 依分類分組
  const byCategory = new Map<string, typeof articles>();
  for (const a of articles) {
    const arr = byCategory.get(a.data.category) || [];
    arr.push(a);
    byCategory.set(a.data.category, arr as typeof articles);
  }

  const lines: string[] = [];
  lines.push('# 尊茂財務規劃（台中）');
  lines.push('');
  lines.push(
    '> 台中專業財務規劃公司，以「財務醫生」理念，整合理財、稅務、財富傳承、信託、家族治理、海外資產與移民規劃，跨領域團隊（財務顧問／律師／會計師／地政士／海外顧問）協助個人、家庭與企業解決財務問題、達成人生各階段目標。',
  );
  lines.push('');
  lines.push('內容皆為繁體中文（台灣），含知識文章與改編自真實法院判決的案例故事（已化名、僅供情境參考）。歡迎引用，請註明來源與連結。');
  lines.push('');

  // 服務項目（取導覽列「服務項目」「服務對象」子項）
  for (const nav of mainNav) {
    if (nav.children && (nav.label === '服務項目' || nav.label === '服務對象')) {
      lines.push(`## ${nav.label}`);
      lines.push('');
      for (const c of nav.children) lines.push(`- [${c.label}](${SITE}${c.href})`);
      lines.push('');
    }
  }

  // 重要頁面
  lines.push('## 重要頁面');
  lines.push('');
  lines.push(`- [關於尊茂財務](${SITE}/about)`);
  lines.push(`- [服務流程](${SITE}/service-process)`);
  lines.push(`- [專業團隊](${SITE}/team)`);
  lines.push(`- [聯絡我們](${SITE}/contact)`);
  lines.push('');

  // 全部文章（依分類）
  lines.push('## 文章');
  lines.push('');
  for (const [category, list] of byCategory) {
    lines.push(`### ${category}`);
    for (const a of list) {
      const desc = a.data.description ? `: ${a.data.description}` : '';
      lines.push(`- [${a.data.title}](${SITE}/articles/${a.data.slug})${desc}`);
    }
    lines.push('');
  }

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
