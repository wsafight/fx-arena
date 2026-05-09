<script setup vapor>
import { ref, nextTick, onMounted } from 'vue';
import { buildRows, resetIds } from '../../shared/data.js';

const rows = ref([]);
const selectedId = ref(-1);

window.__simpleBench = {
  ready: false,
  async run(n) { resetIds(); selectedId.value = -1; rows.value = buildRows(n); await nextTick(); },
  async append(n) { rows.value = rows.value.concat(buildRows(n)); await nextTick(); },
  async updateEvery10th() {
    const next = rows.value.slice();
    for (let i = 0; i < next.length; i += 10) next[i] = { ...next[i], label: next[i].label + ' !!!' };
    rows.value = next;
    await nextTick();
  },
  async select(i) { selectedId.value = rows.value[i]?.id ?? -1; await nextTick(); },
  async swap() {
    if (rows.value.length < 999) return;
    const next = rows.value.slice();
    const a = next[1]; next[1] = next[next.length - 2]; next[next.length - 2] = a;
    rows.value = next;
    await nextTick();
  },
  async remove(i) { rows.value = rows.value.filter((_, k) => k !== i); await nextTick(); },
  async clear() { rows.value = []; selectedId.value = -1; await nextTick(); },
  count() { return rows.value.length; }
};

onMounted(() => { window.__simpleBench.ready = true; });
</script>

<template>
  <ul>
    <li v-for="row in rows" :key="row.id" :class="row.id === selectedId ? 'selected' : ''">
      {{ row.id }} {{ row.label }}
    </li>
  </ul>
</template>
