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
    // Настройки для сборки
    build: {
      // 1. Отключаем карты исходников (скрывает .tsx файлы в браузере)
      sourcemap: false, 
      // 2. Отключаем разделение CSS
      cssCodeSplit: false,
      // 3. Увеличиваем лимит размера, чтобы не было предупреждений
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          // 4. Фиксируем имена файлов без хэшей
          entryFileNames: 'assets/index.js',
          chunkFileNames: 'assets/index.js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'assets/index.css';
            }
            return 'assets/[name][extname]';
          },
        },
      },
    },
    server: {
      hmr: true,
      watch: {},
    },
  };
});
