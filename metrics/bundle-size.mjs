import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { FRAMEWORKS } from '../bench/scenarios.mjs';

const __root = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(__root, 'metrics', 'bundle-size.json');

async function walk(dir, acc = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full, acc);
    else if (/\.(js|mjs|css)$/.test(e.name)) acc.push(full);
  }
  return acc;
}

async function measureDir(dist) {
  const files = await walk(dist);
  let raw = 0, gz = 0;
  const perFile = [];
  for (const f of files) {
    const buf = await readFile(f);
    const g = gzipSync(buf, { level: 9 }).length;
    raw += buf.length;
    gz += g;
    perFile.push({ path: relative(dist, f), raw: buf.length, gz: g });
  }
  return { raw, gz, files: perFile };
}

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

async function main() {
  const simple = {};
  for (const fw of FRAMEWORKS) {
    const dist = join(__root, 'simple-bench', fw.app, 'dist');
    if (!(await exists(dist))) { console.warn(`[skip bundle] ${fw.id}: no dist`); continue; }
    simple[fw.id] = await measureDir(dist);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    simple
  };
  await mkdir(join(__root, 'metrics'), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2));
  console.log('wrote', OUT);
  for (const [k, v] of Object.entries(simple)) {
    console.log(`  ${k}: ${(v.raw/1024).toFixed(1)} KB raw, ${(v.gz/1024).toFixed(1)} KB gzip`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
