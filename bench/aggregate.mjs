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
  const p50 = quantile(samples, 0.5);
  const p95 = quantile(samples, 0.95);
  const iqr = quantile(samples, 0.75) - quantile(samples, 0.25);
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  return { n: samples.length, p50, p95, iqr, min, max };
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
