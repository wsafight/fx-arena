import { defineConfig } from 'vite';
import { ripple } from '@ripple-ts/vite-plugin';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [ripple()],
  base: './',
  build: { target: 'es2022', sourcemap: false },
  resolve: {
    alias: [
      {
        find: /^@tsrx\/core$/,
        replacement: fileURLToPath(new URL('./tsrx-core-shim.js', import.meta.url))
      }
    ]
  }
});
