// /rss.xml — 文章 RSS feed，便於訂閱與被內容發現服務（含 AI）抓取
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';

export async function GET(context: APIContext) {
  const articles = (await getCollection('articles')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );

  return rss({
    title: '尊茂財務規劃 — 財務知識與案例',
    description: '台中尊茂財務規劃：理財、稅務、財富傳承、信託、家族治理、海外資產與移民規劃的知識文章與真實判決改編案例。',
    site: context.site ?? 'https://www.dreamer868.com',
    items: articles.map((a) => ({
      title: a.data.title,
      description: a.data.description ?? '',
      pubDate: a.data.date,
      link: `/articles/${a.data.slug}`,
      categories: a.data.category ? [a.data.category] : undefined,
    })),
    customData: '<language>zh-Hant-TW</language>',
  });
}
