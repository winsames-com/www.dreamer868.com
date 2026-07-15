// pipeline/claude.mjs
// 共用的 `claude -p`（本機訂閱帳戶）呼叫：送出 prompt、要求 JSON、解析回傳。
// `claude -p --output-format json` 回傳信封 {type:"result", result:"<助手文字>", is_error, ...}。

import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MODEL } from './config.mjs';

const ERR_LOG = path.join(path.dirname(fileURLToPath(import.meta.url)), '.cache', 'claude-errors.log');

// 失敗診斷落檔（best-effort，絕不因記 log 失敗而影響主流程）。
// 沉默失敗（claude exit 1 + 空 stderr）的真相多半在 stdout（用量上限/overloaded 信封），
// 舊版只 reject stderr 而丟棄 stdout → 真因被吞。這裡把 code/stdout/stderr 全寫下來。
function logClaudeFailure(kind, { code = null, out = '', err = '', promptLen = 0 } = {}) {
  try {
    mkdirSync(path.dirname(ERR_LOG), { recursive: true });
    const rec = {
      ts: new Date().toISOString(),
      kind,            // 'exit' | 'envelope' | 'parse'
      code,
      promptLen,
      stderr: String(err).slice(0, 2000),
      stdout: String(out).slice(0, 2000),
    };
    appendFileSync(ERR_LOG, JSON.stringify(rec) + '\n');
  } catch { /* 記 log 失敗無所謂 */ }
}

export function parseJsonLoose(s) {
  const t = String(s).trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();
  return JSON.parse(t);
}

export function claudePrint(prompt, { timeoutMs = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    // --max-turns 1：改編/查核/驗收都是「單輪文字→JSON」任務，不需 agentic 多輪或工具。
    // 強制單輪可大幅降低 token 消耗與耗時（避免新版 CLI 在精簡環境多繞數輪空轉），
    // 減輕夜間多站共用訂閱用量視窗的壓力。
    // --tools ""：把工具從模型視野整個拿掉。否則模型偶爾會想呼叫 Bash（如 wc -m 數
    // 標題字數自我檢查），一發 tool_use 就撞 --max-turns 1 → error_max_turns 整件隔離。
    const child = spawn('claude', ['-p', '--output-format', 'json', '--model', MODEL, '--max-turns', '1', '--tools', ''], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      logClaudeFailure('timeout', { code: null, out, err, promptLen: prompt.length });
      reject(new Error(`claude -p timeout（${timeoutMs}ms）；stdout=${out.slice(0, 120)}`));
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        // 把 stdout 也納入診斷（真錯誤訊息常在這）；完整內容另寫 .cache/claude-errors.log。
        logClaudeFailure('exit', { code, out, err, promptLen: prompt.length });
        const detail = (err.trim() || out.trim() || '(stdout/stderr 皆空)').slice(0, 300);
        return reject(new Error(`claude exit ${code}: ${detail}`));
      }
      resolve(out);
    });
    // claude 提早結束時，寫入 stdin 會噴 EPIPE：吞掉它，交由 'close'（非零 exit）統一 reject，
    // 避免未處理的 socket 'error' 事件讓整個 process 崩潰。
    child.stdin.on('error', () => {});
    try { child.stdin.write(prompt); child.stdin.end(); } catch { /* close 會處理 */ }
  });
}

// 送 prompt → 取回助手輸出的 JSON 物件（throws on error / parse failure）。
export async function askJson(prompt, opts) {
  const raw = await claudePrint(prompt, opts);
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch (e) {
    logClaudeFailure('parse', { code: 0, out: raw, promptLen: prompt.length });
    throw new Error(`claude 信封非 JSON：${String(raw).slice(0, 200)}`);
  }
  if (envelope.is_error || typeof envelope.result !== 'string') {
    // is_error 信封（如用量上限/overloaded）會帶說明；記下並拋出可讀原因。
    logClaudeFailure('envelope', { code: 0, out: raw, promptLen: prompt.length });
    const why = envelope.subtype || envelope.api_error_status || envelope.error || 'is_error';
    throw new Error(`claude_error: ${why}`);
  }
  return parseJsonLoose(envelope.result);
}
