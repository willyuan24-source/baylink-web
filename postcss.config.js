import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
// 简洁显示: relative font sizes below 1rem gain a max(…, var(--text-floor)) that only html[data-simple] raises (src/tokens.css)
import textFloor from './scripts/postcss-text-floor.mjs'

export default {
  plugins: [tailwindcss(), autoprefixer(), textFloor()],
}
