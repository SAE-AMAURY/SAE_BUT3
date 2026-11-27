import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      'monaco-editor/esm': fileURLToPath(
        new URL('./node_modules/monaco-editor/esm', import.meta.url)
      ),
    },
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/api-docs': 'http://localhost:3000',
    },
  },
});

