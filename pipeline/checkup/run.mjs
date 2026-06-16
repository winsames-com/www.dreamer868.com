// pipeline/checkup/run.mjs
// 每日 06:00（台灣）驗收前夜判決 pipeline 的產出，產出本機私有報告（不 push、不公開）。
// 回答三問：①文章是否正確 ②有沒有抓到 GSC/GA4 參考資料 ③有沒有拿到新案例；
// 並比對近期歷史報告看趨勢。判讀交給 claude -p（本機訂閱身分，與 pipeline 同）。
//
// 用法：node pipeline/checkup/run.mjs   （由 pipeline/checkup/cron.sh 包裝，每日 cron 觸發）
// 輸出：pipeline/checkup/reports/YYYY-MM-DD.md（台灣日期；已 gitignore）

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudePrint } from '../claude.mjs';
import { collectFacts } from './collect.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const REPORTS_DIR = path.join(__dirname, 'reports');
const LOG_PATH = process.env.PIPELINE_LOG || '/tmp/judgment-pipeline.log';

// 台灣日期（伺服器為 UTC；06:00 台灣 = 22:00 UTC 前一日，必須 +8 才得正確日曆日）
const taiwanDate = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

function buildPrompt(facts) {
  return [
    '你是「判決案例故事 pipeline」的每日品管稽核員。以下是前一夜（台灣 01:11 cron）那次執行的事實。',
    '請用繁體中文（台灣用語）寫一份 markdown 驗收報告，務實、簡潔、可行動。這份報告只存在伺服器本機、不公開，可寫完整細節。',
    '',
    '請依序回答三個問題，每題給明確結論（✅ 正常 / ⚠️ 需注意 / ❌ 異常）：',
    '1. **文章撰寫結果是否正確**：檢視已發佈文章（下方全文）的化名是否徹底、是否忠於判決、CTA/frontmatter 是否完整、有無明顯品質問題；以及被隔離(quarantine)的草稿是因什麼關卡擋下、是否合理。',
    '2. **有沒有抓到 Google Search / GA 參考資料**：依 gscStatus 判讀——ok=連線成功（counts 為各分眾融入的字詞數，0 代表 GSC 新資源尚無資料，屬正常待累積）；degraded=抓取失敗已降級（看 gscDegradeMsg，需注意是否授權/金鑰問題）。注意：夜間判決 pipeline 只抓 GSC 搜尋字詞融入改編，**不抓 GA4**；GA4 屬另一支每週 insights 報告，若需 GA4 請另跑 `pnpm insights`。',
    '3. **有沒有拿到新案例**：依 changeListSize→候選→發佈/隔離 判讀今日是否有新適配判決、最終發佈幾篇；候選為 0 或 nothing to do 屬常態（非每日都有適配判決），不算異常。',
    '',
    '最後加兩段：**📈 趨勢**（對照下方近期歷史報告，如連續多日 GSC=0、發佈節奏、反覆隔離原因）與 **🔔 待辦/警示**（FATAL、push 失敗、GSC 授權失效、長期 0 發佈等需人介入者；若無則寫「無」）。',
    '只輸出 markdown 報告本文，不要前後加說明或程式碼圍欄。',
    '',
    '=== 事實（JSON） ===',
    JSON.stringify({
      todayStr: facts.todayStr,
      logMissing: facts.logMissing,
      run: facts.run,
      seenCount: facts.seenCount,
      commits: facts.commits,
    }, null, 2),
    '',
    '=== 已發佈文章全文 ===',
    facts.publishedArticles.length
      ? facts.publishedArticles.map((a) => `--- ${a.slug} (found=${a.found}) ---\n${a.body}`).join('\n\n')
      : '（無）',
    '',
    '=== 隔離草稿（含 reason 註解） ===',
    facts.quarantine.length
      ? facts.quarantine.map((q) => `--- ${q.file} ---\n${q.body}`).join('\n\n')
      : '（無）',
    '',
    '=== 近期歷史報告（趨勢對照） ===',
    facts.previousReports.length
      ? facts.previousReports.map((r) => `--- ${r.file} ---\n${r.body}`).join('\n\n')
      : '（無，這可能是第一份報告）',
  ].join('\n');
}

