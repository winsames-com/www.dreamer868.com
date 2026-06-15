// pipeline/jid.mjs
// JID 格式：法院別+裁判類別,年度,字別,號次,裁判日期,檢查單號
// 例：CHDM,105,交訴,51,20161216,1（第一段最後一字為裁判類別 V/M/A/P/C）

export function parseJid(jid) {
  if (typeof jid !== 'string') return null;
  const parts = jid.split(',');
  if (parts.length < 6) return null;
  const [court, year, jcase, no, date, check] = parts;
  if (!court || !year || !jcase) return null;
  return { court, year, jcase, no, date, check, raw: jid };
}

export function courtTypeOf(jid) {
  const p = parseJid(jid);
  if (!p) return null;
  return p.court.slice(-1);
}
