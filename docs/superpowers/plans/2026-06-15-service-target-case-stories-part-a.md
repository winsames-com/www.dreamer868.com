# 服務對象案例故事系列（Part A 結構 + 首批範例）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「服務對象」擴充為兩層導覽，建立四個分眾的案例故事系列頁、總覽 hub、判決改編免責機制，並寫好首批 4 篇範例故事。

**Architecture:** 沿用既有 Astro content collection + `CategoryPage` 過濾模式。四個系列各用一個 subcategory；既有四篇分眾介紹文改類為各系列導讀文（order:1）；案例故事 order:10 起。免責以 schema optional 欄位 `caseStory`/`caseSource` 驅動，由 `ArticleLayout` 渲染。

**Tech Stack:** Astro 6.x、TypeScript、pnpm。專案**無測試框架**，故每個任務的驗證 = `pnpm build` 成功 + 檢查 `dist/` 產出。

**對應 spec：** `docs/superpowers/specs/2026-06-15-service-target-case-stories-design.md`（Part A）

---

### Task 0: 建立工作分支

**Files:** 無（git 操作）

- [ ] **Step 1: 從 main 建立分支**

Run:
```bash
git checkout -b feature/service-target-case-stories
```
Expected: `Switched to a new branch 'feature/service-target-case-stories'`

- [ ] **Step 2: 確認基準可建置**

Run: `pnpm build`
Expected: 建置成功，無錯誤（記下目前頁數作為基準）

---

### Task 1: schema 新增 caseStory / caseSource 欄位

**Files:**
- Modify: `src/content.config.ts`

- [ ] **Step 1: 在 schema 加入兩個 optional 欄位**

在 `slug: z.string(),` 之後、`images: z.object({` 之前插入：

```ts
    slug: z.string(),
    caseStory: z.boolean().optional(),
    caseSource: z.string().optional(),
    images: z.object({
```

- [ ] **Step 2: 驗證既有文章不受影響**

Run: `pnpm build`
Expected: 建置成功（既有文章未含新欄位，因 optional 不報錯）

- [ ] **Step 3: Commit**

```bash
git add src/content.config.ts
git commit -m "feat: add caseStory/caseSource fields to article schema"
```

---

### Task 2: ArticleLayout 免責框 + 字號渲染

**Files:**
- Modify: `src/layouts/ArticleLayout.astro`
- Modify: `src/pages/articles/[...slug].astro`

- [ ] **Step 1: ArticleLayout 新增 props**

把 `interface Props {` 區塊中 `slug?: string;` 之後加入：

```ts
  slug?: string;
  caseStory?: boolean;
  caseSource?: string;
```

並在解構處加入兩欄位：

```ts
const { title, description, heroImage, heroAlt, credit, category, date, slug, caseStory, caseSource } = Astro.props;
```

- [ ] **Step 2: 在文章正文上方渲染免責框**

把 `<div class="prose">` 區塊改為（在其前插入免責框）：

```astro
    {caseStory && (
      <aside class="case-disclaimer">
        <p>本文改編自真實法院判決，為保護當事人隱私，人物均為化名、情節經改編，僅供財務規劃情境參考，不構成法律或稅務意見。</p>
        {caseSource && <p class="case-source">參考判決：{caseSource}</p>}
      </aside>
    )}

    <div class="prose">
      <slot />
    </div>
```

- [ ] **Step 3: 在 `<style>` 內加入免責框樣式**

在 ArticleLayout `<style>` 區塊末端（`</style>` 之前）加入：

```css
  .case-disclaimer {
    background: var(--color-bg-light);
    border-left: 4px solid var(--color-primary);
    padding: 16px 20px;
    margin-bottom: 32px;
    border-radius: 4px;
  }

  .case-disclaimer p {
    font-size: 14px;
    color: #555;
    line-height: 1.7;
    margin: 0;
  }

  .case-disclaimer .case-source {
    margin-top: 8px;
    font-weight: 600;
    color: var(--color-primary);
  }
```

- [ ] **Step 4: `[...slug].astro` 傳遞新 props**

把 `<ArticleLayout` 呼叫中 `slug={article.data.slug}` 之後加入兩行：

```astro
  slug={article.data.slug}
  caseStory={article.data.caseStory}
  caseSource={article.data.caseSource}
>
```

