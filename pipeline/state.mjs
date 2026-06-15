// pipeline/state.mjs
import { promises as fs } from 'node:fs';

export async function loadSeen(path) {
  try {
    const raw = await fs.readFile(path, 'utf8');
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (err) {
    if (err.code === 'ENOENT') return new Set();
    throw err;
  }
}

export async function saveSeen(path, set) {
  const arr = [...set].sort();
  await fs.writeFile(path, JSON.stringify(arr, null, 2) + '\n', 'utf8');
}
