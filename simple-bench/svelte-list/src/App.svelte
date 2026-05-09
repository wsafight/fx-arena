<script>
  import { flushSync } from 'svelte';
  import { buildRows, resetIds } from '../../shared/data.js';

  let rows = $state([]);
  let selected = $state(-1);

  const api = {
    ready: true,
    run(n) { flushSync(() => { resetIds(); selected = -1; rows = buildRows(n); }); },
    append(n) { flushSync(() => { rows = rows.concat(buildRows(n)); }); },
    updateEvery10th() {
      flushSync(() => {
        for (let i = 0; i < rows.length; i += 10) {
          rows[i] = { ...rows[i], label: rows[i].label + ' !!!' };
        }
      });
    },
    select(i) { flushSync(() => { selected = i; }); },
    swap() {
      flushSync(() => {
        if (rows.length < 999) return;
        const a = rows[1]; rows[1] = rows[rows.length - 2]; rows[rows.length - 2] = a;
      });
    },
    remove(i) { flushSync(() => { rows = rows.filter((_, k) => k !== i); }); },
    clear() { flushSync(() => { rows = []; selected = -1; }); },
    count() { return rows.length; }
  };
  window.__simpleBench = api;
</script>

<table>
  <tbody>
    {#each rows as row, i (row.id)}
      <tr class={i === selected ? 'selected' : ''}>
        <td>{row.id}</td><td>{row.label}</td>
      </tr>
    {/each}
  </tbody>
</table>
