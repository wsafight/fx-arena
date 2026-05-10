# simple-bench protocol

Each app must mount a list UI and expose on `window`:

```ts
window.__simpleBench = {
  ready: boolean,              // true when initial mount done
  run(1000): void,             // create N rows, replacing existing
  replace(1000): void,         // replace current rows with N newly-keyed rows
  append(1000): void,          // append N rows to current
  updateEvery10th(): void,     // update label of every 10th row
  select(rowIndex): void,      // toggle selected style on row index
  swap(): void,                // swap row 2 and row N-2
  remove(rowIndex): void,      // remove row at index
  clear(): void,               // clear all rows
  count(): number,             // current row count
};
```

Scenarios defined in `bench/scenarios.mjs`. Each CPU scenario calls a setup hook, measures `performance.now()` around the operation, then forces style+layout with `getBoundingClientRect()`.

The scenario set intentionally tracks the most portable parts of [krausest/js-framework-benchmark](https://github.com/krausest/js-framework-benchmark):

- CPU: create 1k, replace 1k, update every 10th row, select row, swap rows, remove row, create 10k, append 1k to a 10k table, clear 10k.
- Extra local CPU probes: create 100, append 1k to a 1k table, update every 10th row in a 1k table, clear 1k.
- Memory: ready, run 1k, update 1k five times, replace 1k five times, create/clear 1k five times.

Memory samples use Chromium's `performance.memory.usedJSHeapSize` plus CDP `Memory.getDOMCounters` after forced GC. Startup/Lighthouse metrics from js-framework-benchmark are not in Phase 1 yet; they should be added as a separate suite so CPU and Lighthouse numbers stay clearly separated.

All apps use the same row shape: `{ id: number, label: string }`. Label = adjective + color + noun from deterministic seed.
