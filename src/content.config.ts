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
