# 尊茂財務規劃網站 (www.dreamer868.com)

## 專案概述

台中尊茂財務規劃公司的官方網站，以 Astro 靜態網站產生器建置，部署於 GitHub Pages。

## 技術棧

- **框架**: Astro 6.x（靜態輸出）
- **套件管理**: pnpm
- **部署**: GitHub Pages（自動 CI/CD）
- **網域**: www.dreamer868.com（CNAME → winsames-com.github.io）

## 目錄結構

```
src/
├── content/articles/   # Markdown 文章內容（各服務分類）
├── components/         # Astro 元件（Header, Footer, ArticleCard 等）
├── data/navigation.ts  # 導覽列、聯絡資訊集中管理
├── layouts/            # BaseLayout（含 SEO meta）、ArticleLayout
├── pages/              # 路由頁面
│   ├── articles/[...slug].astro  # 文章動態路由
│   ├── services/       # 各服務分類頁
│   └── 404.astro
└── styles/             # global.css、variables.css
public/
├── CNAME               # GitHub Pages 自訂網域
├── robots.txt          # 搜尋引擎爬取指引
└── favicon.*
```

## 常用指令

```bash
pnpm dev        # 本地開發
pnpm build      # 建置靜態檔案
pnpm preview    # 預覽建置結果
```

## CI/CD 流程

`.github/workflows/deploy.yml` 定義三階段：
1. **build** — pnpm install + build
2. **deploy** — 部署到 GitHub Pages
3. **verify** — 從 sitemap 檢查所有 URL 回應 200

## SEO/AEO 配置

- BaseLayout 已內建：canonical URL、Open Graph、Twitter Card、BreadcrumbList JSON-LD
- 首頁：FinancialService JSON-LD
- 文章頁：Article JSON-LD
- sitemap 由 @astrojs/sitemap 自動產生

## 注意事項

- 沒有 base path，所有內部連結直接用絕對路徑（如 `/contact`）
- 聯絡表單為 mailto fallback（無後端）
- `source/` 目錄是舊網站爬取的素材，已加入 .gitignore
- 文章圖片來源：Pexels（需保留 credit）、doing-housework.com（公司自有圖片）
