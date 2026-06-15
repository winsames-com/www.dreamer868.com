// pipeline/config.mjs
// 四分眾的分類規則、門檻、每日上限、固定 hero 圖、Batch 設定。

export const MODEL = 'claude-sonnet-4-6';

// 每分眾每日最多 1 篇、全站每日最多 4 篇
export const LIMITS = { perCategoryPerDay: 1, perDayTotal: 4 };

// 閘門門檻（模型自評 1–5）
export const THRESHOLDS = { relevanceMin: 4, qualityMin: 4 };

// 裁判類別（JID 第一段最後一字）：V=民事 M=刑事 A=行政
export const ALLOWED_COURT_TYPES = new Set(['V', 'A']);

// 四分眾。order：依關鍵字命中數分類，平手時用陣列順序（先到先得）。
// hero 圖沿用 Part A 各分眾導讀文的 Pexels 圖（已含 credit）。
export const CATEGORIES = [
  {
    key: 'wealth-tax',
    label: '財富稅務規劃',
    subcategory: 'wealth-tax-stories',
    slugPrefix: 'wealth-tax-story',
    courtTypes: ['A'],
    keywords: ['遺產稅', '贈與稅', '實質課稅', '補稅', '稅捐', '課稅', '擬制遺產'],
    hero: {
      pexels_id: 5911971,
      url: 'https://images.pexels.com/photos/5911971/pexels-photo-5911971.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
      alt: '財富人士的財務規劃',
      photographer: 'cottonbro studio',
      photographer_url: 'https://www.pexels.com/@cottonbro',
      credit: 'Photo by cottonbro studio on Pexels',
    },
  },
  {
    key: 'family',
    label: '家庭財務規劃',
    subcategory: 'family-stories',
    slugPrefix: 'family-story',
    courtTypes: ['V'],
    keywords: ['遺產分割', '繼承', '扶養', '夫妻', '剩餘財產', '監護', '遺囑', '特留分'],
    hero: {
      pexels_id: 4783976,
      url: 'https://images.pexels.com/photos/4783976/pexels-photo-4783976.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
      alt: '幸福家庭的財務規劃',
      photographer: 'Ivan S',
      photographer_url: 'https://www.pexels.com/@ivan-s',
      credit: 'Photo by Ivan S on Pexels',
    },
  },
  {
    key: 'corporate',
    label: '公司財務規劃',
    subcategory: 'corporate-stories',
    slugPrefix: 'corporate-story',
    courtTypes: ['V'],
    keywords: ['股權', '股東', '借名登記', '經營權', '董事', '出資', '公司分割', '表決權'],
    hero: {
      pexels_id: 7640434,
      url: 'https://images.pexels.com/photos/7640434/pexels-photo-7640434.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
      alt: '企業主的財務規劃',
      photographer: 'Yan Krukau',
      photographer_url: 'https://www.pexels.com/@yankrukov',
      credit: 'Photo by Yan Krukau on Pexels',
    },
  },
  {
    key: 'personal',
    label: '個人財務規劃',
    subcategory: 'personal-stories',
    slugPrefix: 'personal-story',
    courtTypes: ['V'],
    keywords: ['保險', '受益人', '連帶保證', '保證人', '消費借貸', '債務', '本票', '清償'],
    hero: {
      pexels_id: 5466812,
      url: 'https://images.pexels.com/photos/5466812/pexels-photo-5466812.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
      alt: '個人財務規劃思考',
      photographer: 'olia danilevich',
      photographer_url: 'https://www.pexels.com/@olia-danilevich',
      credit: 'Photo by olia danilevich on Pexels',
    },
  },
];

export const PATHS = {
  articles: 'src/content/articles',
  seen: 'pipeline/state/seen-jids.json',
  quarantine: 'pipeline/quarantine',
};

export const CONTACT = {
  phone: '0909-230140',
  email: 'dreamer88888888888@gmail.com',
  address: '408 臺中市南屯區文心路一段186號9樓之1',
};
