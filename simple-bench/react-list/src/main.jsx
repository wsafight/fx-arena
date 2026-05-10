import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { buildRows, resetIds } from '../../shared/data.js';

// No StrictMode: its double-invoke inflates every measurement 2x in
// production builds too. We want the framework's real per-update cost.
// Selection is tracked by row.id, not array index, so mutations that
// shift indices don't force every row to re-evaluate its class.

const apiRef = { current: null };

function App() {
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(-1);
  apiRef.current = { setRows, setSelectedId, getRows: () => rows };

  return (
    <ul>
      {rows.map((row) => (
        <li key={row.id} className={row.id === selectedId ? 'selected' : ''}>
          {row.id} {row.label}
        </li>
      ))}
    </ul>
  );
}

createRoot(document.getElementById('root')).render(<App />);

window.__simpleBench = {
  ready: true,
  run(n) {
    resetIds();
    flushSync(() => { apiRef.current.setSelectedId(-1); apiRef.current.setRows(buildRows(n)); });
  },
  replace(n) {
    flushSync(() => { apiRef.current.setSelectedId(-1); apiRef.current.setRows(buildRows(n)); });
  },
  append(n) {
    flushSync(() => apiRef.current.setRows(r => r.concat(buildRows(n))));
  },
  updateEvery10th() {
    flushSync(() => apiRef.current.setRows(r => {
      const next = r.slice();
      for (let i = 0; i < next.length; i += 10) next[i] = { ...next[i], label: next[i].label + ' !!!' };
      return next;
    }));
  },
  select(i) {
    const r = apiRef.current.getRows();
    const id = r[i]?.id ?? -1;
    flushSync(() => apiRef.current.setSelectedId(id));
  },
  swap() {
    flushSync(() => apiRef.current.setRows(r => {
      if (r.length < 999) return r;
      const next = r.slice();
      const a = next[1]; next[1] = next[next.length - 2]; next[next.length - 2] = a;
      return next;
    }));
  },
  remove(i) {
    flushSync(() => apiRef.current.setRows(r => r.filter((_, k) => k !== i)));
  },
  clear() {
    flushSync(() => { apiRef.current.setRows([]); apiRef.current.setSelectedId(-1); });
  },
  count() { return apiRef.current.getRows().length; }
};
