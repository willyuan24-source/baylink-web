/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // 🔴 关键：禁用系统自动暗色模式，防止界面变黑
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB', // 统一主色调
        background: '#F3F4F6', // 统一背景色
      }
    },
  },
  plugins: [],
}