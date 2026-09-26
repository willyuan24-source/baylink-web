// Dev-only config for the opus-bay worktree: separate optimizer cache and port so it never
// collides with a dev server running from the main checkout (they share node_modules).
// The published city data (public/opus-bay/sf/**, ~200 files per version) is never watched.
import { mergeConfig } from 'vite'
import base from './vite.config'

export default mergeConfig(base, { cacheDir: '.vite-opus', server: { port: 5174, strictPort: true, watch: { ignored: ['**/public/opus-bay/sf/**'] } } })
