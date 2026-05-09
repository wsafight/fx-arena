# Locked versions & ecosystem notes

Phase 1 scope: simple-bench only.

| target | version | notes |
|--------|---------|-------|
| bun | 1.3.13 | workspace root |
| vite | 6.0.7 | three JS-based apps |
| react / react-dom | 19.0.0 | — |
| svelte | 5.16.0 | runes; `@sveltejs/vite-plugin-svelte` 5.0.3 |
| imba | 2.0.0-alpha.229 | own CLI; `imba build --outdir=dist` + html shim |
| ripple | 0.3.52 | `@ripple-ts/vite-plugin` 0.3.52 |

## Ripple 0.3.x integration notes (2026-05-10)

Two gotchas when bootstrapping against `@ripple-ts/vite-plugin@0.3.52`:

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

With both applied, `vite build` succeeds and produces a standard SPA
bundle — no SSR/router plumbing required.
