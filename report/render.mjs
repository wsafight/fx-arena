import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIOS, FRAMEWORKS, SAMPLES } from '../bench/scenarios.mjs';

const __root = fileURLToPath(new URL('..', import.meta.url));
const SUMMARY = join(__root, 'metrics', 'summary.json');
const BUNDLE = join(__root, 'metrics', 'bundle-size.json');
const SITE = join(__root, 'site');

const NOISE_THRESHOLD = 0.2; // iqr / p50 > this → cell is flagged noisy

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function fmt(n) { return n == null ? '—' : n.toFixed(1); }
function fmtKB(n) { return n == null ? '—' : (n / 1024).toFixed(1); }

function pickColor(id) {
  return { react:'#61dafb', svelte:'#ff3e00', imba:'#6610f2', ripple:'#10b981', vue:'#42b883', 'vue-vapor':'#35495e' }[id] || '#888';
}

function noisy(s) {
  return s && s.p50 > 0 && s.iqrRatio != null && s.iqrRatio > NOISE_THRESHOLD;
}

function renderBundleTable(bundle, t) {
  if (!bundle?.simple) return '';
  const ids = FRAMEWORKS.map(f => f.id).filter(id => bundle.simple[id]);
  let out = `<table class="bench"><thead><tr><th>${esc(t.bundleFramework)}</th><th>${esc(t.bundleRaw)}</th><th>${esc(t.bundleGzip)}</th></tr></thead><tbody>`;
  for (const id of ids) {
    const b = bundle.simple[id];
    out += `<tr><td>${esc(id)}</td><td>${fmtKB(b.raw)}</td><td>${fmtKB(b.gz)}</td></tr>`;
  }
  return out + '</tbody></table>';
}

function renderTable(summary, t) {
  const ids = FRAMEWORKS.map(f => f.id).filter(id => summary.simple?.[id]);
  let out = `<table class="bench"><thead><tr><th>${esc(t.colScenario)}</th>`;
  for (const id of ids) out += `<th>${esc(t.colHead(id))}</th>`;
  out += '</tr></thead><tbody>';
  for (const sc of SCENARIOS) {
    out += `<tr><td>${esc(sc.id)}</td>`;
    for (const id of ids) {
      const s = summary.simple[id][sc.id];
      const title = s ? `n=${s.n}, iqr=${fmt(s.iqr)}ms (${((s.iqrRatio||0)*100).toFixed(0)}% of p50)` : '';
      const cls = noisy(s) ? ' class="noisy"' : '';
      out += `<td${cls} title="${esc(title)}">${fmt(s?.p50)} / ${fmt(s?.p95)}</td>`;
    }
    out += '</tr>';
  }
  return out + '</tbody></table>';
}

function renderCharts(summary, t) {
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
    return `<figure><figcaption>${esc(t.chartCaption(sc.id))}</figcaption>
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(sc.id)} P50 bars">${rows}</svg>
    </figure>`;
  }).join('');
}

async function exists(p) { try { await stat(p); return true; } catch { return false; } }
async function loadJson(p) {
  if (!(await exists(p))) return null;
  return JSON.parse(await readFile(p, 'utf8'));
}

const I18N = {
  en: {
    title: 'fx-arena — simple-bench',
    lang: 'English',
    other: { href: 'zh.html', label: '中文' },
    generated: 'generated',
    commit: 'commit',
    runner: 'runner',
    downloadRaw: 'download raw JSON',
    intro: (n) => `List-bench only (phase 1). Lower is better. P50 / P95 over ${n} samples with 10% trim; first runs discarded as warm-up. See <a href="https://github.com/wsafight/fx-arena">wsafight/fx-arena</a> for the source and the full design doc.`,
    bundleHead: 'Bundle size',
    bundleLegend: `raw + gzip of every <code>.js</code>/<code>.css</code> under <code>dist/</code>. A framework's production cost on first load.`,
    bundleNote: `Ripple's number reflects a project-level workaround: the upstream <code>@tsrx/core</code> barrel has side-effect imports that defeat tree-shaking and leak the compiler (~450 KB of acorn + TS parser + tsrx plugin) into the client bundle. We alias <code>@tsrx/core</code> to a local shim that re-exports only the 7 symbols the runtime needs — the stock build would be ~283 KB raw / ~80 KB gzip. See <a href="https://github.com/wsafight/fx-arena/blob/main/VERSIONS.md">VERSIONS.md</a> for details. Raw JSON: <a href="bundle-size.json">bundle-size.json</a>`,
    bundleFramework: 'framework',
    bundleRaw: 'raw (KB)',
    bundleGzip: 'gzip (KB)',
    resultsHead: 'Results',
    resultsLegend: (th) => `Yellow cells (⚠) have <code>iqr/p50 &gt; ${th}</code> — the middle 50% of samples spans more than ${th*100}% of the median, so the number is too noisy to compare precisely on a single-runner CI. Hover a cell for the raw spread.`,
    colScenario: 'scenario',
    colHead: (id) => `${id} P50 / P95 (ms)`,
    chartsHead: 'P50 per scenario',
    chartCaption: (id) => `${id} — P50`
  },
  zh: {
    title: 'fx-arena — 简单性能基准',
    lang: '中文',
    other: { href: 'index.html', label: 'English' },
    generated: '生成时间',
    commit: '提交',
    runner: '执行机',
    downloadRaw: '下载原始 JSON',
    intro: (n) => `仅简单列表基准（Phase 1）。数值越低越好。每场景 ${n} 次采样，去除两端各 10% 后取 P50 / P95；首轮作为预热丢弃。源码与完整方案见 <a href="https://github.com/wsafight/fx-arena">wsafight/fx-arena</a>。`,
    bundleHead: '打包体积',
    bundleLegend: `各端 <code>dist/</code> 下所有 <code>.js</code> / <code>.css</code> 的原始体积与 gzip 体积，代表"首屏加载代价"。`,
    bundleNote: `Ripple 的数字是项目级 workaround 后的值：上游 <code>@tsrx/core</code> barrel 存在副作用 import（acorn、TS parser、tsrx 编译插件），导致 tree-shake 失效，编译器本身（约 450 KB）泄漏到浏览器 bundle。我们在 <code>vite.config.js</code> 中用 alias 把 <code>@tsrx/core</code> 重定向到一个只导出运行时实际需要 7 个符号的 shim。默认构建下这个数字会是 ~283 KB raw / ~80 KB gzip。详情见 <a href="https://github.com/wsafight/fx-arena/blob/main/VERSIONS.md">VERSIONS.md</a>。原始 JSON：<a href="bundle-size.json">bundle-size.json</a>。`,
    bundleFramework: '框架',
    bundleRaw: '原始 (KB)',
    bundleGzip: 'gzip (KB)',
    resultsHead: '结果',
    resultsLegend: (th) => `黄色单元格（⚠）表示 <code>iqr/p50 &gt; ${th}</code>——中间 50% 样本的跨度超过中位数的 ${th*100}%，单机 CI 下该数字不够稳定，不能精确对比。悬停单元格可看原始离散度。`,
    colScenario: '场景',
    colHead: (id) => `${id} P50 / P95 (ms)`,
    chartsHead: '各场景 P50',
    chartCaption: (id) => `${id} — P50`
  }
};

