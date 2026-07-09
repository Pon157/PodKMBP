import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    // --- Добавляем секцию build ---
    build: {
      cssCodeSplit: false, // Запрещаем разделять CSS на разные файлы
      rollupOptions: {
        output: {
          // Все JS-файлы из node_modules и компоненты пойдут в один index.js
          manualChunks: undefined, 
          entryFileNames: 'assets/index.js',
          chunkFileNames: 'assets/index.js',
          assetFileNames: 'assets/index.[ext]',
        },
      },
    },
  };
});
