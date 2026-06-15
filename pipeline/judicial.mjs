// pipeline/judicial.mjs
// 官方 API 契約（規格 114.08.22）：
//   POST https://data.judicial.gov.tw/jdg/api/Auth  body {user,password} -> {Token} | {error}
//   POST .../JList  body {token} -> [{date, list:[jid...]}] | "驗證失敗"
//   POST .../JDoc   body {token, j:jid} -> {JID,JYEAR,JCASE,JNO,JDATE,JTITLE,JFULLX:{JFULLTYPE,JFULLCONTENT,JFULLPDF},ATTACHMENTS} | {error}
// 服務時間僅每日 00:00–06:00（台灣）。

const BASE = 'https://data.judicial.gov.tw/jdg/api';

async function postJson(path, body, { retries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${BASE}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      if (!res.ok) throw new Error(`${path} HTTP ${res.status}: ${text.slice(0, 200)}`);
      return data;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
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
  // 攤平成單一 jid 陣列
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
  if (x.JFULLTYPE === 'text') return (x.JFULLCONTENT || '').toString();
  return '';
}

// 由 JDoc 組出可讀字號：例「臺灣高等法院 101 年度上易字第 797 號」需法院中文名，
// API 未直接提供法院中文名，故以「年度+字別+號」格式記錄，法院別以 court code 註記。
export function caseSourceOf(doc) {
  const year = doc.JYEAR || '';
  const jcase = doc.JCASE || '';
  const no = doc.JNO || '';
  return `${year} 年度${jcase}字第 ${no} 號（${doc.JID}）`;
}
