import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { CLAUDE_REVIEW_DATE_2026_10_21, CLAUDE_REVIEWED_2026_10_21 } from './support/claude-review-2026-10-21';

// verifiedAt 2026-10-21 claims that the official page was read that day and matched (TASK-CHAIN-2026-10-20 §4). Only Claude's
// weekly review of 10/24–25 may make it, and only for the ids it lists with a quote in the ledger.
test('verifiedAt 2026-10-21 sits exactly on the rows Claude read and matched on 2026-10-21', () => {
  const stamped = MONTHLY_EVENTS.filter(event => event.verifiedAt === CLAUDE_REVIEW_DATE_2026_10_21).map(event => event.id).sort();
  assert.deepEqual(stamped, [...CLAUDE_REVIEWED_2026_10_21].sort());
  assert.equal(CLAUDE_REVIEWED_2026_10_21.size, 68);
});

test('every reviewed row has a ledger row in the review section', () => {
  const ledger = readFileSync('docs/source-reads-2026-10.md', 'utf8');
  const section = ledger.slice(ledger.indexOf('## Claude weekly review 2026-10-21 (10/24–25)'));
  assert.ok(section.length > 100, 'the section exists');
  const body = section.slice(0, (section.indexOf('\n## ', 10) + 1 || section.length + 1) - 1);
  for (const id of CLAUDE_REVIEWED_2026_10_21) assert.match(body, new RegExp(`\\| \`${id}\` \\|.*\\| match`), id);
});

test('pages that could not be read, the corrected-but-unconfirmed item and the held item keep their earlier dates', () => {
  const byId = new Map(MONTHLY_EVENTS.map(event => [event.id, event]));
  for (const [id, date] of [
    ['santa-rosa-pumpkins-parks-2026', '2026-10-15'],
    ['r2-vallejo-wonder-sundays-2026', '2026-10-15'],
    ['november-north-sonoma-harvest-market-2026', '2026-10-15'],
    ['r2-vallejo-wonder-deep-dive-2026', '2026-10-15'],
    ['belmont-centennial-fest-2026', '2026-10-02'],
    ['mountain-view-monster-bash-2026', '2026-09-29'],
    ['roundup-novato-dia-muertos-2026', '2026-10-02'],
    ['san-jose-sjma-dia-muertos-community-2026', '2026-10-15'],
    ['santa-rosa-halloween-howarth-2026', '2026-09-29'],
    ['sf-exploratorium-family-science-oct24-2026', '2026-09-29'],
    ['sf-thrive-thrill-o-ween-2026', '2026-09-28'],
  ] as const) assert.equal(byId.get(id)?.verifiedAt, date, id);
});
