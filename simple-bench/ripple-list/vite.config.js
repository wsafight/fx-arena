import { defineConfig } from 'vite';
import { ripple } from '@ripple-ts/vite-plugin';

export default defineConfig({
  plugins: [ripple()],
  base: './',
  build: { target: 'es2022', sourcemap: false }
});
