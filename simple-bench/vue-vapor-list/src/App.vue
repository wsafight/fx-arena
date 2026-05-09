<script setup>
const props = defineProps(['rows', 'selectedId']);
</script>

<template>
  <table><tbody>
    <tr v-for="row in rows" :key="row.id" :class="row.id === selectedId ? 'selected' : ''">
      <td>{{ row.id }}</td><td>{{ row.label }}</td>
    </tr>
  </tbody></table>
</template>
