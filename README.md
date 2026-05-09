# fx-arena

Framework comparison harness: React / Svelte 5 / Imba / Ripple.

Phase 1 delivers four `simple-bench` apps, a Playwright-driven runner, and a static HTML report published to GitHub Pages.

## Quick start

```sh
bun install
bunx playwright install chromium
bun run build:simple
bun run bench
bun run report:render
# open site/index.html
```

See `docs/framework-compare-plan.md` for the full design.
