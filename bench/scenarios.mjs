export const FRAMEWORKS = [
  { id: 'react',     app: 'react-list',      port: 5173 },
  { id: 'svelte',    app: 'svelte-list',     port: 5174 },
  { id: 'imba',      app: 'imba-list',       port: 5175 },
  { id: 'ripple',    app: 'ripple-list',     port: 5176 },
  { id: 'vue',       app: 'vue-list',        port: 5177 },
  { id: 'vue-vapor', app: 'vue-vapor-list',  port: 5178 }
];

// Timing model:
//  - setup() runs synchronously; we force a layout flush so the next
//    measurement starts from a settled DOM.
//  - t0 = performance.now(); run() triggers the operation (each app's
//    hook uses its framework's flushSync-equivalent); then a synchronous
//    getBoundingClientRect() forces style+layout into the t1 - t0 window.
//  - Paint is intentionally NOT awaited via rAF: rAF's ~16.7ms frame tick
//    quantises sub-frame operations (select, swap, remove) into useless
//    clusters. We measure JS update + style/layout, which is the honest
//    framework cost. Paint is downstream of the renderer and roughly
//    equal across frameworks for the same DOM shape.
export const SCENARIOS = [
  { id: 'create-100',       setup: (b) => b.clear(),            run: (b) => b.run(100) },
  { id: 'create-1k',        setup: (b) => b.clear(),            run: (b) => b.run(1000) },
  { id: 'create-10k',       setup: (b) => b.clear(),            run: (b) => b.run(10000) },
  { id: 'append-1k',        setup: (b) => b.run(1000),          run: (b) => b.append(1000) },
  { id: 'update-every-10th',setup: (b) => b.run(1000),          run: (b) => b.updateEvery10th() },
  { id: 'select-row',       setup: (b) => b.run(1000),          run: (b) => b.select(500) },
  { id: 'swap-rows',        setup: (b) => b.run(1000),          run: (b) => b.swap() },
  { id: 'remove-row',       setup: (b) => b.run(1000),          run: (b) => b.remove(500) },
  { id: 'clear-1k',         setup: (b) => b.run(1000),          run: (b) => b.clear() },
  { id: 'clear-10k',        setup: (b) => b.run(10000),         run: (b) => b.clear() }
];

export const SAMPLES = 20;
export const WARMUP = 3;