- [ ] **Step 5: 驗證建置**

Run: `pnpm build`
Expected: 建置成功。既有文章因無 `caseStory` 不顯示免責框。

- [ ] **Step 6: Commit**

```bash
git add src/layouts/ArticleLayout.astro src/pages/articles/[...slug].astro
git commit -m "feat: render case-story disclaimer and source in ArticleLayout"
```

---

### Task 3: 建立四個系列列表頁

**Files:**
- Create: `src/pages/service-targets/personal.astro`
- Create: `src/pages/service-targets/family.astro`
- Create: `src/pages/service-targets/corporate.astro`
- Create: `src/pages/service-targets/wealth-tax.astro`

- [ ] **Step 1: 建立 personal.astro**

```astro
---
import { getCollection } from 'astro:content';
import CategoryPage from '../../components/CategoryPage.astro';

const articles = (await getCollection('articles')).filter(
  (a) => a.data.subcategory === 'personal-stories'
);
---

<CategoryPage
  title="個人財務規劃"
  description="改編自真實法院判決的個人理財案例，人物均為化名、情節經改編，僅供情境參考。"
  articles={articles}
/>
```

- [ ] **Step 2: 建立 family.astro**

```astro
---
import { getCollection } from 'astro:content';
import CategoryPage from '../../components/CategoryPage.astro';

const articles = (await getCollection('articles')).filter(
  (a) => a.data.subcategory === 'family-stories'
);
---

<CategoryPage
  title="家庭財務規劃"
  description="改編自真實法院判決的家庭理財案例，人物均為化名、情節經改編，僅供情境參考。"
  articles={articles}
/>
```

- [ ] **Step 3: 建立 corporate.astro**

```astro
---
import { getCollection } from 'astro:content';
import CategoryPage from '../../components/CategoryPage.astro';

const articles = (await getCollection('articles')).filter(
  (a) => a.data.subcategory === 'corporate-stories'
);
---

<CategoryPage
  title="公司財務規劃"
  description="改編自真實法院判決的公司理財案例，人物均為化名、情節經改編，僅供情境參考。"
  articles={articles}
/>
```

- [ ] **Step 4: 建立 wealth-tax.astro**

```astro
---
import { getCollection } from 'astro:content';
import CategoryPage from '../../components/CategoryPage.astro';

const articles = (await getCollection('articles')).filter(
  (a) => a.data.subcategory === 'wealth-tax-stories'
);
---

<CategoryPage
  title="財富稅務規劃"
  description="改編自真實法院判決的財富與稅務案例，人物均為化名、情節經改編，僅供情境參考。"
  articles={articles}
/>
```

- [ ] **Step 5: 驗證建置與產出**

Run: `pnpm build && ls dist/service-targets/personal/index.html dist/service-targets/family/index.html dist/service-targets/corporate/index.html dist/service-targets/wealth-tax/index.html`
Expected: 四個檔案皆存在（列表此時為空，正常）

- [ ] **Step 6: Commit**

```bash
git add src/pages/service-targets/
git commit -m "feat: add four service-target story series list pages"
```

---

### Task 4: 既有四篇導讀文改類

**Files:**
- Modify: `src/content/articles/service-targets-02.md`（個人）
- Modify: `src/content/articles/service-targets-03.md`（家庭）
- Modify: `src/content/articles/service-targets-04.md`（公司）
- Modify: `src/content/articles/service-targets-05.md`（財富稅務）

- [ ] **Step 1: 改 service-targets-02.md（個人）frontmatter**

把：
```yaml
section: "new"
subcategory: "service-targets"
order: 2
slug: "service-targets-02"
```
改為：
```yaml
section: "new"
subcategory: "personal-stories"
order: 1
slug: "service-targets-02"
```

- [ ] **Step 2: 改 service-targets-03.md（家庭）**

把 `subcategory: "service-targets"` 改為 `subcategory: "family-stories"`，`order: 3` 改為 `order: 1`。

- [ ] **Step 3: 改 service-targets-04.md（公司）**

把 `subcategory: "service-targets"` 改為 `subcategory: "corporate-stories"`，`order: 4` 改為 `order: 1`。

- [ ] **Step 4: 改 service-targets-05.md（財富稅務）**

