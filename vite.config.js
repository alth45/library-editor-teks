import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Konfigurasi Vite untuk RichEdit.
 * - Mode dev   : `npm run dev` — menjalankan demo (demo/index.html) dengan HMR.
 * - Mode build : `npm run build` — mem-bundle library dari src/index.js ke dist/
 *                (ESM + IIFE, tanpa minifikasi agar tetap dapat dibaca).
 */
export default defineConfig(({ command }) => ({
  // Saat dev, sajikan folder demo; saat build, bundle library dari root proyek.
  root: command === 'serve' ? resolve(root, 'demo') : root,
  base: './',
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: resolve(root, 'src/index.js'),
      name: 'RichEdit',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'es' ? 'richedit.js' : 'richedit.iife.js')
    },
    rollupOptions: {
      output: {
        assetFileNames: (info) =>
          info.name === 'style.css' ? 'richedit.[ext]' : '[name].[ext]'
      }
    }
  }
}));
