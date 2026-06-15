// pipeline/claude.mjs
// 共用的 `claude -p`（本機訂閱帳戶）呼叫：送出 prompt、要求 JSON、解析回傳。
// `claude -p --output-format json` 回傳信封 {type:"result", result:"<助手文字>", is_error, ...}。

import { spawn } from 'node:child_process';
import { MODEL } from './config.mjs';

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
    const child = spawn('claude', ['-p', '--output-format', 'json', '--model', MODEL], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('claude -p timeout')); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude exit ${code}: ${err.slice(0, 200)}`));
      resolve(out);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// 送 prompt → 取回助手輸出的 JSON 物件（throws on error / parse failure）。
export async function askJson(prompt, opts) {
  const raw = await claudePrint(prompt, opts);
  const envelope = JSON.parse(raw);
  if (envelope.is_error || typeof envelope.result !== 'string') {
    throw new Error('claude_error');
  }
  return parseJsonLoose(envelope.result);
}
