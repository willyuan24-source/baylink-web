import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { BASELINE_FILE, baselineFrom, compareWithBaseline, measureRepository, measureStyle, readBaseline, updateBaseline } from '../scripts/check-style-ratchet.mjs';

const measured = sources => ({ style: measureStyle(sources), englishUi: { count: 0, strings: [], occurrences: [] }, lazyCss: { files: [], duplicates: [] } });

test('style counts cover CSS declarations, Tailwind classes, inline styles and the ↗ icon', () => {
  const { counts } = measureStyle([
    { file: 'src/a.css', text: '.a{color:#FFF;background:#123456;font-size:12px;border-radius:8px;box-shadow:0 1px 2px #000;font-weight:650}\n.b{font:600 14px/1.4 serif;border-top-left-radius:8px;font-weight:700}' },
    { file: 'src/tokens.css', text: ':root{--color-brand:#096b54;font-size:16px}' },
    { file: 'src/B.tsx', text: "import { ArrowUpRight } from 'lucide-react';\nexport const B = () => <a className=\"text-[11px] text-[0.8125rem] rounded-2xl shadow-lg font-medium text-baylink-muted hover:bg-baylink-green/10\" style={{ fontSize: 10, fontWeight: 500, color: '#abc' }}><ArrowUpRight /></a>;" },
  ]);
  assert.deepEqual(counts, {
    hexOccurrences: 4, hexDistinct: 4, fontSizePx: 4, fontSizePxUnder13: 2, fontSizeUnder13: 2, radiusKinds: 2, shadowKinds: 2,
    fontWeightOutsideSet: 3, textArbitraryUnder13: 1, baylinkClasses: 2, arrowUpRight: 1, buttonLooks: 0,
    fontSizeOffLadder: 2, fontSizeLiteral: 3, fontWeightBold: 1, durationOffScale: 0, durationLiteral: 0, spacingOffScale: 0,
  });
});

test('UI9-F: sizes off the ladder, raw sizes, weights above 600 and durations off the motion scale are counted', () => {
  const { counts } = measureStyle([
    { file: 'src/a.css', text: [
      '.a{font-size:.9375rem}.b{font-size:.875rem}.c{font-size:1.375rem!important}.d{font-size:var(--fs-meta)}.e{font-size:clamp(1rem,2vw,1.5rem)}',
      '.f{font-weight:bold}.g{font-weight:600}.h{font:800 1rem/1.4 serif}',
      '.i{transition:color .15s,background .2s .3s}.j{transition:transform var(--dur-2) var(--ease-out)}.k{animation:spin 1s linear infinite}',
      '@media (prefers-reduced-motion:reduce){*{transition-duration:.01ms!important}}',
    ].join('\n') },
    { file: 'src/tokens.css', text: ':root{--fs-meta:.875rem}.x{font-size:.875rem}' },
  ]);
  assert.equal(counts.fontSizeOffLadder, 2, '.9375rem (15px) and 1.375rem (22px); .875rem is 14px');
  assert.equal(counts.fontSizeLiteral, 5, 'a, b, c, e (clamp of lengths) and the font shorthand; tokens.css and var() are free');
  assert.equal(counts.fontWeightBold, 2, 'bold and 800');
  assert.equal(counts.durationLiteral, 3, '.15s, .2s (its .3s is a delay) and the 1s loop; .01ms resets and tokens are free');
  assert.equal(counts.durationOffScale, 1, '.15s; .2s is on the scale and 1s is a loop');
});

test('H29: button looks are counted once per fill, text and border, without hover, pressed or disabled states', () => {
  const { counts, kinds } = measureStyle([
    { file: 'src/a.css', text: [
      '.ui-button[data-variant=primary]{background:var(--color-brand);color:var(--color-surface)}',
      '.ui-button[data-variant=primary]:hover{background:var(--color-brand-hover)}',
      '.outing-primary{background:var(--color-brand);color:var(--color-surface)}',
      '.x .share-buttons button{background:var(--color-surface);color:var(--color-ink);border:1px solid var(--color-line-strong)}',
      '.x .share-buttons button[aria-pressed=true]{background:var(--color-ink)}',
      '.quiet-btn{background:transparent;color:var(--color-brand)}',
      '.card{background:var(--color-surface)}',
      'button:disabled{background:var(--color-surface-2)}',
    ].join('\n') },
  ]);
  assert.equal(counts.buttonLooks, 2, [...kinds.button.keys()].join(' / '));
});

