import tailwindcssAnimate from 'tailwindcss-animate';

// TOKENS-B (RC-9, SV-07): every colour reads a channel token from src/tokens.css, so the utilities follow the one palette
// and keep their /NN opacity modifiers (`border-baylink-border/60` → rgb(var(--color-line-rgb) / 0.6)); a bare
// var(--color-…) would make Tailwind drop every modifier. tests/tailwind-tokens.test.ts compiles them. The legacy names
// keep working and map to the nearest token (the hex each one used to hold is noted).
const token = name => `rgb(var(--color-${name}-rgb) / <alpha-value>)`;

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
          bg: token('surface-2'),             // #F8F9F6 cream
          'bg-alt': token('surface-2'),       // #F8F9F6
          card: token('surface'),             // #FFFFFF
          surface: token('surface'),          // rgba(255,255,255,.88): write bg-baylink-surface/90 for a translucent bar
          ink: token('ink'),                  // #1A2B24
          section: token('surface-2'),        // #EEF1E8 olive cream
          'section-alt': token('surface-2'),  // #F0F3EB
          border: token('line'),              // #E2E7DF
          text: token('ink'),                 // #1C3029
          'text-secondary': token('ink-3'),   // #66736B: 4.0–4.4:1 on the section tints (READ-02); ink-3 ≥5.19:1 on every surface
          muted: token('ink-3'),              // #69756D: same
          green: token('brand'),              // #176B52
          'green-hover': token('brand-hover'),// #12523F
          'green-deep': token('brand-hover'), // #12523F (the same value as hover)
          'green-light': token('brand-tint'), // #EAF2E6
          'green-soft': token('surface-2'),   // #F3F8F5
          'chip-active': token('selected'),   // #EDF5F0
          orange: token('warm'),              // #FF8A3D (unused; the palette's offer accent is --color-warm)
        },
        // Unused legacy group, kept so a stray class still resolves to the palette.
        brand: {
          forest: token('brand'),
          orange: token('warm'),
          cream: token('surface-2'),
          dark: token('ink'),
          gray: token('ink-3'),
          light: token('line'),
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
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
