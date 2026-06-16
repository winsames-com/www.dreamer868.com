// pipeline/checkup/parse.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lastRun, summarizeRun, parseGscCounts } from './parse.mjs';

const RUN_OK = `[pipeline] authenticated
[pipeline] change list size 42
[pipeline] after prefilter+dedup 7
[pipeline] candidates to rewrite 2
[pipeline] GSC 字詞分流： personal=3 family=0 corporate=1 wealth-tax=0
[pipeline] ## 判決 pipeline 2026-06-16
[pipeline] - 異動清單：42
[pipeline] - 候選：2
[pipeline] - 發佈：1（personal-story-02）
[pipeline] - 隔離：1（gate2(worth=2)）
[pipeline] - 模式：正式
[cron] 已發佈並推送`;

const RUN_DEGRADED = `[pipeline] authenticated
[pipeline] change list size 10
[pipeline] after prefilter+dedup 0
[pipeline] candidates to rewrite 0
[pipeline] nothing to do
[insights] GSC 字詞拉取失敗，降級為無字詞: 403 PERMISSION_DENIED`;

test('parseGscCounts 解析 key=value', () => {
  assert.deepEqual(parseGscCounts('personal=3 family=0 corporate=1 wealth-tax=0'), {
    personal: 3, family: 0, corporate: 1, 'wealth-tax': 0,
  });
});

test('summarizeRun 正常發佈 run', () => {
  const r = summarizeRun(RUN_OK);
  assert.equal(r.authenticated, true);
  assert.equal(r.changeListSize, 42);
  assert.equal(r.afterDedup, 7);
  assert.equal(r.candidates, 2);
  assert.equal(r.gscStatus, 'ok');
  assert.deepEqual(r.gscCounts, { personal: 3, family: 0, corporate: 1, 'wealth-tax': 0 });
  assert.equal(r.summaryDate, '2026-06-16');
  assert.equal(r.published, 1);
  assert.deepEqual(r.publishedSlugs, ['personal-story-02']);
  assert.equal(r.quarantined, 1);
  assert.deepEqual(r.quarantineReasons, ['gate2(worth=2)']);
  assert.equal(r.mode, '正式');
  assert.equal(r.fatal, null);
  assert.equal(r.cronNote, '已發佈並推送');
});

test('summarizeRun GSC 降級 + nothing to do', () => {
  const r = summarizeRun(RUN_DEGRADED);
  assert.equal(r.gscStatus, 'degraded');
  assert.match(r.gscDegradeMsg, /403/);
  assert.equal(r.nothingToDo, true);
  assert.equal(r.candidates, 0);
  assert.equal(r.published, null); // 無摘要區塊
});

test('summarizeRun 多 slug 與含逗號的隔離 reason 不被誤切', () => {
  const run = `[pipeline] authenticated
[pipeline] ## 判決 pipeline 2026-06-17
[pipeline] - 發佈：2（personal-story-02, family-story-03）
[pipeline] - 隔離：1（gate2(anon=true,faithful=true,relevant=true,worthiness=2)）`;
  const r = summarizeRun(run);
  assert.deepEqual(r.publishedSlugs, ['personal-story-02', 'family-story-03']);
  assert.deepEqual(r.quarantineReasons, ['gate2(anon=true,faithful=true,relevant=true,worthiness=2)']);
});

test('summarizeRun FATAL', () => {
  const r = summarizeRun('[pipeline] FATAL Error: Missing JUD_USER / JUD_PASS');
  assert.match(r.fatal, /Missing JUD_USER/);
  assert.equal(r.authenticated, false);
});

test('lastRun 取最後一段 run', () => {
  const log = RUN_DEGRADED + '\n' + RUN_OK;
  const seg = lastRun(log);
  assert.ok(seg.includes('change list size 42'));
  assert.ok(!seg.includes('403 PERMISSION_DENIED'));
});

test('lastRun 無 authenticated 時退回尾段', () => {
  const seg = lastRun('[pipeline] FATAL boom');
  assert.match(seg, /FATAL boom/);
});
