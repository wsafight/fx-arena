import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIOS, FRAMEWORKS } from '../bench/scenarios.mjs';

const __root = fileURLToPath(new URL('..', import.meta.url));
const SUMMARY = join(__root, 'metrics', 'summary.json');
const SITE = join(__root, 'site');

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function fmt(n) { return n == null ? '—' : n.toFixed(1); }

function pickColor(id) {
  return { react:'#61dafb', svelte:'#ff3e00', imba:'#6610f2', ripple:'#10b981' }[id] || '#888';
}

function renderTable(summary) {
  const ids = FRAMEWORKS.map(f => f.id).filter(id => summary.simple?.[id]);
  let out = '<table class="bench"><thead><tr><th>scenario</th>';
  for (const id of ids) out += `<th>${esc(id)} P50 / P95 (ms)</th>`;
  out += '</tr></thead><tbody>';
  for (const sc of SCENARIOS) {
    out += `<tr><td>${esc(sc.id)}</td>`;
    for (const id of ids) {
      const s = summary.simple[id][sc.id];
      out += `<td>${fmt(s?.p50)} / ${fmt(s?.p95)}</td>`;
    }
    out += '</tr>';
  }
  return out + '</tbody></table>';
}

function renderCharts(summary) {
  const ids = FRAMEWORKS.map(f => f.id).filter(id => summary.simple?.[id]);
  const W = 640, BAR_H = 22, PAD_L = 140, PAD_R = 60, PAD_T = 10, PAD_B = 20;
  return SCENARIOS.map(sc => {
    const bars = ids.map(id => ({ id, v: summary.simple[id][sc.id]?.p50 ?? 0 }));
    const max = Math.max(1, ...bars.map(b => b.v));
    const H = PAD_T + PAD_B + BAR_H * bars.length;
    const innerW = W - PAD_L - PAD_R;
    const rows = bars.map((b, i) => {
      const y = PAD_T + i * BAR_H + 2;
      const w = (b.v / max) * innerW;
      const c = pickColor(b.id);
      return `
        <text x="${PAD_L - 8}" y="${y + BAR_H/2 + 4}" text-anchor="end" font-size="12">${esc(b.id)}</text>
        <rect x="${PAD_L}" y="${y}" width="${w.toFixed(1)}" height="${BAR_H - 6}" fill="${c}" rx="2"/>
        <text x="${PAD_L + w + 6}" y="${y + BAR_H/2 + 4}" font-size="12">${fmt(b.v)} ms</text>`;
    }).join('');
    return `<figure><figcaption>${esc(sc.id)} — P50</figcaption>
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(sc.id)} P50 bars">${rows}</svg>
    </figure>`;
  }).join('');
}

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

async function main() {
  if (!(await exists(SUMMARY))) {
    console.error('no summary.json — run `bun run bench` first.');
    process.exit(1);
  }
  const summary = JSON.parse(await readFile(SUMMARY, 'utf8'));
  await mkdir(SITE, { recursive: true });
  await copyFile(SUMMARY, join(SITE, 'summary.json'));

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>fx-arena — simple-bench</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
  h1 { margin-bottom: 0.25rem; }
  .meta { color: #666; font-size: 12px; margin-bottom: 2rem; }
  table.bench { border-collapse: collapse; width: 100%; margin-bottom: 2rem; font-variant-numeric: tabular-nums; }
  table.bench th, table.bench td { border: 1px solid #e0e0e0; padding: 6px 10px; text-align: right; }
  table.bench th:first-child, table.bench td:first-child { text-align: left; }
  figure { margin: 0 0 1rem; padding: 0; }
  figcaption { font-weight: 600; margin-bottom: 0.25rem; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  a { color: #0969da; }
</style>
</head><body>
<h1>fx-arena — simple-bench</h1>
<div class="meta">
  generated ${esc(summary.generatedAt)}
  ${summary.commit ? ' · commit <code>' + esc(summary.commit.slice(0,7)) + '</code>' : ''}
  ${summary.runner ? ' · runner ' + esc(summary.runner) : ''}
  · <a href="summary.json">download raw JSON</a>
</div>
<p>List-bench only (phase 1). Lower is better. P50 / P95 over 10 samples, first run discarded. See <a href="https://github.com/">repo</a> for the source and the full design doc.</p>
<h2>Results</h2>
${renderTable(summary)}
<h2>P50 per scenario</h2>
<div class="grid">${renderCharts(summary)}</div>
</body></html>`;
  await writeFile(join(SITE, 'index.html'), html);
  console.log('wrote', join(SITE, 'index.html'));
}

main().catch((e) => { console.error(e); process.exit(1); });
