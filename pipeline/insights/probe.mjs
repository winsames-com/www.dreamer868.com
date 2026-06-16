// pipeline/insights/probe.mjs
// 用 service account 金鑰探測：能存取哪些 GA4 資源、哪些 Search Console 站台。
// 一次驗證：連線 / API 是否啟用 / 授權是否就緒，並自動取得 GA4 數字 property ID。
// 跑法（從 repo 根目錄）：node pipeline/insights/probe.mjs

import { GoogleAuth } from 'google-auth-library';

const KEY_FILE = 'pipeline/.secrets/ga4-insights.json';

const auth = new GoogleAuth({
  keyFile: KEY_FILE,
  scopes: [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/webmasters.readonly',
  ],
});

async function getJson(client, url) {
  try {
    const res = await client.request({ url });
    return { ok: true, data: res.data };
  } catch (e) {
    const status = e.response?.status;
    const apiErr = e.response?.data?.error;
    return { ok: false, status, message: apiErr?.message || e.message, reason: apiErr?.status };
  }
}

async function main() {
  const client = await auth.getClient();
  console.log('[probe] service account:', (await auth.getCredentials()).client_email);
  console.log();

  // 1) GA4：列可存取的資源（Admin API accountSummaries）
  console.log('=== GA4 可存取資源（Google Analytics Admin API）===');
  const ga = await getJson(client, 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries');
  if (!ga.ok) {
    console.log(`  ✗ 失敗 [${ga.status} ${ga.reason || ''}] ${ga.message}`);
    if (/disabled|not been used|SERVICE_DISABLED/i.test(ga.message)) {
      console.log('  → 需在 Google Cloud Console 啟用「Google Analytics Admin API」');
    }
  } else {
    const summaries = ga.data.accountSummaries || [];
    if (summaries.length === 0) console.log('  （service account 尚未被加進任何 GA4 資源）');
    for (const acc of summaries) {
      console.log(`  帳戶: ${acc.displayName} (${acc.account})`);
      for (const p of acc.propertySummaries || []) {
        console.log(`    • ${p.displayName}  →  property ID = ${p.property.replace('properties/', '')}`);
      }
    }
  }
  console.log();

  // 2) Search Console：列已授權站台
  console.log('=== Search Console 已授權站台（Search Console API）===');
  const sc = await getJson(client, 'https://www.googleapis.com/webmasters/v3/sites');
  if (!sc.ok) {
    console.log(`  ✗ 失敗 [${sc.status} ${sc.reason || ''}] ${sc.message}`);
    if (/disabled|not been used|SERVICE_DISABLED/i.test(sc.message)) {
      console.log('  → 需在 Google Cloud Console 啟用「Google Search Console API」');
    }
  } else {
    const sites = sc.data.siteEntry || [];
    if (sites.length === 0) {
      console.log('  （此 service account 尚未被加進任何 Search Console 資源）');
      console.log('  → 到 Search Console → 設定 → 使用者與權限，新增 ga4-insights@yaocare.iam.gserviceaccount.com');
    }
    for (const s of sites) {
      console.log(`  • ${s.siteUrl}  (權限: ${s.permissionLevel})`);
    }
  }
}

main().catch((e) => { console.error('[probe] FATAL', e); process.exit(1); });
