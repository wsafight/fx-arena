import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __root = fileURLToPath(new URL('..', import.meta.url));
const RAW_DIR = join(__root, 'metrics', 'raw', 'simple');
const OUT = join(__root, 'metrics', 'summary.json');

function quantile(arr, q) {
  const s = arr.slice().sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
}

function stats(samples) {
  if (!samples?.length) return null;
  // Trim 10% from each tail when we have enough samples — removes the
  // single worst JIT hit and any one-off GC pause from distorting P50/P95.
  const sorted = samples.slice().sort((a, b) => a - b);
  const trim = sorted.length >= 10 ? Math.floor(sorted.length * 0.1) : 0;
  const trimmed = trim ? sorted.slice(trim, sorted.length - trim) : sorted;

  const p50 = quantile(trimmed, 0.5);
  const p95 = quantile(trimmed, 0.95);
  const iqr = quantile(trimmed, 0.75) - quantile(trimmed, 0.25);
  const min = trimmed[0];
  const max = trimmed[trimmed.length - 1];
  return { n: samples.length, nAfterTrim: trimmed.length, p50, p95, iqr, min, max };
}

async function main() {
  let files = [];
  try { files = (await readdir(RAW_DIR)).filter(f => f.endsWith('.json')); } catch {}

  const frameworks = {};
  for (const f of files) {
    const data = JSON.parse(await readFile(join(RAW_DIR, f), 'utf8'));
    const agg = {};
    for (const [sid, samples] of Object.entries(data.scenarios)) agg[sid] = stats(samples);
    frameworks[data.framework] = agg;
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    commit: process.env.GITHUB_SHA || null,
    runner: process.env.RUNNER_NAME || null,
    simple: frameworks
  };
  await mkdir(join(__root, 'metrics'), { recursive: true });
  await writeFile(OUT, JSON.stringify(summary, null, 2));
  console.log('wrote', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
