import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue({ vapor: true })],
  base: './',
  build: { target: 'es2022', sourcemap: false }
});
