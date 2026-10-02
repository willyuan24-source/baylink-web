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
    // W9-E (review 2026-10-01 R§5 #2): Vite 7's default ('baseline-widely-available': safari16) plus Safari / iOS 15, so
    // esbuild lowers any syntax an iPhone on iOS 15 (6s, 7, SE 1) or 16.0–16.3 cannot parse; a regex look-behind cannot be
    // lowered (tests/opus-bay-w9-e-lookbehind.test.ts bans it in src/**, scripts/opus-sf/qa/dist-syntax.mjs scans dist/)
    target: ['chrome107', 'edge107', 'firefox104', 'safari15', 'ios15'],
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
