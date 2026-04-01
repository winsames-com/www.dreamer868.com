/**
 * Convert docs/ markdown files to Astro content collection format.
 * - Detects UTF-16 encoding and converts to UTF-8
 * - Adds section, subcategory, order, slug fields to frontmatter
 * - Outputs to src/content/articles/
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';

const DOCS_DIR = new URL('../docs/', import.meta.url).pathname;
const OUT_DIR = new URL('../src/content/articles/', import.meta.url).pathname;

const SECTION_MAP = {
  '一、現有文章優化': 'existing',
  '二、新文章撰寫': 'new',
  '三、服務項目細節擴展': 'services',
};

const SUBCATEGORY_MAP = {
  'A 關於我們': 'about-us',
  'B 理財規劃': 'financial-planning',
  'C 稅務規劃': 'tax-planning',
  'D 財富傳承': 'wealth-inheritance',
  'E 海外銀行開戶': 'overseas-banking',
  'A 服務對象': 'service-targets',
  'B 服務流程': 'service-process',
  'C 專業團隊': 'team',
  'D 品牌理念': 'philosophy',
  'A 家族治理': 'family-governance',
  'B 保險服務': 'insurance',
  'C 信託規劃': 'trust-planning',
  'D 移民規劃': 'immigration',
  'E 二代培訓': 'next-gen-training',
  'F 租稅服務': 'tax-services',
  'G 地政士服務': 'land-administration',
  'H 國際貿易': 'international-trade',
  'I 海外基金債券': 'overseas-funds',
};

function isUtf16(buffer) {
  // Check for BOM
  if (buffer.length >= 2) {
    if (buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf-16le';
    if (buffer[0] === 0xfe && buffer[1] === 0xff) return 'utf-16be';
  }
  // Heuristic: check for null bytes in first 100 bytes (common in UTF-16)
  const check = Math.min(buffer.length, 100);
  let nullCount = 0;
  for (let i = 0; i < check; i++) {
    if (buffer[i] === 0) nullCount++;
  }
  if (nullCount > check * 0.2) return 'utf-16le';
  return null;
}

function decodeBuffer(buffer) {
  const encoding = isUtf16(buffer);
  if (encoding) {
    const decoder = new TextDecoder(encoding);
    return decoder.decode(buffer);
  }
  return buffer.toString('utf-8');
}

function addFrontmatterFields(content, section, subcategory, order, slug) {
  // Find the closing --- of frontmatter
  const firstDash = content.indexOf('---');
  if (firstDash === -1) return content;
  const secondDash = content.indexOf('---', firstDash + 3);
  if (secondDash === -1) return content;

  const frontmatter = content.slice(firstDash + 3, secondDash);
  const body = content.slice(secondDash);

  const newFields = `\nsection: "${section}"\nsubcategory: "${subcategory}"\norder: ${order}\nslug: "${slug}"`;

  return `---${frontmatter}${newFields}\n${body}`;
}

async function getSubdirs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);
}

async function getFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name)
    .sort();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const sections = await getSubdirs(DOCS_DIR);
  let totalFiles = 0;

  for (const sectionDir of sections) {
    const section = SECTION_MAP[sectionDir];
    if (!section) {
      console.warn(`Unknown section: ${sectionDir}, skipping`);
      continue;
    }

    const categories = await getSubdirs(join(DOCS_DIR, sectionDir));

    for (const catDir of categories) {
      const subcategory = SUBCATEGORY_MAP[catDir];
      if (!subcategory) {
        console.warn(`Unknown subcategory: ${catDir}, skipping`);
        continue;
      }

      const files = await getFiles(join(DOCS_DIR, sectionDir, catDir));

      for (const file of files) {
        const filePath = join(DOCS_DIR, sectionDir, catDir, file);
        const buffer = await readFile(filePath);
        let content = decodeBuffer(buffer);

        // Remove BOM if present
        if (content.charCodeAt(0) === 0xfeff) {
          content = content.slice(1);
        }

        // Extract order number from filename (e.g., "1 品牌故事.md" -> 1)
        const orderMatch = basename(file).match(/^(\d+)/);
        const order = orderMatch ? parseInt(orderMatch[1]) : 0;

        // Generate slug
        const slug = `${subcategory}-${String(order).padStart(2, '0')}`;

        // Add new frontmatter fields
        content = addFrontmatterFields(content, section, subcategory, order, slug);

        // Write output
        const outFile = `${slug}.md`;
        await writeFile(join(OUT_DIR, outFile), content, 'utf-8');
        totalFiles++;
        console.log(`  ✓ ${outFile}`);
      }
    }
  }

  console.log(`\nDone! Converted ${totalFiles} files to ${OUT_DIR}`);
}

main().catch(console.error);