把 `subcategory: "service-targets"` 改為 `subcategory: "wealth-tax-stories"`，`order: 5` 改為 `order: 1`。

- [ ] **Step 5: 驗證建置與系列頁有導讀卡**

Run: `pnpm build && grep -l "個人財務規劃" dist/service-targets/personal/index.html`
Expected: 建置成功；personal 列表頁 HTML 含「個人財務規劃」導讀卡

- [ ] **Step 6: Commit**

```bash
git add src/content/articles/service-targets-0[2345].md
git commit -m "refactor: move service-target intros into per-series subcategories"
```

---

### Task 5: 改寫 service-targets.astro 為總覽 hub

**Files:**
- Modify: `src/pages/service-targets.astro`

- [ ] **Step 1: 整檔改寫為 hub（4 張卡導向系列頁）**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import PageBanner from '../components/PageBanner.astro';
import ArticleCard from '../components/ArticleCard.astro';

const all = await getCollection('articles');

const targets = [
  { subcat: 'personal-stories', href: '/service-targets/personal' },
  { subcat: 'family-stories', href: '/service-targets/family' },
  { subcat: 'corporate-stories', href: '/service-targets/corporate' },
  { subcat: 'wealth-tax-stories', href: '/service-targets/wealth-tax' },
];

const cards = targets
  .map((t) => ({
    ...t,
    lead: all.find((a) => a.data.subcategory === t.subcat && a.data.order === 1),
  }))
  .filter((c) => c.lead);

const overview = all.find((a) => a.data.slug === 'service-targets-01');
---

<BaseLayout title="服務對象" description="從個人、家庭、公司到財富稅務，尊茂以真實判決改編的案例陪你看懂財務規劃。">
  <PageBanner title="服務對象" />

  <section class="targets-hub">
    <p class="hub-intro">
      從個人到家族企業，我們用改編自真實法院判決的案例，帶你看懂常見的財務與法律盲點。
      {overview && <a href={`/articles/${overview.data.slug}`}>完整服務對象介紹 →</a>}
    </p>

    <div class="cards-grid">
      {cards.map((c) => (
        <ArticleCard
          title={c.lead.data.title}
          href={c.href}
          image={c.lead.data.images.hero.url}
          imageAlt={c.lead.data.images.hero.alt}
        />
      ))}
    </div>
  </section>
</BaseLayout>

