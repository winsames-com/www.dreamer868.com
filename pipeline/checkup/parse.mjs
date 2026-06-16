// pipeline/checkup/parse.mjs
// 純函式：解析判決 pipeline 的 cron log（/tmp/judgment-pipeline.log），
// 抽出「最近一次執行」的結構化事實，供每日 checkup 判讀。無 I/O、可單元測試。
//
// log 來源於 pipeline/run.mjs 的 `[pipeline] ...` 與 insights/queries.mjs 的 `[insights] ...`，
// 以及 cron.sh 的 `[cron] ...`。GSC 抓取：成功→`[pipeline] GSC 字詞分流：...`；
// 失敗/例外→`[insights] GSC 字詞拉取(失敗|例外)，降級為無字詞: <msg>`。

const RUN_START = '[pipeline] authenticated';

// 從累積 log 取「最近一次執行」的文字區段。
// 以最後一個 "authenticated" 為界；若整段沒有（例如認證前就 FATAL），退回最後 120 行。
export function lastRun(logText) {
  const text = String(logText || '');
  const idx = text.lastIndexOf(RUN_START);
  if (idx >= 0) {
    const lineStart = text.lastIndexOf('\n', idx) + 1; // 含該行開頭
    return text.slice(lineStart);
  }
  const lines = text.split('\n');
  return lines.slice(-120).join('\n');
}

// 把 "personal=1 family=0 corporate=0 wealth-tax=0" 解析成 {personal:1,...}
export function parseGscCounts(s) {
  const out = {};
  for (const m of String(s || '').matchAll(/([a-z-]+)=(\d+)/g)) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

const intAfter = (re, text) => {
  const m = text.match(re);
  return m ? Number(m[1]) : null;
};

// 把 run 區段解析成結構化事實。所有欄位在缺值時為 null/false，呼叫端自行判讀。
export function summarizeRun(runText) {
  const t = String(runText || '');

  // GSC 抓取狀態
  const degrade = t.match(/\[insights\] GSC 字詞拉取(?:失敗|例外)，降級為無字詞:?\s*(.*)/);
  const flow = t.match(/GSC 字詞分流：(.+)/);
  let gscStatus = 'unknown';
  let gscCounts = null;
  let gscDegradeMsg = null;
  if (degrade) {
    gscStatus = 'degraded';
    gscDegradeMsg = degrade[1].trim() || '(無訊息)';
  } else if (flow) {
    gscStatus = 'ok';
    gscCounts = parseGscCounts(flow[1]);
  }

  // 摘要區塊（## 判決 pipeline DATE 之後）
  const pub = t.match(/發佈：(\d+)（([^）]*)）/);
  const quar = t.match(/隔離：(\d+)（([^）]*)）/);
  // 注意：slugs 以 ', ' 連接（slug 不含逗號）；隔離 reason 以 '; ' 連接
  // （單一 reason 內部可含逗號，如 gate2(anon=true,faithful=true,...)）→ 各用各的分隔符。
  const splitBy = (sep) => (s) =>
    !s || s === '—' ? [] : s.split(sep).map((x) => x.trim()).filter(Boolean);
  const splitSlugs = splitBy(',');
  const splitReasons = splitBy(';');

  const fatal = t.match(/\[pipeline\] FATAL\s*(.*)/);
  const mode = t.match(/模式：([^\n]+)/);
  const cron = t.match(/\[cron\] (已發佈並推送|無新文章可提交|DRY_RUN[^\n]*)/);

  return {
    authenticated: t.includes(RUN_START),
    changeListSize: intAfter(/change list size (\d+)/, t),
    afterDedup: intAfter(/after prefilter\+dedup (\d+)/, t),
    candidates: intAfter(/candidates to rewrite (\d+)/, t),
    nothingToDo: /\[pipeline\] nothing to do/.test(t),
    gscStatus,                 // 'ok' | 'degraded' | 'unknown'
    gscCounts,                 // {personal,family,...} | null
    gscDegradeMsg,             // string | null
    summaryDate: (t.match(/## 判決 pipeline (\d{4}-\d{2}-\d{2})/) || [])[1] || null,
    summaryChangeList: intAfter(/異動清單：(\d+)/, t),
    summaryCandidates: intAfter(/候選：(\d+)/, t),
    published: pub ? Number(pub[1]) : null,
    publishedSlugs: pub ? splitSlugs(pub[2]) : [],
    quarantined: quar ? Number(quar[1]) : null,
    quarantineReasons: quar ? splitReasons(quar[2]) : [],
    mode: mode ? mode[1].trim() : null,
    fatal: fatal ? (fatal[1].trim() || '(無訊息)') : null,
    cronNote: cron ? cron[1].trim() : null,
  };
}
