// pipeline/inbox-source.mjs —— 「收件匣模式」的資料來源：讀 tw8 投遞的司法院 API 原始資料，
// 介面與 judicial.mjs 的 auth／getChangeList／getDoc 相同，run.mjs 只換來源、其餘流程不變。
//
// 為什麼：境外主機連不上司法院 API（2026-09-06 起 Auth timeout）。tw8 每天台灣 00:30 用
// pipeline/tw8/fetch-taiwan.sh 抓好、投遞到 JUD_INBOX（預設 /root/.config/dreamer868/intake/inbox），
// 最後才寫 DONE。這裡先驗 MANIFEST，再提供資料。
//
// 失敗語意（都丟錯，run.mjs 的 FATAL → cron.sh 照舊發 Slack 心跳）：
//   沒有 DONE／DONE 超過 JUD_INBOX_MAX_AGE_H（預設 30）小時：tw8 這輪沒送到。
//   sha256 對不上：傳輸中斷或還沒送完。
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const DEFAULT_INBOX = '/root/.config/dreamer868/intake/inbox';

export async function openInbox(dir = process.env.JUD_INBOX || DEFAULT_INBOX, { maxAgeH = Number(process.env.JUD_INBOX_MAX_AGE_H || 30), now = Date.now() } = {}) {
  let st;
  try { st = await fs.stat(path.join(dir, 'DONE')); } catch { throw new Error(`收件匣 ${dir} 沒有 DONE：台灣主機（tw8）這輪沒有投遞`); }
  const ageH = (now - st.mtimeMs) / 3600e3;
  if (ageH > maxAgeH) throw new Error(`收件匣 DONE 已 ${ageH.toFixed(1)} 小時沒更新（>${maxAgeH}）：tw8 這輪沒有投遞`);
  const manifest = await fs.readFile(path.join(dir, 'MANIFEST.sha256'), 'utf8');
  for (const line of manifest.split('\n').filter(Boolean)) {
    const [sum, name] = line.trim().split(/\s+/);
    const buf = await fs.readFile(path.join(dir, name));
    if (createHash('sha256').update(buf).digest('hex') !== sum) throw new Error(`收件匣 ${name} 的 sha256 對不上（傳輸中斷或還沒送完）`);
  }
  const jlist = JSON.parse(await fs.readFile(path.join(dir, 'jlist.json'), 'utf8'));
  const docs = new Map();
  for (const l of (await fs.readFile(path.join(dir, 'docs.jsonl'), 'utf8')).split('\n')) {
    if (!l.trim()) continue;
    const d = JSON.parse(l); if (d && d.JID) docs.set(d.JID, d);
  }
  return {
    auth: async () => 'inbox',
    // 只回 tw8 有抓到全文的 jid：run.mjs 遇到 getDoc 回 null 會記入 seen 永不再看，
    // 沒抓到的（超過 JUD_MAX_DOCS、或 JDoc 失敗）不能被這樣吃掉。
    getChangeList: async () => jlist.filter((j) => docs.has(j)),
    getDoc: async (_token, jid) => docs.get(jid) || null,
    meta: { dir, ageH, changeList: jlist.length, docs: docs.size },
  };
}
