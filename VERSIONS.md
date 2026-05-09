# Locked versions & ecosystem notes

Phase 1 scope: simple-bench only.

| target | version | notes |
|--------|---------|-------|
| bun | 1.3.13 | workspace root |
| vite | 8.0.11 | three JS-based apps |
| react / react-dom | 19.2.6 | `@vitejs/plugin-react` 6.0.1 |
| svelte | 5.55.5 | runes; `@sveltejs/vite-plugin-svelte` 7.1.2 |
| imba | 2.0.0-alpha.247 | own CLI; `imba build --outdir=dist` + html shim |
| ripple | 0.3.52 | `@ripple-ts/vite-plugin` 0.3.52 (works on vite 8) |

## Ripple 0.3.x integration notes (2026-05-10)

Three gotchas when bootstrapping against `@ripple-ts/vite-plugin@0.3.52`:

1. **Plugin export**: `import ripple from '@ripple-ts/vite-plugin'` fails to
   load (the source has duplicated `export default compat` statements that
   get dropped by the loader Vite uses to bundle configs). Use the named
   export instead: `import { ripple } from '@ripple-ts/vite-plugin'`.
2. **File extension**: Ripple 0.3.x renamed the component extension from
   `.ripple` to `.tsrx`. The Vite plugin only matches `.tsrx` (see
   `RIPPLE_EXTENSION_PATTERN` in its source). Component body uses
   `let &[name] = track(init)` lazy-destructured tracks (read/write as
   `name`), JSX-style elements, and `for (const x of xs; index i; key x.id)`
   loops.
3. **Bundle bloat from @tsrx/core barrel**: default production build
   includes ~450KB of compiler (acorn + `@sveltejs/acorn-typescript` +
   `@tsrx/core` plugin/parser) because Ripple's client runtime imports 7
   small utility functions from the `@tsrx/core` barrel, and that barrel
   re-exports from a parse entry with side-effectful top-level imports
   (`import * as acorn from 'acorn'`) which Rollup can't tree-shake.
   Worked around by aliasing `@tsrx/core` to a local shim
   (`tsrx-core-shim.js` + vendored `tsrx-events.js`, `tsrx-css.js`) that
   re-exports only the 7 symbols the runtime needs. Result: bundle drops
   from 283KB / 80KB gzip → 22KB / 9KB gzip. Revisit when upstream
   splits the barrel or marks it `sideEffects: false`.

With all three applied, `vite build` succeeds and produces a standard
SPA bundle comparable in size to Svelte/Imba.
