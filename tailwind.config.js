import tailwindcssAnimate from 'tailwindcss-animate';

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
          bg: '#F8F9F6',
          'bg-alt': '#F8F9F6',
          card: '#FFFFFF',
          surface: 'rgba(255, 255, 255, 0.88)',
          ink: '#1A2B24',
          section: '#EEF1E8',
          'section-alt': '#F0F3EB',
          border: '#E2E7DF',
          text: '#1C3029',
          'text-secondary': '#66736B',
          muted: '#69756D',
          green: '#176B52',
          'green-hover': '#12523F',
          'green-deep': '#12523F',
          'green-light': '#EAF2E6',
          'green-soft': '#F3F8F5',
          'chip-active': '#EDF5F0',
          orange: '#FF8A3D',
        },
        brand: {
          forest: '#16A66A',
          orange: '#FF8A3D',
          cream: '#F8F9F6',
          dark: '#1C3029',
          gray: '#66736B',
          light: '#E2E7DF',
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
        'rest': '0 1px 2px rgba(23, 32, 42, 0.04), 0 1px 8px rgba(23, 32, 42, 0.03)',
        'elevated': '0 8px 32px rgba(23, 32, 42, 0.08)',
      }
    },
  },
  plugins: [tailwindcssAnimate],
}
