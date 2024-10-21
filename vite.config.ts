import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import {port, beUrl, targetUrl } from './src/service/consts'

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    base: '/',
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
          changeOrigin: true, // changes the origin of the host header to the target URL
          secure: false,
          // ws: true,
          // rewrite: (path) => path.replace(/^\/api/, '')
        },
        '^/user/.*': {
          target: targetUrl,
          rewrite: (path) => path.replace(/^\/user/, ''),
          secure: false,
          changeOrigin: true,
        }
      },
      port: port,
      host: true,
      cors: true
    }
  }
})
