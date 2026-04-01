// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://winsames-com.github.io',
  base: '/www.dreamer868.com',
  output: 'static',
  build: {
    format: 'directory',
  },
  integrations: [sitemap()],
});
