// pipeline/judicial.mjs
// 官方 API 契約（規格 114.08.22）：
//   POST https://data.judicial.gov.tw/jdg/api/Auth  body {user,password} -> {Token} | {error}
//   POST .../JList  body {token} -> [{date, list:[jid...]}] | "驗證失敗"
//   POST .../JDoc   body {token, j:jid} -> {JID,JYEAR,JCASE,JNO,JDATE,JTITLE,JFULLX:{JFULLTYPE,JFULLCONTENT,JFULLPDF},ATTACHMENTS} | {error}
// 服務時間僅每日 00:00–06:00（台灣）。
//
// DNS 註記：本機系統 DNS（如阿里 223.6.6.6）對 *.judicial.gov.tw 回 SERVFAIL，
// 故此 client 用 node:https 搭配自訂 lookup，改走公共 DNS（1.1.1.1 / 8.8.8.8）解析。
// 已於本機實測 node:https + 此 lookup 可連到 data.judicial.gov.tw。

import https from 'node:https';
import { Resolver } from 'node:dns';
import { extractCourtName } from './courts.mjs';

const BASE_HOST = 'data.judicial.gov.tw';
const BASE_PATH = '/jdg/api';

const resolver = new Resolver();
resolver.setServers(['1.1.1.1', '8.8.8.8']);

function dnsLookup(hostname, options, cb) {
  resolver.resolve4(hostname, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs || addrs.length === 0) return cb(new Error(`no A record for ${hostname}`));
    if (options && options.all) return cb(null, addrs.map((a) => ({ address: a, family: 4 })));
    cb(null, addrs[0], 4);
  });
}

function once(path, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: BASE_HOST,
        path: `${BASE_PATH}/${path}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        lookup: dnsLookup,
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = data; }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`${path} HTTP ${res.statusCode}: ${String(data).slice(0, 200)}`));
          }
          resolve(parsed);
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error(`${path} timeout`)); });
    req.write(payload);
    req.end();
  });
}

async function postJson(path, body, { retries = 3, timeoutMs = 30000 } = {}) {
  const payload = JSON.stringify(body);
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try { return await once(path, payload, timeoutMs); }
    catch (err) { lastErr = err; await new Promise((r) => setTimeout(r, 2000 * (i + 1))); }
  }
  throw lastErr;
}

export async function auth(user, password) {
  const data = await postJson('Auth', { user, password });
  if (!data || !data.Token) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data.Token;
}

export async function getChangeList(token) {
  const data = await postJson('JList', { token });
  if (!Array.isArray(data)) throw new Error(`JList failed: ${JSON.stringify(data).slice(0, 200)}`);
  const jids = [];
  for (const day of data) {
    if (day && Array.isArray(day.list)) jids.push(...day.list);
  }
  return jids;
}

export async function getDoc(token, jid) {
  const data = await postJson('JDoc', { token, j: jid });
  if (data && data.error) return null; // 已移除或未公開
  if (!data || !data.JID) throw new Error(`JDoc unexpected: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

// 由 JDoc 取純文字全文（型態為 file 的 PDF 略過，回空字串）。
export function fullText(doc) {
  const x = doc.JFULLX || {};
  // 司法院 API 的 JFULLTYPE 實務上多為 'file'（少數 'text'），兩者的 JFULLCONTENT 都帶判決全文文字。
  // 早期只認 'text' 會把絕大多數 'file' 型判決的全文丟成空字串 → 改編引擎拿到空白 → 模型瞎編
  // → 第二關 faithful=false／品質過低 → 0 發佈。故改為：只要 JFULLCONTENT 有文字就採用。
  const content = (x.JFULLCONTENT || '').toString();
  return content.trim() ? content : '';
}

// 字號：法院中文名取自全文開頭（extractCourtName）；取不到時退回 JID 以利回溯。
export function caseSourceOf(doc, fullTextStr = '') {
  const year = doc.JYEAR || '';
  const jcase = doc.JCASE || '';
  const no = doc.JNO || '';
  const court = extractCourtName(fullTextStr) || extractCourtName(fullText(doc));
  const tail = `${year} 年度${jcase}字第 ${no} 號`;
  return court ? `${court} ${tail}` : `${tail}（${doc.JID}）`;
}
