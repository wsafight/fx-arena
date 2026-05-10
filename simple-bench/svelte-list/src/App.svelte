<script>
  import { flushSync } from 'svelte';
  import { buildRows, resetIds } from '../../shared/data.js';

  // Selection by id, not index — avoids rows re-evaluating `i === selected`
  // when their index shifts (remove/swap) and lets Svelte's keyed each
  // block touch exactly one old + one new row on select().
  let rows = $state([]);
  let selectedId = $state(-1);

  const api = {
    ready: true,
    run(n) { flushSync(() => { resetIds(); selectedId = -1; rows = buildRows(n); }); },
    replace(n) { flushSync(() => { selectedId = -1; rows = buildRows(n); }); },
    append(n) { flushSync(() => { rows = rows.concat(buildRows(n)); }); },
    updateEvery10th() {
      flushSync(() => {
        const next = rows.slice();
        for (let i = 0; i < next.length; i += 10) next[i] = { ...next[i], label: next[i].label + ' !!!' };
        rows = next;
      });
    },
    select(i) { flushSync(() => { selectedId = rows[i]?.id ?? -1; }); },
    swap() {
      flushSync(() => {
        if (rows.length < 999) return;
        const next = rows.slice();
        const a = next[1]; next[1] = next[next.length - 2]; next[next.length - 2] = a;
        rows = next;
      });
    },
    remove(i) { flushSync(() => { rows = rows.filter((_, k) => k !== i); }); },
    clear() { flushSync(() => { rows = []; selectedId = -1; }); },
    count() { return rows.length; }
  };
  window.__simpleBench = api;
</script>

<ul>
  {#each rows as row (row.id)}
    <li class={row.id === selectedId ? 'selected' : ''}>
      {row.id} {row.label}
    </li>
  {/each}
</ul>
