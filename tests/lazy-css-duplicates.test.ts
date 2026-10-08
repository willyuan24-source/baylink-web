import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cssLoadGraph, lazyCssDuplicates, readBaseline } from '../scripts/check-style-ratchet.mjs';

test('a selector in two separately loaded CSS files is a load-order dependency; files loaded together are not', () => {
  const sources = [
    { file: 'explore.css', text: '.outing-empty{display:grid}.shared p{margin:0}@keyframes spin{from{opacity:0}}' },
    { file: 'outings.css', text: '.outing-empty{display:flex}.shared  p{margin:1px}.only-here{color:red}@keyframes spin{from{opacity:1}}' },
    { file: 'tools.css', text: '.picker:first-child{color:red}' },
    { file: 'tools-extra.css', text: '.picker:first-child{color:blue}' },
  ];
  const unit = (file: string) => file.startsWith('tools') ? 'tools' : file;
  assert.deepEqual(lazyCssDuplicates(sources, unit), [
    { selector: '.outing-empty', files: ['explore.css', 'outings.css'] },
    { selector: '.shared p', files: ['explore.css', 'outings.css'] },
  ]);
});

test('global CSS is everything src/main.tsx loads at boot; route CSS arrives with its lazy chunk', () => {
  const graph = cssLoadGraph();
  for (const file of ['src/index.css', 'src/design.css', 'src/tokens.css', 'src/features/profile/privacy-security.css']) assert.ok(graph.global.includes(file), file);
  for (const file of ['src/styles/attractions.css', 'src/features/outings/outings.css', 'src/components/tools/tools.css']) assert.ok(graph.lazy.includes(file), file);
  assert.equal(graph.global.filter(file => graph.lazy.includes(file)).length, 0);
  assert.ok(graph.lazy.every(file => !file.startsWith('src/opus-bay/') && !file.includes('little-bay')), 'the 3D worlds are out of scope');
});

test('no new selector is shared by two lazily loaded CSS files (FA-04)', () => {
  const baseline = readBaseline();
  assert.ok(baseline, 'the ratchet baseline is committed');
  const allowed = new Set(baseline.lazyCssDuplicates.map((item: { selector: string }) => item.selector));
  const graph = cssLoadGraph();
  const sources = graph.lazy.map(file => ({ file, text: readFileSync(new URL(`../${file}`, import.meta.url), 'utf8') }));
  const added = lazyCssDuplicates(sources, graph.unitOf).filter(item => !allowed.has(item.selector));
  assert.deepEqual(added, [], 'rename one copy (for example .attraction-outing-*) or move the shared rule into one file');
});
