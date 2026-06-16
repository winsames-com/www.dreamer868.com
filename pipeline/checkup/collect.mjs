// pipeline/checkup/collect.mjs
// 蒐集每日 checkup 所需的「事實」（I/O 層）：讀前夜 pipeline log、已發佈/隔離文章、
// 帳本、近期歷史報告。純判讀邏輯在 parse.mjs；此處只負責讀檔與 git。
// 全部唯讀，不寫網站、不 commit。

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lastRun, summarizeRun } from './parse.mjs';

const pexec = promisify(execFile);
const LOG_TAIL_BYTES = 200_000;

async function readMaybe(p) {
  try { return await fs.readFile(p, 'utf8'); } catch { return null; }
}

async function listMd(dir) {
  try {
    return (await fs.readdir(dir)).filter((f) => f.endsWith('.md'));
  } catch { return []; }
}

// git：過去 ~18 小時內提交、且動到文章目錄的檔案（交叉驗證「新案例是否真的發佈」）。
async function recentArticleCommits(repoRoot, articlesDir) {
  try {
    const { stdout } = await pexec('git', [
      'log', '--since=18 hours ago', '--name-only', '--pretty=format:%h|%cI|%s',
      '--', articlesDir,
    ], { cwd: repoRoot, maxBuffer: 4 * 1024 * 1024 });
    return stdout.trim();
  } catch (e) {
    return `(git log 失敗: ${e.message})`;
  }
}

export async function collectFacts({ repoRoot, logPath, reportsDir, articlesDir, quarantineDir, seenPath, todayStr }) {
  // 1) 前夜 pipeline log → 最近一次 run 的結構化事實
  const rawLog = await readMaybe(logPath);
  const logTail = rawLog ? rawLog.slice(-LOG_TAIL_BYTES) : null;
  const run = logTail ? summarizeRun(lastRun(logTail)) : null;
  const logMissing = rawLog == null;

  // 2) 已發佈文章（依 run 的 publishedSlugs 讀全文供品質判讀）
  const publishedArticles = [];
  for (const slug of run?.publishedSlugs || []) {
    const body = await readMaybe(path.join(repoRoot, articlesDir, `${slug}.md`));
    publishedArticles.push({ slug, found: body != null, body: body || '' });
  }

  // 3) 隔離草稿（本機私有，含 reason 註解與全文）
  const quarFiles = await listMd(path.join(repoRoot, quarantineDir));
  const quarantine = [];
  for (const f of quarFiles) {
    const body = await readMaybe(path.join(repoRoot, quarantineDir, f));
    quarantine.push({ file: f, body: body || '' });
  }

  // 4) 帳本（已檢視 JID 數）
  let seenCount = null;
  const seenRaw = await readMaybe(path.join(repoRoot, seenPath));
  if (seenRaw) {
    try {
      const v = JSON.parse(seenRaw);
      seenCount = Array.isArray(v) ? v.length : Object.keys(v).length;
    } catch { seenCount = null; }
  }

  // 5) 近期歷史報告（給趨勢分析；排除今天，取最近 7 份）
  const reportFiles = (await listMd(reportsDir)).filter((f) => f !== `${todayStr}.md`).sort();
  const recent = reportFiles.slice(-7);
  const previousReports = [];
  for (const f of recent) {
    const body = await readMaybe(path.join(reportsDir, f));
    previousReports.push({ file: f, body: body || '' });
  }

  // 6) git 交叉驗證
  const commits = await recentArticleCommits(repoRoot, articlesDir);

  return { todayStr, logMissing, logPath, run, publishedArticles, quarantine, seenCount, previousReports, commits };
}
