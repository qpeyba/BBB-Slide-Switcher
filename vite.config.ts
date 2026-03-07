import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import path from 'path';

import manifest from './src/manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    minify: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
