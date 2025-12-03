/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          forest: '#2E7D32',  // 主色：森林绿
          orange: '#FF6B35',  // 辅助色：夕阳橙
          cream: '#FFF8F0',   // 背景色：米白
          dark: '#1A1C19',    // 深色文字
          gray: '#8D938A',    // 次要文字
          light: '#F2EFE9',   // 分割线
        }
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        rounded: ['SF Pro Rounded', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 8px 24px -6px rgba(46, 125, 50, 0.08)',
        'float': '0 12px 36px -6px rgba(46, 125, 50, 0.25)',
      }
    },
  },
  plugins: [],
}