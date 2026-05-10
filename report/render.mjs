import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIOS, FRAMEWORKS, SAMPLES, MEMORY_SCENARIOS, MEMORY_SAMPLES } from '../bench/scenarios.mjs';

const __root = fileURLToPath(new URL('..', import.meta.url));
const SUMMARY = join(__root, 'metrics', 'summary.json');
const BUNDLE = join(__root, 'metrics', 'bundle-size.json');
const SITE = join(__root, 'docs');

const NOISE_THRESHOLD = 0.2; // iqr / p50 > this → cell is flagged noisy

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function fmt(n) { return n == null ? '—' : n.toFixed(1); }
function fmtKB(n) { return n == null ? '—' : (n / 1024).toFixed(1); }
function fmtMB(n) { return n == null ? '—' : (n / 1024 / 1024).toFixed(1); }
function fmtInt(n) { return n == null ? '—' : String(Math.round(n)); }

function pickColor(id) {
  return { react:'#61dafb', svelte:'#ff3e00', imba:'#6610f2', ripple:'#10b981', vue:'#42b883', 'vue-vapor':'#35495e' }[id] || '#888';
}

function noisy(s) {
  return s && s.p50 > 0 && s.iqrRatio != null && s.iqrRatio > NOISE_THRESHOLD;
}

function renderBundleTable(bundle, t) {
  if (!bundle?.simple) return '';
  const ids = FRAMEWORKS.map(f => f.id).filter(id => bundle.simple[id]);
  ids.sort((a, b) => bundle.simple[a].raw - bundle.simple[b].raw);
  let out = `<table class="bench"><thead><tr><th>${esc(t.bundleFramework)}</th><th>${esc(t.bundleRaw)}</th><th>${esc(t.bundleGzip)}</th><th>${esc(t.bundleBr)}</th></tr></thead><tbody>`;
  for (const id of ids) {
    const b = bundle.simple[id];
    out += `<tr><td>${esc(id)}</td><td>${fmtKB(b.raw)}</td><td>${fmtKB(b.gz)}</td><td>${fmtKB(b.br)}</td></tr>`;
  }
  return out + '</tbody></table>';
}

function renderMemoryTable(summary, t) {
  if (!summary.memory || !Object.keys(summary.memory).length) return '';
  const { ids } = rankIds(summary);
  const memoryIds = ids.filter(id => summary.memory[id]);
  const n = memoryIds.length;
  const getMemoryScore = (id) => MEMORY_SCENARIOS.reduce((sum, sc) => {
    const vals = memoryIds.map(i => summary.memory[i]?.[sc.id]?.usedJSHeapSize?.p50 ?? Infinity);
    const sorted = [...vals].sort((x, y) => x - y);
    return sum + n - sorted.indexOf(summary.memory[id]?.[sc.id]?.usedJSHeapSize?.p50 ?? Infinity);
  }, 0);

  let out = `<table class="bench"><thead><tr><th>${esc(t.memoryScenario)}</th>`;
  for (const id of memoryIds) out += `<th>${esc(t.memoryCol(id))}</th>`;
  out += '</tr></thead><tbody>';
  for (const sc of MEMORY_SCENARIOS) {
    out += `<tr><td>${esc(sc.id)}</td>`;
    for (const id of memoryIds) {
      const s = summary.memory[id]?.[sc.id];
      const heap = fmtMB(s?.usedJSHeapSize?.p50);
      const nodes = fmtInt(s?.nodes?.p50);
      const listeners = fmtInt(s?.jsEventListeners?.p50);
      const title = s ? `n=${s.n}, heap=${heap}MB, nodes=${nodes}, listeners=${listeners}` : '';
      out += `<td title="${esc(title)}">${heap} / ${nodes}</td>`;
    }
    out += '</tr>';
  }
  out += `<tr class="score-row"><td>${esc(t.memoryScoreLabel)} <span class="score-help" data-tip="${esc(t.memoryScoreTooltip)}">?</span></td>`;
  for (const id of memoryIds) out += `<td><strong>${getMemoryScore(id)}</strong></td>`;
  out += '</tr>';
  return out + '</tbody></table>';
}

