import { track, flushSync } from 'ripple';
import { buildRows, resetIds } from '../../shared/data.js';

type Row = { id: number; label: string };

export component App() {
  let &[rows] = track<Row[]>([]);
  let &[selectedId] = track(-1);

  const api = {
    ready: true,
    run(n: number) { flushSync(() => { resetIds(); selectedId = -1; rows = buildRows(n); }); },
    append(n: number) { flushSync(() => { rows = rows.concat(buildRows(n)); }); },
    updateEvery10th() {
      flushSync(() => {
        const next = rows.slice();
        for (let i = 0; i < next.length; i += 10) next[i] = { ...next[i], label: next[i].label + ' !!!' };
        rows = next;
      });
    },
    select(i: number) { flushSync(() => { selectedId = rows[i]?.id ?? -1; }); },
    swap() {
      flushSync(() => {
        if (rows.length < 999) return;
        const next = rows.slice();
        const a = next[1]; next[1] = next[next.length - 2]; next[next.length - 2] = a;
        rows = next;
      });
    },
    remove(i: number) { flushSync(() => { rows = rows.filter((_, k) => k !== i); }); },
    clear() { flushSync(() => { rows = []; selectedId = -1; }); },
    count() { return rows.length; }
  };
  (globalThis as any).__simpleBench = api;

  <ul>
    for (const row of rows; key row.id) {
      <li class={row.id === selectedId ? 'selected' : ''}>
        {row.id} {row.label}
      </li>
    }
  </ul>
}
