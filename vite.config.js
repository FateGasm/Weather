import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {

  const { OPENWEATHER_API_KEY } = loadEnv(mode, process.cwd(), '')

  // /owm/* -> api.openweathermap.org/* with appid appended.
  const proxy = {
    '/owm': {
      target: 'https://api.openweathermap.org',
      changeOrigin: true,
      rewrite: (path) =>
        path.replace(/^\/owm/, '') +
        (path.includes('?') ? '&' : '?') +
        `appid=${OPENWEATHER_API_KEY}`,
    },
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { proxy },
    preview: { proxy },
    test: { environment: 'jsdom', restoreMocks: true, unstubGlobals: true },
  }
})
