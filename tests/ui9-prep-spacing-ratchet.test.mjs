import assert from 'node:assert/strict';
import test from 'node:test';
import { STYLE_METRICS, measureStyle } from '../scripts/check-style-ratchet.mjs';

// UI9-PREP (N14): a ratchet on spacing literals. Every px / rem / em length in a padding, margin or gap value that is not
// one of the token steps (0 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96px) counts; tokens (var()) are free, percentages and
// viewport units are layout, and the count may only go down (npm run ratchet:update).
test('spacingOffScale counts padding, margin and gap lengths off the 4px token steps', () => {
  assert.ok(STYLE_METRICS.spacingOffScale);
  const { counts, files } = measureStyle([
    { file: 'src/a.css', text: [
      '.a{padding:12px 20px;margin:0 auto;gap:8px 10px}',
      '.b{margin-top:-1.5rem;padding-inline:var(--page-gutter);row-gap:var(--x, 14px)}',
      '.c{padding:.625rem calc(12px + env(safe-area-inset-bottom));margin-bottom:.5em}',
      '.d{column-gap:2%;margin:1vw;scroll-padding-inline:13px;inset:5px;width:13px}',
      '@media (min-width:1024px){.e{padding-block:var(--sp-2) 1.75rem}}',
    ].join('\n') },
    { file: 'src/B.tsx', text: 'export const B = () => <div style={{ padding: 13 }} />;' },
  ]);
  // .a 20px and 10px; .c .625rem (10px); .e 1.75rem (28px). -1.5rem is 24px, .5em 8px, calc's 12px on the scale.
  assert.equal(counts.spacingOffScale, 4);
  assert.deepEqual(files['src/a.css'].spacingOffScale, 4);
  assert.equal(files['src/B.tsx']?.spacingOffScale, undefined, 'inline styles are not counted');
});
