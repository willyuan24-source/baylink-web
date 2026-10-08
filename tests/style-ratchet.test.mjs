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
    hexOccurrences: 4, hexDistinct: 4, fontSizePx: 4, fontSizePxUnder13: 2, radiusKinds: 2, shadowKinds: 2,
    fontWeightOutsideSet: 3, textArbitraryUnder13: 1, baylinkClasses: 2, arrowUpRight: 1,
  });
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
