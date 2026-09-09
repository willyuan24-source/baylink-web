import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: { jsxImportSource: '@baylink/locale' },
  resolve: { alias: { '@baylink/locale': fileURLToPath(new URL('./src/i18n', import.meta.url)) } },
  optimizeDeps: { exclude: ['@baylink/locale/jsx-runtime', '@baylink/locale/jsx-dev-runtime'] },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React 运行时单独成 chunk：内容极少变化，跨发布可长期缓存
          if (/node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) {
            return 'react-vendor'
          }
        },
      },
    },
  },
})
