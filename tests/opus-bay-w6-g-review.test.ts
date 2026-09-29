import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Wave 6 · the adversarial review of lane G (W6-G-review): the defects found by playing the season, each pinned here.
 *
 *   1. BAYBAY's milestone line after a treat fires only when THIS treat crossed it: on the big night a knock on a door
 *      already knocked in the season left the door count at five and she said 敲开了五户人家的门 again (and the bag's
 *      5 / 10 lines and "every door" came back at the first treat of every session).
 *   2. Phones: the candy badge pushed the objective pill to a third line that began with a dangling "·" (目标 0/10 then
 *      "· 🪙 120 · 🍬 36"); on a phone it now shows only near a trick-or-treat street, on a line of its own.
 *   3. The 万圣节 page offered 带我去 to the streets on 1–2 November, when no door is dressed; and on the big night it
 *      counted the season's knocks, so a street knocked in October showed 10/10 and no 带我去 although every door there
 *      had tonight's double treat left.
 */

const treat = await import('../src/opus-bay/halloween/treat');
const badge = await import('../src/opus-bay/halloween/treatNear');

test('W6-G-review 1: the milestone line only when this treat crossed it (never again for a big-night knock on a knocked door)', () => {
  const s = (doors: number, bag: number, all = false) => ({ doors, bag, all });
  // the fifth door: the goal's line (it wins over the bag's fifth candy)
  assert.equal(treat.treatMilestone(s(4, 4), s(5, 5), 5), 'w6g-goal-done');
  // the big night, a door knocked in the season: the door count stays 5 → no goal line again; the bag crosses 10
  assert.equal(treat.treatMilestone(s(5, 8), s(5, 10), 5), 'w6g-not-too-much');
  assert.equal(treat.treatMilestone(s(5, 11), s(5, 13), 5), null);
  // a resumed save with a full-ish bag: the next treat says nothing about the bag
  assert.equal(treat.treatMilestone(s(7, 7), s(8, 8), 5), null);
  // the bag's fifth candy
  assert.equal(treat.treatMilestone(s(2, 3), s(3, 6), 5), 'w6g-bag-heavy');
  // every door: once, when the last one is knocked; not on a later big-night knock
  assert.equal(treat.treatMilestone(s(53, 60), s(54, 61, true), 5), 'w6g-all-doors');
  assert.equal(treat.treatMilestone(s(54, 61, true), s(54, 63, true), 5), null);
});

test('W6-G-review 2: on a phone the candy badge shows only near a trick-or-treat street, on its own line (no dangling "·")', () => {
  assert.equal(typeof badge.CANDY_PHONE_CSS, 'string');
  const css = badge.CANDY_PHONE_CSS.replace(/\s+/g, ' ');
  // the phone breakpoint of ui/Hud.tsx `badgesBelow` (the badges ride on the goals line)
  assert.match(css, /@media \(max-width: 600px\)/);
  // far from the streets: hidden (the pill keeps its two lines)
  assert.match(css, /\.ob-pill-badge:has\(> \.ob-candy\[data-far\]\) \{ display: none; \}/);
  // near: the badges take a line of their own and the first one loses its separator
  assert.match(css, /\.ob-pill-badges:has\(\.ob-candy:not\(\[data-far\]\)\) \{[^}]*display: flex;/);
  assert.match(css, /:first-child::before \{ content: none; \}/);
  // the near state follows the streets built round the player
  assert.equal(badge.treatNear(), false);
  const seen: boolean[] = [];
  const off = badge.onTreatNear(() => seen.push(badge.treatNear()));
  badge.setTreatNear(true);
  badge.setTreatNear(true);
  badge.setTreatNear(false);
  off();
  badge.setTreatNear(true);
  assert.deepEqual(seen, [true, false]);
  badge.setTreatNear(false);
});

test('W6-G-review 3: 带我去 to a street only while its doors are dressed and some are left', () => {
  assert.equal(treat.streetGoOffered('season', 2, 9), true);
  assert.equal(treat.streetGoOffered('night', 9, 9), false);
  assert.equal(treat.streetGoOffered('muertos', 0, 9), false);
  assert.equal(treat.streetGoOffered('off', 0, 9), false);
  // on the big night a street's progress is tonight's treats (a street knocked in the season still has them to give)
  assert.equal(treat.pageSourceOf('night', 3), 'halloween:night:3');
  assert.equal(treat.pageSourceOf('season', 3), 'halloween:door:3');
});
