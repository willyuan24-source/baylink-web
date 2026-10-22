import tailwindcssAnimate from 'tailwindcss-animate';

// TOKENS-B (RC-9, SV-07): every colour reads a channel token from src/tokens.css, so the utilities follow the one palette
// and keep their /NN opacity modifiers (`border-baylink-border/60` → rgb(var(--color-line-rgb) / 0.6)); a bare
// var(--color-…) would make Tailwind drop every modifier. tests/tailwind-tokens.test.ts compiles them. The legacy names
// keep working and map to the nearest token (the hex each one used to hold is noted).
const token = name => `rgb(var(--color-${name}-rgb) / <alpha-value>)`;

// UI9-R1 (N10 / N11 / N24): the shape, depth and motion scales are the tokens too, so a Tailwind class cannot add a radius,
// shadow, duration or easing the site does not have. These replace Tailwind's defaults (theme, not extend): every
// rounded-*, shadow-*, duration-* and ease-* resolves to a --r-* / --e* / --dur-* / --ease-* token from src/tokens.css
// (rounded-lg 8 and rounded-xl 12 → --r-md 10; rounded / rounded-md → --r-sm 6; rounded-2xl → --r-lg 16; rounded-3xl and
// rounded-card → --r-xl 24; small shadows → --e1, large ones → --e2; durations → the five steps, which reduced motion and
// 简洁显示 set to 0). tests/ui9-r1-foundation.test.ts compiles them.
const radius = { none: '0', sm: 'var(--r-sm)', DEFAULT: 'var(--r-sm)', md: 'var(--r-sm)', lg: 'var(--r-md)', xl: 'var(--r-md)', '2xl': 'var(--r-lg)', '3xl': 'var(--r-xl)', full: 'var(--r-pill)', card: 'var(--r-xl)', 'card-lg': 'var(--r-xl)' };
const shadow = { none: 'none', sm: 'var(--e1)', DEFAULT: 'var(--e1)', md: 'var(--e1)', lg: 'var(--e2)', xl: 'var(--e2)', '2xl': 'var(--e2)', soft: 'var(--e1)', card: 'var(--e1)', 'card-hover': 'var(--e2)', search: 'var(--e1)', nav: 'var(--e1)', rest: 'var(--e1)', elevated: 'var(--e2)' };
const duration = { 0: '0ms', DEFAULT: 'var(--dur-2)', 75: 'var(--dur-1)', 100: 'var(--dur-1)', 150: 'var(--dur-2)', 200: 'var(--dur-3)', 300: 'var(--dur-5)' };
const easing = { DEFAULT: 'var(--ease-std)', linear: 'linear', in: 'var(--ease-in)', out: 'var(--ease-out)', 'in-out': 'var(--ease-std)' };

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // N23: hover: utilities only where a pointer can hover — wrapped in @media (hover:hover) and (pointer:fine), like the
  // site's own hover rules, so a tap on a phone never leaves a card lifted or a button darkened.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    borderRadius: radius,
    boxShadow: shadow,
    transitionDuration: duration,
    transitionTimingFunction: easing,
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
    },
  },
  plugins: [tailwindcssAnimate],
}
