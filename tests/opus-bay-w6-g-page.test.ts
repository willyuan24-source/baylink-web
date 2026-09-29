import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Wave 6 · lane G (W6-G4) · the season's goals and the 万圣节 page's counts (halloween/progress.ts): five doors, ten
 * jack-o'-lanterns (lane H's `pumpkin:n` ids read from the ledger), one costume; the page tab's "n/3".
 */

const progress = await import('../src/opus-bay/halloween/progress');
const { TREAT_DOORS } = await import('../src/opus-bay/halloween/treatDoors');

test('W6-G4 goals: doors, pumpkins and a costume from what the ledger paid; the tab count', () => {
  const none = () => false;
  const g0 = progress.halloweenGoals(none);
  assert.deepEqual(g0.map(g => [g.id, g.have, g.need]), [['doors', 0, 5], ['pumpkins', 0, 10], ['costume', 0, 1]]);
  assert.equal(progress.goalsDoneText(none), '0/3');
  assert.equal(progress.PUMPKINS_TOTAL, 40);
  const paid = new Set<string>();
  for (const d of TREAT_DOORS.slice(0, 7)) paid.add(`halloween:door:${d.n}`);
  for (let i = 1; i <= 4; i++) paid.add(`halloween:pumpkin:${i * 3}`);
  paid.add('halloween:costume:first');
  const has = (s: string) => paid.has(s);
  const g1 = progress.halloweenGoals(has);
  assert.deepEqual(g1.map(g => [g.id, g.have]), [['doors', 5], ['pumpkins', 4], ['costume', 1]], 'capped at the goal');
  assert.equal(progress.pumpkinsFound(has), 4);
  assert.equal(progress.goalsDoneText(has), '2/3');
  // the texts are bilingual and short
  for (const g of g1) assert.ok(g.text.zh.length <= 14 && g.text.en.length <= 40);
});
