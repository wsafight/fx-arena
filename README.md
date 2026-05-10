# fx-arena

Framework comparison harness: React / Svelte 5 / Imba / Ripple.

Phase 1 delivers keyed `simple-bench` apps, a Playwright-driven local runner, memory probes, bundle-size metrics, and a static HTML report published from `docs/`.

## Quick start

```sh
bun install
bunx playwright install chromium
bun run report:local
# open docs/index.html
```

## Deploy

Rebuild, rerun the benchmark, and render the GitHub Pages files:

```sh
bun run deploy
```

Commit and push the updated `docs/` files. In GitHub Pages settings, use `Deploy from a branch` with `main` / `docs`.

See `docs/framework-compare-plan.md` for the full design.
