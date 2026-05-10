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
  const sorted = samples.slice().sort((a, b) => a - b);
  const trim = sorted.length >= 10 ? Math.floor(sorted.length * 0.1) : 0;
  const trimmed = trim ? sorted.slice(trim, sorted.length - trim) : sorted;

  const p50 = quantile(trimmed, 0.5);
  const p95 = quantile(sorted, 0.95);
  const iqr = quantile(trimmed, 0.75) - quantile(trimmed, 0.25);
  const min = trimmed[0];
  const max = trimmed[trimmed.length - 1];
  const iqrRatio = p50 > 0 ? iqr / p50 : 0;
  return { n: samples.length, nAfterTrim: trimmed.length, p50, p95, iqr, iqrRatio, min, max };
}

function numericStats(samples) {
  const vals = samples.filter(n => typeof n === 'number' && Number.isFinite(n));
  if (!vals.length) return null;
  const sorted = vals.slice().sort((a, b) => a - b);
  const p50 = quantile(sorted, 0.5);
  const p95 = quantile(sorted, 0.95);
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  return { n: sorted.length, p50, p95, iqr, min: sorted[0], max: sorted[sorted.length - 1] };
}

function memoryStats(samples) {
  if (!samples?.length) return null;
  return {
    n: samples.length,
    usedJSHeapSize: numericStats(samples.map(s => s.usedJSHeapSize)),
    totalJSHeapSize: numericStats(samples.map(s => s.totalJSHeapSize)),
    nodes: numericStats(samples.map(s => s.nodes)),
    documents: numericStats(samples.map(s => s.documents)),
    jsEventListeners: numericStats(samples.map(s => s.jsEventListeners))
  };
}

async function main() {
  let files = [];
  try { files = (await readdir(RAW_DIR)).filter(f => f.endsWith('.json')); } catch {}

  const frameworks = {};
  const memory = {};
  for (const f of files) {
    let data;
    try {
      data = JSON.parse(await readFile(join(RAW_DIR, f), 'utf8'));
    } catch (e) {
      console.warn(`skipping ${f}: ${e.message}`);
      continue;
    }
    const agg = {};
    for (const [sid, samples] of Object.entries(data.scenarios)) agg[sid] = stats(samples);
    frameworks[data.framework] = agg;
    if (data.memory) {
      const memoryAgg = {};
      for (const [sid, samples] of Object.entries(data.memory)) memoryAgg[sid] = memoryStats(samples);
      memory[data.framework] = memoryAgg;
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    commit: process.env.GITHUB_SHA || null,
    runner: process.env.RUNNER_NAME || null,
    simple: frameworks,
    memory
  };
  await mkdir(join(__root, 'metrics'), { recursive: true });
  await writeFile(OUT, JSON.stringify(summary, null, 2));
  console.log('wrote', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