test('rem and em font sizes below 13px are counted once the site is in rem', () => {
  const { counts } = measureStyle([
    { file: 'src/a.css', text: '.a{font-size:.6875rem}.b{font-size:.8125rem}.c{font:600 .75em/1.4 serif}.d{font-size:clamp(.75rem,2vw,1rem)}.e{font-size:var(--text-caption)}' },
    { file: 'src/B.tsx', text: "export const B = () => <span style={{ fontSize: '0.7rem' }} />;" },
  ]);
  assert.equal(counts.fontSizePx, 0);
  assert.equal(counts.fontSizePxUnder13, 0);
  assert.equal(counts.fontSizeUnder13, 4, '.6875rem, .75em, clamp(.75rem…) and inline 0.7rem; .8125rem is 13px');
  const baseline = baselineFrom(measured([{ file: 'src/a.css', text: '.a{font-size:var(--text-caption)}' }]));
  const problems = compareWithBaseline(measured([{ file: 'src/a.css', text: '.a{font-size:.6875rem}' }]), baseline);
  assert.match(problems.join('\n'), /fontSizeUnder13 rose from 0 to 1[^]*src\/a\.css: 0 → 1/);
});

test('a deliberately added hex colour fails the ratchet and names its location', () => {
  const before = [{ file: 'src/a.css', text: '.a{color:var(--color-ink)}' }];
  const baseline = baselineFrom(measured(before));
  const after = [{ file: 'src/a.css', text: '.a{color:var(--color-ink)}\n.b{background:#C0FFEE}' }];
  const problems = compareWithBaseline(measured(after), baseline);
  assert.equal(problems.length, 2);
  assert.match(problems.find(problem => problem.startsWith('hexOccurrences')), /src\/a\.css: 0 → 1/);
  assert.match(problems.find(problem => problem.startsWith('hexDistinct')), /new hex value #c0ffee at src\/a\.css:2/);
});

test('equal or lower counts hold; tokens.css may define colours', () => {
  const baseline = baselineFrom(measured([{ file: 'src/a.css', text: '.a{color:#111;font-size:12px}' }]));
  assert.deepEqual(compareWithBaseline(measured([{ file: 'src/a.css', text: '.a{color:var(--color-ink);font-size:var(--text-fact)}' }, { file: 'src/tokens.css', text: ':root{--color-ink:#111}' }]), baseline), []);
});

test('ratchet:update only lowers counts unless an increase is explicitly allowed', () => {
  const root = mkdtempSync(join(tmpdir(), 'baylink-ratchet-'));
  const write = (file, text) => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), text); };
  try {
    write('scripts/english-sources.json', '[]');
    write('src/i18n/en-patterns.json', '{}');
    write('src/main.tsx', "import './a.css';\n");
    write('src/a.css', '.a{color:#111;font-size:12px}');
    assert.equal(updateBaseline(root).written, true);
    assert.equal(readBaseline(root).counts.hexOccurrences, 1);
    write('src/a.css', '.a{color:#111;font-size:12px}.b{color:#222}');
    const refused = updateBaseline(root);
    assert.equal(refused.written, false);
    assert.match(refused.problems.join('\n'), /hexOccurrences rose from 1 to 2/);
    assert.equal(readBaseline(root).counts.hexOccurrences, 1, 'a refused update leaves the committed counts');
    write('src/a.css', '.a{color:var(--color-ink);font-size:12px}');
    assert.equal(updateBaseline(root).written, true);
    assert.equal(readBaseline(root).counts.hexOccurrences, 0);
    write('src/a.css', '.a{color:#333}');
    assert.equal(updateBaseline(root, { allowIncrease: true }).written, true);
    assert.equal(JSON.parse(readFileSync(join(root, BASELINE_FILE), 'utf8')).counts.hexOccurrences, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the site holds its committed style, English and lazy-CSS ratchet', () => {
  const baseline = readBaseline();
  assert.ok(baseline, `${BASELINE_FILE} is committed`);
  assert.deepEqual(compareWithBaseline(measureRepository(), baseline), []);
});
