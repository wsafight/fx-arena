import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { buildRows, resetIds } from '../../shared/data.js';

function App() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(-1);

  const api = {
    ready: true,
    run(n) { resetIds(); flushSync(() => { setSelected(-1); setRows(buildRows(n)); }); },
    append(n) { flushSync(() => setRows(r => r.concat(buildRows(n)))); },
    updateEvery10th() {
      flushSync(() => setRows(r => {
        const next = r.slice();
        for (let i = 0; i < next.length; i += 10) next[i] = { ...next[i], label: next[i].label + ' !!!' };
        return next;
      }));
    },
    select(i) { flushSync(() => setSelected(i)); },
    swap() {
      flushSync(() => setRows(r => {
        if (r.length < 999) return r;
        const next = r.slice();
        const a = next[1]; next[1] = next[next.length - 2]; next[next.length - 2] = a;
        return next;
      }));
    },
    remove(i) { flushSync(() => setRows(r => r.filter((_, k) => k !== i))); },
    clear() { flushSync(() => { setRows([]); setSelected(-1); }); },
    count() { return rows.length; }
  };
  window.__simpleBench = api;

  return (
    <table><tbody>
      {rows.map((row, i) => (
        <tr key={row.id} className={i === selected ? 'selected' : ''}>
          <td>{row.id}</td><td>{row.label}</td>
        </tr>
      ))}
    </tbody></table>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