function rankIds(summary) {
  const ids = FRAMEWORKS.map(f => f.id).filter(id => summary.simple?.[id]);
  const n = ids.length;
  const getScore = (id) => SCENARIOS.reduce((sum, sc) => {
    const vals = ids.map(i => summary.simple[i][sc.id]?.p50 ?? Infinity);
    const sorted = [...vals].sort((x, y) => x - y);
    return sum + n - sorted.indexOf(summary.simple[id][sc.id]?.p50 ?? Infinity);
  }, 0);
  ids.sort((a, b) => getScore(b) - getScore(a));
  return { ids, getScore };
}

function renderTable(summary, t) {
  const { ids, getScore } = rankIds(summary);
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
  out += `<tr class="score-row"><td>${esc(t.scoreLabel)} <span class="score-help" data-tip="${esc(t.scoreTooltip)}">?</span></td>`;
  for (const id of ids) {
    out += `<td><strong>${getScore(id)}</strong></td>`;
  }
  out += '</tr>';
  return out + '</tbody></table>';
}

function renderCharts(summary, t) {
  const { ids } = rankIds(summary);
  const colors = ids.map(id => pickColor(id));
  const chartData = SCENARIOS.map(sc => ({
    id: sc.id,
    caption: t.chartCaption(sc.id),
    values: ids.map(id => ({ framework: id, value: +(summary.simple[id][sc.id]?.p50 ?? 0).toFixed(2) }))
  }));

  const containers = chartData.map(d =>
    `<div id="chart-${d.id}" style="height:280px;"></div>`
  ).join('');

  const script = `
<script src="https://unpkg.com/@visactor/vchart@2.0.22/build/index.min.js"><\/script>
<script>
(function(){
  var chartData = ${JSON.stringify(chartData)};
  var colors = ${JSON.stringify(colors)};
  chartData.forEach(function(d) {
    new VChart.VChart({
      type: 'bar',
      data: [{ values: d.values }],
      xField: 'framework',
      yField: 'value',
      seriesField: 'framework',
      color: colors,
      title: { visible: true, text: d.caption },
      label: { visible: true, position: 'top' },
      axes: [
        { orient: 'bottom', label: { visible: true } },
        { orient: 'left', title: { visible: true, text: 'ms' } }
      ]
    }, { dom: 'chart-' + d.id }).renderSync();
  });
})();
<\/script>`;

  return containers + script;
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
    bundleLegend: `raw + gzip + brotli of every <code>.js</code>/<code>.css</code> under <code>dist/</code>. A framework's production cost on first load.`,
    bundleNote: `Ripple's number reflects a project-level workaround: the upstream <code>@tsrx/core</code> barrel has side-effect imports that defeat tree-shaking and leak the compiler (~450 KB of acorn + TS parser + tsrx plugin) into the client bundle. We alias <code>@tsrx/core</code> to a local shim that re-exports only the 7 symbols the runtime needs — the stock build would be ~283 KB raw / ~80 KB gzip. See <a href="https://github.com/wsafight/fx-arena/blob/main/VERSIONS.md">VERSIONS.md</a> for details. Raw JSON: <a href="bundle-size.json">bundle-size.json</a>`,
    bundleFramework: 'framework',
    bundleRaw: 'raw (KB)',
    bundleGzip: 'gzip (KB)',
    bundleBr: 'br (KB)',
    memoryHead: 'Memory',
    memoryLegend: (n) => `P50 over ${n} fresh page loads. Columns use the same left-to-right order as the time results below. Each cell is <code>used JS heap MB / DOM nodes</code> after forced GC; hover for listener counts.`,
    memoryScenario: 'scenario',
    memoryCol: (id) => `${id} heap / nodes`,
    memoryScoreLabel: 'memory score',
    memoryScoreTooltip: 'Per memory scenario: lowest used JS heap gets N points (N = number of frameworks), highest gets 1. Higher total = lower heap overall.',
    resultsHead: 'Results',
    resultsLegend: (th) => `Yellow cells (⚠) have <code>iqr/p50 &gt; ${th}</code> — the middle 50% of samples spans more than ${th*100}% of the median, so the number is too noisy to compare precisely on a single local runner. Hover a cell for the raw spread.`,
    colScenario: 'scenario',
    colHead: (id) => `${id} P50 / P95 (ms)`,
    scoreLabel: 'score',
    scoreTooltip: 'Per scenario: fastest gets N points (N = number of frameworks), slowest gets 1. Higher total = better overall.',
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
    bundleLegend: `各端 <code>dist/</code> 下所有 <code>.js</code> / <code>.css</code> 的原始体积、gzip 与 brotli 体积，代表"首屏加载代价"。`,
    bundleNote: `Ripple 的数字是项目级 workaround 后的值：上游 <code>@tsrx/core</code> barrel 存在副作用 import（acorn、TS parser、tsrx 编译插件），导致 tree-shake 失效，编译器本身（约 450 KB）泄漏到浏览器 bundle。我们在 <code>vite.config.js</code> 中用 alias 把 <code>@tsrx/core</code> 重定向到一个只导出运行时实际需要 7 个符号的 shim。默认构建下这个数字会是 ~283 KB raw / ~80 KB gzip。详情见 <a href="https://github.com/wsafight/fx-arena/blob/main/VERSIONS.md">VERSIONS.md</a>。原始 JSON：<a href="bundle-size.json">bundle-size.json</a>。`,
    bundleFramework: '框架',
    bundleRaw: '原始 (KB)',
    bundleGzip: 'gzip (KB)',
    bundleBr: 'br (KB)',
    memoryHead: '内存',
    memoryLegend: (n) => `每项 ${n} 次全新页面加载后取 P50。列顺序与下方耗时结果一致。单元格格式为 <code>used JS heap MB / DOM nodes</code>，采样前强制 GC；悬停可看事件监听器数量。`,
    memoryScenario: '场景',
    memoryCol: (id) => `${id} heap / nodes`,
    memoryScoreLabel: '内存得分',
    memoryScoreTooltip: '每个内存场景：used JS heap 最低得 N 分（N = 框架数），最高得 1 分。总分越高，整体 heap 越低。',
    resultsHead: '结果',
    resultsLegend: (th) => `黄色单元格（⚠）表示 <code>iqr/p50 &gt; ${th}</code>——中间 50% 样本的跨度超过中位数的 ${th*100}%，单机本地 runner 下该数字不够稳定，不能精确对比。悬停单元格可看原始离散度。`,
    colScenario: '场景',
    colHead: (id) => `${id} P50 / P95 (ms)`,
    scoreLabel: '得分',
    scoreTooltip: '每个场景：最快得 N 分（N = 框架数），最慢得 1 分。总分越高，综合表现越好。',
    chartsHead: '各场景 P50',
    chartCaption: (id) => `${id} — P50`
  }
};

