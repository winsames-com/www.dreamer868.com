import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string(),
    status: z.string(),
    version: z.number(),
    task: z.string(),
    category: z.string(),
    section: z.string(),
    subcategory: z.string(),
    order: z.number(),
    slug: z.string(),
    // GEO/AEO：每篇獨立摘要（餵 meta description / OG / JSON-LD），未填則 fallback 站台預設
    description: z.string().optional(),
    // 真實最後更新日（未填則沿用 date）；供 dateModified 與 sitemap lastmod
    updatedDate: z.coerce.date().optional(),
    // 主題標籤（餵 keywords 與 Article.keywords，利於 AI 主題關聯）
    tags: z.array(z.string()).optional(),
    // 作者 E-E-A-T：具名作者的頭銜與作者頁連結（填了才升級為 Person 作者）
    authorTitle: z.string().optional(),
    authorUrl: z.string().optional(),
    // FAQPage：Q&A 型文章可帶問答對，產生 FAQPage 結構化資料
    faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
    caseStory: z.boolean().optional(),
    caseSource: z.string().optional(),
    images: z.object({
      hero: z.object({
        pexels_id: z.number(),
        url: z.string(),
        alt: z.string(),
        photographer: z.string(),
        photographer_url: z.string(),
        credit: z.string(),
      }),
    }),
  }),
});

export const collections = { articles };
