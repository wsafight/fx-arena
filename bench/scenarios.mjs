export const FRAMEWORKS = [
  { id: 'react',  app: 'react-list',  port: 5173 },
  { id: 'svelte', app: 'svelte-list', port: 5174 },
  { id: 'imba',   app: 'imba-list',   port: 5175 },
  { id: 'ripple', app: 'ripple-list', port: 5176 }
];

// Each scenario runs inside the page. It sets up state synchronously,
// then measures the tracked operation. performance.now() is captured
// before and after a flushSync-style trigger, then awaits one rAF
// so layout/paint work lands in the delta for like-for-like comparison.
export const SCENARIOS = [
  { id: 'create-1k',        setup: (b) => b.clear(),            run: (b) => b.run(1000) },
  { id: 'create-10k',       setup: (b) => b.clear(),            run: (b) => b.run(10000) },
  { id: 'append-1k',        setup: (b) => b.run(1000),          run: (b) => b.append(1000) },
  { id: 'update-every-10th',setup: (b) => b.run(1000),          run: (b) => b.updateEvery10th() },
  { id: 'select-row',       setup: (b) => b.run(1000),          run: (b) => b.select(500) },
  { id: 'swap-rows',        setup: (b) => b.run(1000),          run: (b) => b.swap() },
  { id: 'remove-row',       setup: (b) => b.run(1000),          run: (b) => b.remove(500) },
  { id: 'clear-10k',        setup: (b) => b.run(10000),         run: (b) => b.clear() }
];

export const SAMPLES = 10;
export const WARMUP = 1;
