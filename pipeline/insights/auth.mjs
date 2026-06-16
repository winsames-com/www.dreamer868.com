// pipeline/insights/auth.mjs
// 共用 service account 認證與 REST 呼叫（GET/POST），給 GA4 與 Search Console 用。

import { GoogleAuth } from 'google-auth-library';
import { KEY_FILE, SCOPES } from './config.mjs';

let _clientPromise;

export function getClient() {
  if (!_clientPromise) {
    const auth = new GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
    _clientPromise = auth.getClient();
  }
  return _clientPromise;
}

// 統一錯誤處理：回傳 {ok, data} 或 {ok:false, status, message, reason}。
function wrap(fn) {
  return fn().then(
    (res) => ({ ok: true, data: res.data }),
    (e) => ({
      ok: false,
      status: e.response?.status,
      message: e.response?.data?.error?.message || e.message,
      reason: e.response?.data?.error?.status,
    }),
  );
}

export async function getJson(url) {
  const client = await getClient();
  return wrap(() => client.request({ url }));
}

export async function postJson(url, body) {
  const client = await getClient();
  return wrap(() => client.request({ url, method: 'POST', data: body }));
}
