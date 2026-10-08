import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// REG-06: the prerendered first paint labelled /plan as 问 BayBay. The static shell must offer the same links, with
// the same names, as the app's navigation (BayBay is a panel button in the app, not a page).
test('prerender shell navigation pairs each label with the page the app links it to', () => {
  const prerender = readFileSync('scripts/prerender.tsx', 'utf8');
  const shell = prerender.slice(prerender.indexOf('const Shell'), prerender.indexOf('const renderPage'));
  const zhLabels = [...shell.match(/: \[('网站导航'[^\]]*)\]/)![1].matchAll(/'([^']*)'/g)].map(match => match[1]);
  const navLine = shell.match(/const nav\b[^\n]*/)![0];
  const shellNav = [...navLine.matchAll(/\['(\/[^']*)', labels\[(\d+)\]\]/g)].map(([, path, index]) => [path, zhLabels[Number(index)]]);

  const mobile = readFileSync('src/components/SiteMobileNavigation.tsx', 'utf8');
  const appNav = [...mobile.matchAll(/\{ href: '(\/[^']*)', label: english \? '[^']*' : '([^']*)'/g)].map(([, path, label]) => [path, label]);

  assert.ok(appNav.length >= 4, 'reads the app navigation');
  assert.deepEqual(shellNav, appNav);
  assert.ok(!shellNav.some(([path]) => path === '/plan'), 'no page link stands in for the BayBay panel');
  assert.ok(!shell.includes("'/plan'"));
});
