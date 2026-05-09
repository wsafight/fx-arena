# simple-bench protocol

Each app must mount a list UI and expose on `window`:

```ts
window.__simpleBench = {
  ready: boolean,              // true when initial mount done
  run(1000): void,             // create N rows, replacing existing
  append(1000): void,          // append N rows to current
  updateEvery10th(): void,     // update label of every 10th row
  select(rowIndex): void,      // toggle selected style on row index
  swap(): void,                // swap row 2 and row N-2
  remove(rowIndex): void,      // remove row at index
  clear(): void,               // clear all rows
  count(): number,             // current row count
};
```

Scenarios defined in `bench/scenarios.mjs`. Each scenario calls a sequence of hooks and measures `performance.now()` around a synchronous trigger, waiting one rAF for paint via `requestAnimationFrame`.

All apps use the same row shape: `{ id: number, label: string }`. Label = adjective + color + noun from deterministic seed.