const STYLE = `
  body { font: 14px/1.6 system-ui, -apple-system, sans-serif; max-width: 1000px; margin: 2rem auto; padding: 0 1.5rem; color: #1a1a1a; }
  h1 { margin-bottom: 0.25rem; }
  h2 { margin-top: 2.5rem; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.5rem; }
  .meta { color: #666; font-size: 12px; margin-bottom: 2rem; }
  table.bench { border-collapse: collapse; width: 100%; margin-bottom: 1rem; font-variant-numeric: tabular-nums; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  table.bench th, table.bench td { border: 1px solid #e8ecf0; padding: 10px 14px; text-align: right; }
  table.bench th:first-child, table.bench td:first-child { text-align: left; font-weight: 500; }
  table.bench th { background: #f6f8fa; white-space: nowrap; position: sticky; top: 0; }
  table.bench tbody tr { transition: background 0.1s; }
  table.bench tbody tr:hover { background: #f0f6ff; }
  table.bench tbody tr:nth-child(even) { background: #fafbfc; }
  table.bench tbody tr:nth-child(even):hover { background: #f0f6ff; }
  td.noisy { background: #fff8c5; }
  td.noisy::after { content: ' ⚠'; color: #9a6700; }
  .score-row td { border-top: 2px solid #d0d7de; background: #f6f8fa; }
  .score-help { display: inline-block; width: 18px; height: 18px; line-height: 18px; text-align: center; border-radius: 50%; background: #d0d7de; color: #555; font-size: 12px; cursor: help; vertical-align: middle; position: relative; }
  .score-help:hover::after { content: attr(data-tip); position: absolute; left: 0; bottom: 150%; background: #24292f; color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 13px; line-height: 1.5; width: max-content; max-width: 320px; white-space: normal; z-index: 10; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
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
  const memorySection = summary.memory && Object.keys(summary.memory).length
    ? `<h2>${esc(t.memoryHead)}</h2><p class="legend">${t.memoryLegend(MEMORY_SAMPLES)}</p>${renderMemoryTable(summary, t)}`
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
${memorySection}
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
