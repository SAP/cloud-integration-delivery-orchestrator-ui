import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

// https://vitejs.dev/config/
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd());
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
          target: env.VITE_BE_URL,
          changeOrigin: true, // changes the origin of the host header to the target URL
          secure: false,
          // ws: true,
          // rewrite: (path) => path.replace(/^\/api/, '')
        },
        '^/user/.*': {
          target: env.VITE_TARGET_URL,
          rewrite: (path) => path.replace(/^\/user/, ''),
          secure: false,
          changeOrigin: true,
        },
        '^/cpi-cookie-service/.*': {
          target: env.VITE_CPI_COOKIE_SERVICE_URL,
          rewrite: (path) => path.replace(/^\/cpi-cookie-service/, ''),
          secure: false,
          changeOrigin: true,
        }
      },
      port: parseInt(env.VITE_PORT),
      host: true,
      cors: true
    }
  }
})
