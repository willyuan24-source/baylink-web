import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { redirectLocation } from '../src/app/route-table';

// W5-INT (H35, WEB-LINK-2 follow-up): with /this-month a 301 to /events, the site's own links go straight to the page the
// redirect lands on, with no hop. Each link keeps the destination it had through the redirect (a query of its own wins).
const LINKS = [
  { file: 'src/components/QuickExplore.tsx', from: '/this-month?when=weekend#monthly-events', to: "'/events?when=weekend#monthly-events'" },
  { file: 'src/features/outings/OutingsHub.tsx', from: '/this-month', to: '"/events?when=all"' },
  { file: 'src/pages/AiLocalPage.tsx', from: '/this-month', to: '"/events?when=all"' },
];

test('the site links that pointed at /this-month link the page its 301 lands on, query and anchor kept', () => {
  for (const { file, from, to } of LINKS) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /["'`]\/this-month/, `${file}: no link through the /this-month redirect`);
    assert.ok(source.includes(to), `${file}: links ${to}`);
    const [path, rest = ''] = from.split('?');
    const [search, hash = ''] = rest.split('#');
    const landed = redirectLocation(path, search ? `?${search}` : '');
    assert.ok(landed, `${from} still redirects (H35)`);
    assert.equal(`${landed.pathname}${landed.search}${hash ? `#${hash}` : ''}`, to.slice(1, -1), `${file}: same destination as the redirect`);
  }
});
