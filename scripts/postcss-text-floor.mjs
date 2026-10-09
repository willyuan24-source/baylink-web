// PostCSS plugin: the 简洁显示 text floor (html[data-simple], design.md §4.16, 1007 §5.4).
//
// Simple mode promises that every visible line of text is at least 16px. One global rule cannot say "the declared size,
// but never below 16px", so at build time each relative font-size below 1rem / 1em / 100% (site CSS and Tailwind's
// output alike, `text-xs` and `text-[0.6875rem]` included) becomes
//
//   max(<declared size>, var(--text-floor, 0px))
//
// and each rem line-height below 1.375rem keeps its lines apart at the floor with max(<declared>, calc(var(--text-floor,
// 0px) * 1.375)). --text-floor is 0px unless html[data-simple] sets it to 1rem (src/tokens.css), so at the standard size
// the computed values are exactly the declared ones. px sizes are left alone on purpose: after the px → rem codemod the
// only px text left is the Opus Bay / Little Bay HUD geometry, which keeps its own size in every mode; their stylesheets
// (src/opus-bay/**, any little-bay path) are skipped entirely, so the game's built CSS is byte-for-byte unchanged (D26).
const SIZE = /^(-?(?:\d+\.?\d*|\.\d+))(rem|em|%)$/;
const FLOOR = 'var(--text-floor, 0px)';
const LINE_FLOOR = `calc(${FLOOR} * 1.375)`;

const belowBase = (number, unit) => unit === '%' ? number < 100 : number < 1;

/** The floored form of one font-size value, or null when it needs none. */
export function floorFontSize(value) {
  const match = SIZE.exec(value.trim());
  if (!match || !belowBase(Number(match[1]), match[2])) return null;
  return `max(${value.trim()}, ${FLOOR})`;
}

/** The floored form of one line-height value, or null when it needs none (unitless and em heights follow the font). */
export function floorLineHeight(value) {
  const match = /^(\d+\.?\d*|\.\d+)rem$/.exec(value.trim());
  if (!match || Number(match[1]) >= 1.375) return null;
  return `max(${value.trim()}, ${LINE_FLOOR})`;
}

/** `font: 600 .75rem/1.4 sans-serif` → the size term floored; the rest of the shorthand is kept as written. */
export function floorFontShorthand(value) {
  if (value.includes('--text-floor')) return null;
  const match = /(^|\s)(-?(?:\d+\.?\d*|\.\d+)(?:rem|em|%))(?=\s|\/|$)/.exec(value);
  if (!match) return null;
  const floored = floorFontSize(match[2]);
  if (!floored) return null;
  return value.slice(0, match.index + match[1].length) + floored + value.slice(match.index + match[0].length);
}

export default function textFloor() {
  return {
    postcssPlugin: 'baylink-text-floor',
    Once(root, { result }) {
      const file = (root.source?.input.file || result.opts.from || '').split('\\').join('/');
      root.__baylinkSkipTextFloor = /\/src\/opus-bay\/|little-bay/i.test(file);
    },
    Declaration(declaration) {
      if (declaration.root().__baylinkSkipTextFloor || declaration.value.includes('--text-floor')) return;
      const next = declaration.prop === 'font-size' ? floorFontSize(declaration.value)
        : declaration.prop === 'line-height' ? floorLineHeight(declaration.value)
          : declaration.prop === 'font' ? floorFontShorthand(declaration.value)
            : null;
      if (next) declaration.value = next;
    },
  };
}
textFloor.postcss = true;
