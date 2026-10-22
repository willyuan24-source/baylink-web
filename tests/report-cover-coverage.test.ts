import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

// UI9-IMAGES A0: `npm run report:covers` runs the pages' own selection and cover code; A1b's merge gate and the §7 check
// read its JSON. A smoke run: one day, every page, the inventory, and the projected mode.
const run = (...args: string[]) => {
  const out = join(mkdtempSync(join(tmpdir(), 'covers-')), 'report.json');
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--tsconfig', 'tsconfig.app.json', '--import', './tests/support/css-stub.mjs',
    'scripts/report-cover-coverage.ts', '--from', '2026-10-24', '--days', '1', '--out', out, ...args], { stdio: 'pipe' });
  return JSON.parse(readFileSync(out, 'utf8'));
};

test('report:covers measures every page, both first screens and the whole shelf', () => {
  const { summary, slots, inventory } = run();
  for (const page of ['home:weekend', 'home:elders', '/events', '/perks', '/openings', '/guides']) {
    assert.ok(summary.pages[page]?.all.slots > 0, page);
    assert.ok(summary.pages[page].phoneFirstScreen.slots <= summary.pages[page].desktopFirstScreen.slots, page);
    assert.ok(summary.pages[page].desktopFirstScreen.slots < summary.pages[page].all.slots, `${page}: a first screen is not the whole page`);
  }
  assert.equal(summary.infoCardsOnPages, slots.filter((slot: { tier: string }) => slot.tier === 'type').length);
  assert.ok(inventory.length > 500, 'every live record');
  assert.equal(run('--mode', 'projected').summary.mode, 'projected');
});

// UI9-IMAGES §7 (UI9-IMG-A1b): the logic layer of "every card has a picture" (DECISIONS 21). Every live record (events and
// events-later, all offers, openings, guides) and every page slot of the next 21 days, picked by the pages' own selection
// and page de-duplication, is a picture: 0 information cards. A new record with no picture of any tier turns this red.
test('§7: 0 information cards on every page and on the whole shelf (report:covers --mode current --fail-on-info)', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'covers-')), 'report.json');
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--tsconfig', 'tsconfig.app.json', '--import', './tests/support/css-stub.mjs',
    'scripts/report-cover-coverage.ts', '--days', '21', '--mode', 'current', '--fail-on-info', '--out', out], { stdio: 'pipe' });
  const { summary, slots, inventory } = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(summary.infoCardsOnPages, 0);
  assert.deepEqual(slots.filter((slot: { tier: string }) => slot.tier === 'type'), []);
  assert.deepEqual(inventory.filter((slot: { tier: string }) => slot.tier === 'type').map((slot: { section: string; id: string }) => `${slot.section}:${slot.id}`), []);
});