const STYLE = `
  body { font: 14px/1.5 system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
  h1 { margin-bottom: 0.25rem; }
  h2 { margin-top: 2rem; }
  .meta { color: #666; font-size: 12px; margin-bottom: 2rem; }
  table.bench { border-collapse: collapse; width: 100%; margin-bottom: 1rem; font-variant-numeric: tabular-nums; }
  table.bench th, table.bench td { border: 1px solid #e0e0e0; padding: 6px 10px; text-align: right; }
  table.bench th:first-child, table.bench td:first-child { text-align: left; }
  td.noisy { background: #fff8c5; }
  td.noisy::after { content: ' ⚠'; color: #9a6700; }
  figure { margin: 0 0 1rem; padding: 0; }
  figcaption { font-weight: 600; margin-bottom: 0.25rem; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  a { color: #0969da; }
  .legend { color: #666; font-size: 12px; margin: -0.5rem 0 1.5rem; }
  .lang-switch { float: right; font-size: 12px; }
`;

function renderPage(lang, summary, bundle) {
  const t = I18N[lang];
  const commitLink = summary.commit
    ? ` · ${esc(t.commit)} <a href="https://github.com/wsafight/fx-arena/commit/${esc(summary.commit)}"><code>${esc(summary.commit.slice(0,7))}</code></a>`
    : '';
  const runnerTag = summary.runner ? ` · ${esc(t.runner)} ${esc(summary.runner)}` : '';
  const bundleSection = bundle
    ? `<h2>${esc(t.bundleHead)}</h2><p class="legend">${t.bundleLegend}</p>${renderBundleTable(bundle, t)}<p class="legend">${t.bundleNote}</p>`
    : '';
  const langSwitch = `<a class="lang-switch" href="${t.other.href}">${esc(t.other.label)}</a>`;

  return `<!doctype html>
<html lang="${lang}"><head>
<meta charset="utf-8"/>
<title>${esc(t.title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>${STYLE}</style>
</head><body>
${langSwitch}
<h1>${esc(t.title)}</h1>
<div class="meta">
  ${esc(t.generated)} ${esc(summary.generatedAt)}${commitLink}${runnerTag}
  · <a href="summary.json">${esc(t.downloadRaw)}</a>
</div>
<p>${t.intro(SAMPLES)}</p>
${bundleSection}
<h2>${esc(t.resultsHead)}</h2>
<p class="legend">${t.resultsLegend(NOISE_THRESHOLD)}</p>
${renderTable(summary, t)}
<h2>${esc(t.chartsHead)}</h2>
<div class="grid">${renderCharts(summary, t)}</div>
</body></html>`;
}

async function main() {
  const summary = await loadJson(SUMMARY);
  if (!summary) { console.error('no summary.json — run `bun run bench` first.'); process.exit(1); }
  const bundle = await loadJson(BUNDLE);

  await mkdir(SITE, { recursive: true });
  await copyFile(SUMMARY, join(SITE, 'summary.json'));
  if (bundle) await copyFile(BUNDLE, join(SITE, 'bundle-size.json'));

  await writeFile(join(SITE, 'index.html'), renderPage('en', summary, bundle));
  await writeFile(join(SITE, 'zh.html'),    renderPage('zh', summary, bundle));
  console.log('wrote', join(SITE, 'index.html'), '+', join(SITE, 'zh.html'));
}

main().catch((e) => { console.error(e); process.exit(1); });
