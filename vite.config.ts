import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import {port, beUrl } from './src/service/consts'

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    plugins: [vue(), vueJsx()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      proxy: {
        '^/api/v1/.*': {
          target: beUrl,
          // rewrite: (path) => path.replace(/^\/api/, '')
        }
      },
      port: port,
      host: true
    }
  }
})
