import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadLocale } from '../src/i18n/locale';
import { buildPlanWeekend, PLAN_WEEKEND_SHOWN, type PlanWeekendSnapshot } from '../src/features/plan/plan-weekend-snapshot';
import { GUIDE_IMAGES, HOME_WEEKENDS } from '../src/lib/home-catalog';

// H54: 行程's 本周末精选 reads a snapshot generated with the home catalog (npm run generate:home), not the home catalog.
const generated = JSON.parse(readFileSync('src/data/generated/plan-weekend.json', 'utf8')) as PlanWeekendSnapshot;

test('the generated 行程 weekend picks are the home catalog’s, with their English (run `npm run generate:home` after a content change)', async () => {
  await loadLocale('en');
  assert.deepEqual(generated, JSON.parse(JSON.stringify(buildPlanWeekend())));
});

test('every home snapshot day has its cards, each an event of the snapshot on one of that weekend’s days, in English too', () => {
  assert.deepEqual(Object.keys(generated.days).sort(), Object.keys(HOME_WEEKENDS).sort());
  for (const [day, { start, end, entries }] of Object.entries(generated.days)) {
    assert.ok(entries.length <= PLAN_WEEKEND_SHOWN, day);
    for (const { id, date } of entries) {
      const event = generated.events[id];
      assert.ok(event, `${day}: ${id}`);
      assert.ok(date >= start && date <= end && date >= day, `${day}: ${id} on ${date}`);
      assert.doesNotMatch(event.en.title, /[㐀-鿿]/u, `${id}: English title`);
      // UI9-IMG-A1b: the candidates the strip may show (imageKeys, else its own image) ship with their records.
      for (const key of event.imageKeys ?? (event.imageKey ? [event.imageKey] : [])) if (GUIDE_IMAGES[key]) assert.deepEqual(generated.images[key], { ...GUIDE_IMAGES[key], alt: '' }, `${id}: ${key}'s image record (no alt text: the strip's covers are decorative)`);
      if (event.imageKeys) assert.ok(event.imageKeys.length > 0, `${id}: a picture to show`);
    }
  }
});
