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
        baylink: {
          bg: '#F7F4EC',
          'bg-alt': '#F7F6F2',
          card: '#FFFFFF',
          section: '#EFE9DE',
          'section-alt': '#EFEDE7',
          border: '#E3DFD6',
          text: '#17202A',
          'text-secondary': '#6B7280',
          muted: '#9A978F',
          green: '#16A66A',
          'green-hover': '#128256',
          'green-deep': '#168A58',
          'green-light': '#EAF6F0',
          'green-soft': '#F3F8F5',
          'chip-active': '#EDF5F0',
          orange: '#FF8A3D',
        },
        brand: {
          forest: '#16A66A',
          orange: '#FF8A3D',
          cream: '#F7F4EC',
          dark: '#17202A',
          gray: '#6B7280',
          light: '#E3DFD6',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Noto Sans SC', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '1.5rem',
        'card-lg': '1.5rem',
      },
      boxShadow: {
        'soft': '0 8px 24px -6px rgba(22, 166, 106, 0.08)',
        'card': '0 2px 16px -4px rgba(23, 32, 42, 0.05)',
        'card-hover': '0 4px 20px -6px rgba(23, 32, 42, 0.07)',
        'search': '0 2px 12px -2px rgba(23, 32, 42, 0.06)',
        'nav': '0 -4px 24px -4px rgba(23, 32, 42, 0.08)',
      }
    },
  },
  plugins: [],
}
