import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
const jsEntry = manifest.main;
const cssEntry = Object.keys(manifest).find(k => k.endsWith('.css'))?.replace(/^\//, '');

const css = cssEntry ? `<link rel="stylesheet" href="./${cssEntry}">` : '';
const html = `<!doctype html><html><head><meta charset="utf-8"><title>imba-list</title>${css}</head><body><script type="module" src="./${jsEntry}"></script></body></html>`;
writeFileSync(join(dist, 'index.html'), html);
