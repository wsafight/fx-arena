const ADJECTIVES = ['pretty', 'large', 'big', 'small', 'tall', 'short', 'long', 'handsome', 'plain', 'quaint', 'clean', 'elegant', 'easy', 'angry', 'crazy', 'helpful', 'mushy', 'odd', 'unsightly', 'adorable', 'important', 'inexpensive', 'cheap', 'expensive', 'fancy'];
const COLORS = ['red', 'yellow', 'blue', 'green', 'pink', 'brown', 'purple', 'brown', 'white', 'black', 'orange'];
const NOUNS = ['table', 'chair', 'house', 'bbq', 'desk', 'car', 'pony', 'cookie', 'sandwich', 'burger', 'pizza', 'mouse', 'keyboard'];

let idCounter = 1;

function buildLabel(seed) {
  const a = ADJECTIVES[seed % ADJECTIVES.length];
  const c = COLORS[(seed >> 3) % COLORS.length];
  const n = NOUNS[(seed >> 6) % NOUNS.length];
  return `${a} ${c} ${n}`;
}

export function buildRows(count) {
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    const id = idCounter++;
    out[i] = { id, label: buildLabel(id) };
  }
  return out;
}

export function resetIds() {
  idCounter = 1;
}
