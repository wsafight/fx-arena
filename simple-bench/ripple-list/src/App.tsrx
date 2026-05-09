import { track, flushSync } from 'ripple';
import { buildRows, resetIds } from '../../shared/data.js';

type Row = { id: number; label: string };

export component App() {
  let &[rows] = track<Row[]>([]);
  let &[selected] = track(-1);

  const api = {
    ready: true,
    run(n: number) { flushSync(() => { resetIds(); selected = -1; rows = buildRows(n); }); },
    append(n: number) { flushSync(() => { rows = rows.concat(buildRows(n)); }); },
    updateEvery10th() {
      flushSync(() => {
        const next = rows.slice();
        for (let i = 0; i < next.length; i += 10) next[i] = { ...next[i], label: next[i].label + ' !!!' };
        rows = next;
      });
    },
    select(i: number) { flushSync(() => { selected = i; }); },
    swap() {
      flushSync(() => {
        if (rows.length < 999) return;
        const next = rows.slice();
        const a = next[1]; next[1] = next[next.length - 2]; next[next.length - 2] = a;
        rows = next;
      });
    },
    remove(i: number) { flushSync(() => { rows = rows.filter((_, k) => k !== i); }); },
    clear() { flushSync(() => { rows = []; selected = -1; }); },
    count() { return rows.length; }
  };
  (globalThis as any).__simpleBench = api;

  <table>
    <tbody>
      for (const row of rows; index i; key row.id) {
        <tr class={i === selected ? 'selected' : ''}>
          <td>{row.id}</td>
          <td>{row.label}</td>
        </tr>
      }
    </tbody>
  </table>
}
