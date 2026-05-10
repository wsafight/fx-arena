import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { FRAMEWORKS, SCENARIOS, SAMPLES, WARMUP, MEMORY_SCENARIOS, MEMORY_SAMPLES } from './scenarios.mjs';
import { serveDir } from './static-server.mjs';

const __root = fileURLToPath(new URL('..', import.meta.url));
const RAW_DIR = join(__root, 'metrics', 'raw', 'simple');

async function existsDir(p) { try { const s = await stat(p); return s.isDirectory(); } catch { return false; } }

async function preparePage(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__simpleBench && window.__simpleBench.ready === true, null, { timeout: 15000 });
}

async function forceGc(page, cdp) {
  try { await cdp.send('HeapProfiler.collectGarbage'); } catch {}
  await page.evaluate(() => { if (window.gc) window.gc(); });
}

async function runOne(page, setupFn, runFn) {
  await page.evaluate(async ({ setupSrc, runSrc }) => {
    const b = window.__simpleBench;
    if (!b || !b.ready) throw new Error('__simpleBench not ready');
    // eslint-disable-next-line no-new-func
    await (new Function('b', `return (${setupSrc})(b)`))(b);
    // Settle the DOM from setup work so it doesn't leak into the measurement.
    document.body.getBoundingClientRect();
    if (window.gc) window.gc();
    const t0 = performance.now();
    // `run` may be sync (React/Svelte/Ripple flushSync) or async (Imba's
    // imba.commit returns a Promise resolved when DOM is flushed). Either
    // way we await it so frameworks with a microtask-batched scheduler
    // are measured honestly — not at zero because DOM writes haven't
    // happened yet.
    // eslint-disable-next-line no-new-func
    await (new Function('b', `return (${runSrc})(b)`))(b);
    // Force style + layout into the measurement window. No rAF — that
    // would quantise sub-frame operations to ~16.7 ms frame boundaries.
    document.body.getBoundingClientRect();
    const t1 = performance.now();
    window.__lastSample = t1 - t0;
  }, { setupSrc: setupFn.toString(), runSrc: runFn.toString() });
  return await page.evaluate(() => window.__lastSample);
}

async function snapshotMemory(page, cdp) {
  await forceGc(page, cdp);
  const heap = await page.evaluate(() => {
    const m = performance.memory;
    return m ? {
      usedJSHeapSize: m.usedJSHeapSize,
      totalJSHeapSize: m.totalJSHeapSize,
      jsHeapSizeLimit: m.jsHeapSizeLimit
    } : {
      usedJSHeapSize: null,
      totalJSHeapSize: null,
      jsHeapSizeLimit: null
    };
  });
  let dom = { documents: null, nodes: null, jsEventListeners: null };
  try { dom = await cdp.send('Memory.getDOMCounters'); } catch {}
  return { ...heap, ...dom };
}

async function runMemoryOne(page, cdp, runFn) {
  await page.evaluate(async ({ runSrc }) => {
    const b = window.__simpleBench;
    if (!b || !b.ready) throw new Error('__simpleBench not ready');
    // eslint-disable-next-line no-new-func
    await (new Function('b', `return (${runSrc})(b)`))(b);
    document.body.getBoundingClientRect();
  }, { runSrc: runFn.toString() });
  return await snapshotMemory(page, cdp);
}

async function benchFramework(browser, fw) {
  const dist = join(__root, 'simple-bench', fw.app, 'dist');
  if (!(await existsDir(dist))) {
    console.warn(`[skip] ${fw.id}: no dist at ${dist} (did build fail?)`);
    return null;
  }
  const server = await serveDir(dist, fw.port);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const url = `http://127.0.0.1:${fw.port}/`;
  page.on('pageerror', (e) => console.error(`[${fw.id}] pageerror:`, e.message));

  const out = { framework: fw.id, scenarios: {}, memory: {} };
  try {
    for (const sc of SCENARIOS) {
      await preparePage(page, url);

      const samples = [];
      for (let i = 0; i < WARMUP + SAMPLES; i++) {
        const ms = await runOne(page, sc.setup, sc.run);
        if (i >= WARMUP) samples.push(ms);
      }
      out.scenarios[sc.id] = samples;
      console.log(`[${fw.id}] ${sc.id}: ${samples.map(n => n.toFixed(1)).join(', ')}`);
    }

    for (const sc of MEMORY_SCENARIOS) {
      const samples = [];
      for (let i = 0; i < MEMORY_SAMPLES; i++) {
        await preparePage(page, url);
        samples.push(await runMemoryOne(page, cdp, sc.run));
      }
      out.memory[sc.id] = samples;
      console.log(`[${fw.id}] memory ${sc.id}: ${samples.map(s => {
        const heap = s.usedJSHeapSize == null ? 'heap=n/a' : `heap=${(s.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`;
        return `${heap}, nodes=${s.nodes ?? 'n/a'}`;
      }).join(' | ')}`);
    }
  } finally {
    await ctx.close();
    await new Promise(r => server.close(r));
  }
  return out;
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });
  const browser = await chromium.launch({ args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] });
  try {
    for (const fw of FRAMEWORKS) {
      const result = await benchFramework(browser, fw);
      if (!result) continue;
      await writeFile(join(RAW_DIR, `${fw.id}.json`), JSON.stringify(result, null, 2));
    }
  } finally {
    await browser.close();
  }
  console.log('simple bench done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