// 永遠寫得出的確定性事實區塊（即使 claude -p 失敗也有東西可看）
function deterministicBlock(facts) {
  const r = facts.run;
  const lines = [];
  lines.push('## 確定性事實（不經 AI 判讀）');
  if (facts.logMissing) {
    lines.push(`- ⚠️ 找不到 pipeline log：\`${facts.logPath}\`（前夜 cron 可能未執行，或 log 路徑不同）`);
  } else if (!r) {
    lines.push('- ⚠️ log 存在但解析不到任何 run 區段');
  } else {
    lines.push(`- 認證：${r.authenticated ? '✅ 成功' : '❌ 未到認證'}${r.fatal ? `；FATAL：${r.fatal}` : ''}`);
    lines.push(`- 異動清單：${r.changeListSize ?? r.summaryChangeList ?? '—'}；去重後候選：${r.afterDedup ?? '—'}；送改編：${r.candidates ?? '—'}`);
    lines.push(`- 發佈：${r.published ?? 0} 篇（${r.publishedSlugs.join(', ') || '—'}）`);
    lines.push(`- 隔離：${r.quarantined ?? 0} 篇（${r.quarantineReasons.join('; ') || '—'}）`);
    const gsc = r.gscStatus === 'ok'
      ? `✅ 連線成功，字詞分流 ${JSON.stringify(r.gscCounts)}`
      : r.gscStatus === 'degraded'
        ? `⚠️ 抓取失敗已降級：${r.gscDegradeMsg}`
        : '—（log 無相關行）';
    lines.push(`- GSC 字詞：${gsc}`);
    lines.push(`- 模式：${r.mode ?? '—'}；cron：${r.cronNote ?? '—'}`);
  }
  lines.push(`- 帳本已檢視 JID 數：${facts.seenCount ?? '—'}`);
  lines.push(`- 隔離區現存草稿：${facts.quarantine.length} 份`);
  return lines.join('\n');
}

async function aiNarrative(facts) {
  try {
    const raw = await claudePrint(buildPrompt(facts), { timeoutMs: 300_000 });
    const env = JSON.parse(raw);
    if (env.is_error || typeof env.result !== 'string') return null;
    return env.result.trim();
  } catch (e) {
    return `_（AI 判讀失敗，本報告僅含確定性事實）_\n\n錯誤：${e.message}`;
  }
}

async function main() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  const todayStr = taiwanDate();

  const facts = await collectFacts({
    repoRoot: REPO,
    logPath: LOG_PATH,
    reportsDir: REPORTS_DIR,
    articlesDir: 'src/content/articles',
    quarantineDir: 'pipeline/quarantine',
    seenPath: 'pipeline/state/seen-jids.json',
    todayStr,
  });

  const narrative = await aiNarrative(facts);
  const checkedAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16);

  const report = [
    `# 判決 pipeline 每日驗收報告 — ${todayStr}`,
    ``,
    `> 檢查時間：${checkedAt}（台灣）｜標的：前夜 cron（台灣 01:11）那次執行｜本報告為本機私有、不公開`,
    ``,
    deterministicBlock(facts),
    ``,
    `---`,
    ``,
    narrative || '_（無 AI 判讀）_',
    ``,
  ].join('\n');

  const outPath = path.join(REPORTS_DIR, `${todayStr}.md`);
  await fs.writeFile(outPath, report, 'utf8');
  console.log(`[checkup] 報告已寫入 ${outPath}`);
  // 一行摘要進 cron log
  const r = facts.run;
  console.log('[checkup] 摘要：',
    facts.logMissing ? 'log 不存在' :
    !r ? 'log 無 run' :
    `發佈${r.published ?? 0}/隔離${r.quarantined ?? 0}/GSC=${r.gscStatus}`);
}

main().catch((e) => { console.error('[checkup] FATAL', e); process.exit(1); });
