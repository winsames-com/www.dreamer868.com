// pipeline/tw8/fetch-judicial.mjs —— 台灣主機（tw8）專用抓取器，**單檔、只用 Node 內建模組**。
//
// 為什麼：司法院裁判書開放 API（data.judicial.gov.tw）擋海外 IP，境外主機自 2026-09-06 起每天
// Auth timeout、零產出。分工比照 bansik.tw／seh.tw：tw8 只抓，不 clone repo、不碰 git、不呼叫 Claude；
// 改編、守門、commit 都留在境外主機的 pipeline/run.mjs（讀收件匣模式，見 pipeline/inbox-source.mjs）。
//
// 做什麼：Auth → JList（當日異動清單）→ 只留民事 V／行政 A（與 run.mjs 的 prefilterJids 一致）
//        → 逐筆 JDoc（最多 JUD_MAX_DOCS 筆，預設 400）→ 寫到 OUT 目錄：
//          jlist.json（過濾前的完整異動清單，jid 陣列）、docs.jsonl（每行一份 JDoc 原始 JSON）、fetch-meta.json
// 不做：分類、去重（seen 帳本在境外），所以每天抓的是「當日異動」裡的 V/A 全部（到上限為止）。
//
// 環境變數：JUD_USER、JUD_PASS（必填）；OUT（輸出目錄，必填）；JUD_MAX_DOCS（預設 400）。
// 服務時間僅每日 00:00–06:00（台灣）。
import https from 'node:https';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// JUD_API 只給測試用（指向本機假 server，例如 http://127.0.0.1:8799/jdg/api）；正式一律打司法院。
const API = new URL(process.env.JUD_API || 'https://data.judicial.gov.tw/jdg/api');
const HOST = API.hostname, BASE = API.pathname.replace(/\/$/, ''), PORT = API.port || undefined;
const lib = API.protocol === 'http:' ? http : https;
const ALLOWED = new Set(['V', 'A']);            // 與 pipeline/config.mjs 的 ALLOWED_COURT_TYPES 同步
const MAX = Number(process.env.JUD_MAX_DOCS || 400);
const OUT = process.env.OUT;
const log = (...a) => console.log(new Date().toISOString(), '[tw8-fetch]', ...a);

function once(p, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = lib.request({ hostname: HOST, port: PORT, path: `${BASE}/${p}`, method: 'POST', timeout: timeoutMs,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (res) => {
      let data = ''; res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed; try { parsed = JSON.parse(data); } catch { parsed = data; }
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`${p} HTTP ${res.statusCode}: ${String(data).slice(0, 200)}`));
        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`${p} timeout`)));
    req.write(payload); req.end();
  });
}
async function post(p, body, { retries = 3, timeoutMs = 30000 } = {}) {
  const payload = JSON.stringify(body); let last;
  for (let i = 0; i < retries; i++) {
    try { return await once(p, payload, timeoutMs); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 2000 * (i + 1))); }
  }
  throw last;
}
// JID 第一段（法院代碼）最後一字＝裁判類別；與 pipeline/jid.mjs 的 courtTypeOf 一致
const courtType = (jid) => { const c = String(jid).split(',')[0] || ''; return c.slice(-1); };

async function main() {
  const { JUD_USER: user, JUD_PASS: pass } = process.env;
  if (!user || !pass) throw new Error('缺 JUD_USER／JUD_PASS');
  if (!OUT) throw new Error('缺 OUT');
  await fs.mkdir(OUT, { recursive: true });
  const a = await post('Auth', { user, password: pass });
  if (!a || !a.Token) throw new Error(`Auth 失敗：${JSON.stringify(a).slice(0, 200)}`);
  const jl = await post('JList', { token: a.Token });
  if (!Array.isArray(jl)) throw new Error(`JList 失敗：${JSON.stringify(jl).slice(0, 200)}`);
  const all = jl.flatMap((d) => (Array.isArray(d.list) ? d.list : []));
  const want = all.filter((j) => ALLOWED.has(courtType(j))).slice(0, MAX);
  log(`異動 ${all.length} 筆；V/A ${all.filter((j) => ALLOWED.has(courtType(j))).length} 筆；本次抓 ${want.length} 筆`);
  const lines = []; let fail = 0;
  for (const jid of want) {
    try {
      const d = await post('JDoc', { token: a.Token, j: jid });
      if (d && d.JID) lines.push(JSON.stringify(d)); else fail++;
    } catch (e) { fail++; log('JDoc 失敗', jid, e.message); }
  }
  await fs.writeFile(path.join(OUT, 'jlist.json'), JSON.stringify(all) + '\n');
  await fs.writeFile(path.join(OUT, 'docs.jsonl'), lines.join('\n') + (lines.length ? '\n' : ''));
  await fs.writeFile(path.join(OUT, 'fetch-meta.json'), JSON.stringify({ fetchedAt: new Date().toISOString(), changeList: all.length, wanted: want.length, docs: lines.length, failed: fail, max: MAX }, null, 2) + '\n');
  log(`完成：docs ${lines.length}、失敗 ${fail}`);
  if (want.length && !lines.length) process.exit(1);   // 一份都沒抓到＝這輪失敗，不投遞
}
main().catch((e) => { console.error(new Date().toISOString(), '[tw8-fetch] FATAL', e.message); process.exit(1); });