<style>
  .targets-hub {
    max-width: 1200px;
    margin: 0 auto;
    padding: 60px 20px 100px;
  }

  .hub-intro {
    font-size: var(--f20);
    text-align: center;
    color: #666;
    max-width: 760px;
    margin: 0 auto 50px;
    line-height: 1.8;
  }

  .hub-intro a {
    color: var(--color-primary);
    font-weight: 600;
    white-space: nowrap;
  }

  .cards-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 30px;
  }

  @media (max-width: 600px) {
    .cards-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
```

- [ ] **Step 2: 驗證建置與 hub 內容**

Run: `pnpm build && grep -o "service-targets/personal\|service-targets/family\|service-targets/corporate\|service-targets/wealth-tax" dist/service-targets/index.html | sort -u | wc -l`
Expected: 建置成功；輸出 `4`（四張卡連結皆出現）

- [ ] **Step 3: Commit**

```bash
git add src/pages/service-targets.astro
git commit -m "feat: rewrite service-targets page as series hub"
```

---

### Task 6: 導覽列「服務對象」加下拉子項

**Files:**
- Modify: `src/data/navigation.ts`

- [ ] **Step 1: 把服務對象改為含 children**

把：
```ts
  {
    label: '服務對象',
    href: '/service-targets',
  },
```
改為：
```ts
  {
    label: '服務對象',
    href: '/service-targets',
    children: [
      { label: '個人財務規劃', href: '/service-targets/personal' },
      { label: '家庭財務規劃', href: '/service-targets/family' },
      { label: '公司財務規劃', href: '/service-targets/corporate' },
      { label: '財富稅務規劃', href: '/service-targets/wealth-tax' },
    ],
  },
```

- [ ] **Step 2: 驗證建置與下拉渲染**

Run: `pnpm build && grep -o "service-targets/personal" dist/index.html | head -1`
Expected: 建置成功；輸出 `service-targets/personal`（首頁 header 下拉含該連結）

- [ ] **Step 3: Commit**

```bash
git add src/data/navigation.ts
git commit -m "feat: add service-target dropdown nav children"
```

---

### Task 7: 首批故事 — 個人（保險受益人）

**Files:**
- Create: `src/content/articles/personal-story-01.md`

- [ ] **Step 1: 建立文章（完整內容）**

```markdown
---
title: 受益人只寫「法定繼承人」，她差點領不到先生的保險金
date: 2026-06-16
author: Writer
status: draft
version: 1
task: 二-A-案例 個人保險受益人
category: 服務對象

caseStory: true
caseSource: "臺灣臺北地方法院 95 年度保險簡上字第 11 號"

images:
  hero:
    pexels_id: 5466812
    url: "https://images.pexels.com/photos/5466812/pexels-photo-5466812.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"
    alt: "個人財務規劃思考"
    photographer: "olia danilevich"
    photographer_url: "https://www.pexels.com/@olia-danilevich"
    credit: "Photo by olia danilevich on Pexels"

section: "new"
subcategory: "personal-stories"
order: 10
slug: "personal-story-01"
---

# 受益人只寫「法定繼承人」，她差點領不到先生的保險金

![個人財務規劃思考](https://images.pexels.com/photos/5466812/pexels-photo-5466812.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200)
*Photo by [olia danilevich](https://www.pexels.com/@olia-danilevich) on [Pexels](https://www.pexels.com)*

陳小姐的先生因病過世，留下一張壽險保單。保單上的受益人欄位，當年只填了「法定繼承人」四個字。

## 困境：一個拋棄繼承的決定，讓保險金卡關

先生生前經商，身後留下一些債務。為了避免背債，陳小姐辦理了「拋棄繼承」。她以為這只影響遺產，沒想到保險公司卻主張：既然你拋棄繼承，就不再是「法定繼承人」，自然不能依保單領取保險金。

一筆原本要支撐她與孩子生活的保險金，瞬間陷入爭議。

## 剖析：受益人寫「法定繼承人」的兩個盲點

- **身分認定的時點爭議**：受益人寫「法定繼承人」時，到底以「投保當下」還是「事故發生後」認定身分？實務見解並不一致，這正是爭訟的根源。
- **拋棄繼承的連鎖效果**：拋棄繼承是為了切割遺產與債務，但若保險受益人欄位寫得不清楚，這個動作可能連帶影響保險金的請求權。

保險法本意是「保險金非遺產」，可以指定受益人、不受債權人追償；但前提是——**受益人要寫清楚**。

## 規劃：把受益人寫對，是最便宜的保障

1. **指定具名受益人並排順位**：直接寫配偶、子女姓名與順位，而非籠統的「法定繼承人」。
2. **重大決定前先檢視保單**：在辦理拋棄繼承這類動作前，先盤點所有保單的受益人安排，避免顧此失彼。
3. **定期更新**：結婚、生子、離婚後，受益人都該重新檢視。

## 啟示

保險規劃的成敗，常常不在保額多寡，而在那幾個「受益人欄位」有沒有寫對。一個小疏忽，可能讓辛苦準備的保障打折扣。

---

想檢視你的保單受益人安排是否到位？歡迎與我們聊聊。

📞 0909-230140
📧 dreamer88888888888@gmail.com
📍 408 臺中市南屯區文心路一段186號9樓之1

**賦予人們宏觀永續的財商新思路**
```

- [ ] **Step 2: 驗證建置與免責框**

Run: `pnpm build && grep -c "改編自真實法院判決" dist/articles/personal-story-01/index.html`
Expected: 建置成功；計數 ≥ 1（免責框已渲染）

- [ ] **Step 3: Commit**

```bash
git add src/content/articles/personal-story-01.md
git commit -m "content: add personal case story 01 (insurance beneficiary)"
```

---

### Task 8: 首批故事 — 家庭（遺產分割變價拍賣）

**Files:**
- Create: `src/content/articles/family-story-01.md`

> ⚠️ **發布前查證**：本篇 `caseSource` 暫以法律依據（民法第 824 條）標註。正式對外前，請由使用者於 FJUD 取得一則具體「遺產變價分割」判決字號，替換 `caseSource` 值。內容本身為化名改編，不受影響。

- [ ] **Step 1: 建立文章（完整內容）**

```markdown
---
title: 一棟老家三兄妹分不攏，法院判「拍賣分錢」
date: 2026-06-16
author: Writer
status: draft
version: 1
task: 二-A-案例 家庭遺產分割
category: 服務對象

caseStory: true
caseSource: "民法第 824 條變價分割（裁判分割實務）"

images:
  hero:
    pexels_id: 4783976
    url: "https://images.pexels.com/photos/4783976/pexels-photo-4783976.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"
    alt: "幸福家庭的財務規劃"
    photographer: "Ivan S"
    photographer_url: "https://www.pexels.com/@ivan-s"
    credit: "Photo by Ivan S on Pexels"

section: "new"
subcategory: "family-stories"
order: 10
slug: "family-story-01"
---

# 一棟老家三兄妹分不攏，法院判「拍賣分錢」

![幸福家庭的財務規劃](https://images.pexels.com/photos/4783976/pexels-photo-4783976.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200)
*Photo by [Ivan S](https://www.pexels.com/@ivan-s) on [Pexels](https://www.pexels.com)*

父母走後，留下一棟住了三十年的透天厝。林家三兄妹各自繼承三分之一，本以為「房子大家有份」是團圓，沒想到卻成了撕裂感情的開始。

## 困境：一人想住、一人要錢、一人在國外

- 老大從小住在這裡，想繼續住，不願賣。
- 老二手頭緊，希望變現拿到自己的那一份。
- 老三長年旅居國外，只想盡快了結。

三方各執一詞，協議破局。老二最後訴請「分割遺產」。

## 剖析：房子不是切蛋糕，無法人人滿意

一棟透天厝很難「實物分割」成三等份還能住人。當共有人無法協議、實物分割又不可行時，法院依民法規定，常見的結果就是**變價分割**——把房子拍賣，再依持分比例分錢。

對林家來說，這代表：

- 老家被法拍，可能低於市價成交。
- 想住的人失去房子，想要現金的人也未必拿到理想金額。
- 三兄妹從此形同陌路。

**真正的代價，不只是金錢，更是回不去的手足關係。**

## 規劃：在「分配」前，先準備好「潤滑劑」

1. **預留現金做平衡**：生前以保險或信託準備一筆現金，讓想要房子的人能補償其他人，避免被迫拍賣。
2. **遺囑明確分配**：以遺囑指定房產歸屬與補償方式，減少協議空間裡的爭執。
3. **預立分管或處分共識**：若注定共有，先約定使用與未來處分規則。

## 啟示

遺產規劃最殘忍的版本，是「什麼都沒準備，讓法院替你決定」。提早安排，才能讓財產傳承的是親情，而不是官司。

---

想為家人預先安排好不動產與現金的分配？歡迎與我們聊聊。

📞 0909-230140
📧 dreamer88888888888@gmail.com
📍 408 臺中市南屯區文心路一段186號9樓之1

**賦予人們宏觀永續的財商新思路**
```

- [ ] **Step 2: 驗證建置**

Run: `pnpm build && grep -c "改編自真實法院判決" dist/articles/family-story-01/index.html`
Expected: 建置成功；計數 ≥ 1

- [ ] **Step 3: Commit**

```bash
git add src/content/articles/family-story-01.md
git commit -m "content: add family case story 01 (estate partition by sale)"
```

---

### Task 9: 首批故事 — 公司（股權借名登記）

**Files:**
- Create: `src/content/articles/corporate-story-01.md`

- [ ] **Step 1: 建立文章（完整內容）**

```markdown
---
title: 把股份借登記在親戚名下，他差點失去自己創的公司
date: 2026-06-16
author: Writer
status: draft
version: 1
task: 二-A-案例 公司股權借名
category: 服務對象

caseStory: true
caseSource: "最高法院 112 年度台上字第 610 號"

images:
  hero:
    pexels_id: 7640434
    url: "https://images.pexels.com/photos/7640434/pexels-photo-7640434.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"
    alt: "企業主的財務規劃"
    photographer: "Yan Krukau"
    photographer_url: "https://www.pexels.com/@yankrukov"
    credit: "Photo by Yan Krukau on Pexels"

section: "new"
subcategory: "corporate-stories"
order: 10
slug: "corporate-story-01"
---

# 把股份借登記在親戚名下，他差點失去自己創的公司

![企業主的財務規劃](https://images.pexels.com/photos/7640434/pexels-photo-7640434.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200)
*Photo by [Yan Krukau](https://www.pexels.com/@yankrukov) on [Pexels](https://www.pexels.com)*

王先生白手起家創立公司。當年為了湊足發起人人數、也想分散稅負，他把一部分股份「借名」登記在堂弟名下，雙方只有口頭約定：「這股份其實是我的。」

## 困境：公司賺錢後，借名股份反咬一口

公司營運上軌道、開始獲利後，情況變了。堂弟主張：登記在我名下的股份，就是我的。他甚至聯合其他股東，企圖影響董事會、爭奪經營權。

王先生這才驚覺，自己一手創立的公司，控制權正在流失。他提告請求返還股份，卻面臨一個殘酷的現實——**當年沒有書面，舉證極其困難**。

## 剖析：借名登記的兩大風險

- **舉證風險**：股份登記是公開的權利外觀。要證明「登記在別人名下、實際是我的」，沒有書面契約、金流佐證，往往敗訴收場。
- **經營權風險**：借名股份一旦被出名人主張，輕則稀釋你的表決權，重則動搖整間公司的控制權。

「方便」與「人情」搭起來的股權結構，常常是埋給未來的訴訟地雷。

## 規劃：把界線在事前就劃清楚

1. **書面化**：借名或信託都要有明確契約，載明真正所有權人、金流與返還條件。
2. **股權集中與表決權設計**：透過特別股、表決權契約或股東協議，確保經營權不因持股分散而失控。
3. **控股公司架構**：以控股公司持有營運公司股權，搭配家族治理規範，讓股權傳承與經營權穩定。

## 啟示

真正的資產傳承，不是事後打官司證明「這其實是我的錢」，而是在事前就把界線寫清楚。對企業主而言，股權結構就是公司的地基。

---

想檢視你的公司股權結構與傳承安排？歡迎與我們聊聊。

📞 0909-230140
📧 dreamer88888888888@gmail.com
📍 408 臺中市南屯區文心路一段186號9樓之1

**賦予人們宏觀永續的財商新思路**
```

- [ ] **Step 2: 驗證建置**

Run: `pnpm build && grep -c "改編自真實法院判決" dist/articles/corporate-story-01/index.html`
Expected: 建置成功；計數 ≥ 1

- [ ] **Step 3: Commit**

```bash
git add src/content/articles/corporate-story-01.md
git commit -m "content: add corporate case story 01 (share nominee dispute)"
```

---

### Task 10: 首批故事 — 財富稅務（6 歲女童遺產稅）

**Files:**
- Create: `src/content/articles/wealth-tax-story-01.md`

- [ ] **Step 1: 建立文章（完整內容）**

```markdown
---
title: 爸爸生前把三億股票送給媽媽，六歲女兒卻背上近六千萬遺產稅
date: 2026-06-16
author: Writer
status: draft
version: 1
task: 二-A-案例 財富稅務遺產稅
category: 服務對象

caseStory: true
caseSource: "憲法法庭 113 年憲判字第 11 號"

images:
  hero:
    pexels_id: 5911971
    url: "https://images.pexels.com/photos/5911971/pexels-photo-5911971.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"
    alt: "財富人士的財務規劃"
    photographer: "cottonbro studio"
    photographer_url: "https://www.pexels.com/@cottonbro"
    credit: "Photo by cottonbro studio on Pexels"

section: "new"
subcategory: "wealth-tax-stories"
order: 10
slug: "wealth-tax-story-01"
---

# 爸爸生前把三億股票送給媽媽，六歲女兒卻背上近六千萬遺產稅

![財富人士的財務規劃](https://images.pexels.com/photos/5911971/pexels-photo-5911971.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200)
*Photo by [cottonbro studio](https://www.pexels.com/@cottonbro) on [Pexels](https://www.pexels.com)*

林先生生前事業有成，過世前把一筆價值約三億元的股票贈與給配偶。他過世後，唯一的繼承人是年僅六歲的女兒——因為配偶選擇了拋棄繼承。

女兒實際繼承的遺產約一千五百萬元，國稅局卻開出一張約**五千七百萬元**的遺產稅單。

## 困境：繼承得少，稅卻繳不完

一個六歲的孩子，繼承一千五百萬，卻要背五千七百萬的稅。這不是算錯，而是稅制設計使然：

- **擬制遺產**：被繼承人死亡前二年內贈與配偶的財產，會被「視為遺產」併入計算。那三億股票，雖然送了出去，仍被拉回遺產總額。
- **總遺產稅制**：遺產稅是按「遺產總額」課稅，不是按每個人實際拿到多少分攤。
- **拋棄繼承的副作用**：配偶拋棄繼承後，全部稅負落到唯一繼承人——那個六歲的孩子身上。

這個案件後來經由釋憲程序，獲認定相關規定違憲，要求修法。但對當事人而言，過程已是漫長煎熬。

## 剖析：節稅的動作，反而製造了風險

把財產生前移轉，初衷常是「先給出去、少課稅」。但若沒有通盤規劃，反而可能：

- 觸發擬制遺產，前功盡棄。
- 因拋棄繼承讓稅負集中到最沒有能力承擔的人身上。
- 缺乏現金繳稅，被迫賤賣資產。

## 規劃：稅源與時間，要一起規劃

1. **及早、分年贈與**：善用每年贈與免稅額，拉長時間軸，而非臨終前才大額移轉。
2. **預留稅源**：以保險等工具預先準備繳稅現金，避免繼承人「有資產、沒現金」。
3. **繼承前先試算**：在做拋棄繼承等重大決定前，先試算整體稅負落點，避免顧此失彼。

## 啟示

財富傳承最怕的，不是繳稅，而是「沒準備好就走」。稅務規劃的核心，是讓家人接到的是資產，而不是稅單。

---

想為家族財富預先做好稅務與傳承規劃？歡迎與我們聊聊。

📞 0909-230140
📧 dreamer88888888888@gmail.com
📍 408 臺中市南屯區文心路一段186號9樓之1

**賦予人們宏觀永續的財商新思路**
```

- [ ] **Step 2: 驗證建置**

Run: `pnpm build && grep -c "改編自真實法院判決" dist/articles/wealth-tax-story-01/index.html`
Expected: 建置成功；計數 ≥ 1

- [ ] **Step 3: Commit**

```bash
git add src/content/articles/wealth-tax-story-01.md
git commit -m "content: add wealth-tax case story 01 (deemed estate tax)"
```

---

### Task 11: 全站最終驗證

**Files:** 無（驗證）

- [ ] **Step 1: 完整建置**

Run: `pnpm build`
Expected: 建置成功，無 schema 錯誤

- [ ] **Step 2: 確認所有新頁面產出**

Run:
```bash
ls dist/service-targets/index.html \
   dist/service-targets/personal/index.html \
   dist/service-targets/family/index.html \
   dist/service-targets/corporate/index.html \
   dist/service-targets/wealth-tax/index.html \
   dist/articles/personal-story-01/index.html \
   dist/articles/family-story-01/index.html \
   dist/articles/corporate-story-01/index.html \
   dist/articles/wealth-tax-story-01/index.html
```
Expected: 九個檔案皆存在

- [ ] **Step 3: 確認每個系列頁含導讀 + 案例兩張卡**

Run: `grep -o "articles/service-targets-02\|articles/personal-story-01" dist/service-targets/personal/index.html | sort -u | wc -l`
Expected: `2`（導讀文 + 案例故事皆列出）

- [ ] **Step 4: 確認 sitemap 含新 URL**

Run: `grep -c "service-targets/personal\|personal-story-01" dist/sitemap-0.xml`
Expected: ≥ 2

- [ ] **Step 5: 本機預覽人工確認（選配）**

Run: `pnpm preview`
然後瀏覽 `http://localhost:4321/service-targets`，確認 hub 四張卡、下拉選單、系列頁、案例頁免責框皆正常。

---

## 完成後

- 推送分支並開 PR（待使用者示意）：`git push -u origin feature/service-target-case-stories`
- Part A 上線並觀察無誤後，再進行 **Plan 2（Part B 每日判決 pipeline）** 的 writing-plans。
- family-story-01 的 `caseSource` 字號於正式對外前替換為具體判決字號。
