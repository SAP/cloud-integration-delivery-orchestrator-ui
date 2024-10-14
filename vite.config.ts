import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '^/api/v1/.*': {
        target: process.env.BE_URL || 'http://localhost:8080'
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    },
    port: Number(process.env.PORT) || 5173
  }
})
