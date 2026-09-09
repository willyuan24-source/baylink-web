import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // This app synchronizes URL, session and request state in effects and does not
      // use React Compiler. Retain the other hooks checks (including hook order,
      // dependency arrays, mutation and render purity); loading-state effects are allowed.
      'react-hooks/set-state-in-effect': 'off',
      // The existing untyped API response boundary is being migrated incrementally.
      // Keep explicit-any visible as debt instead of forcing unsafe casts for a green build.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Mixed component/helper exports trigger full-module HMR, not a production bug.
      // Keep the development feedback while allowing these established public modules.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['tests/**/*.{ts,tsx,mjs}', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
])
