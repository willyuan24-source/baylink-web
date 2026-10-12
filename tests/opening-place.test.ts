import assert from 'node:assert/strict';
import test from 'node:test';
import { currentOpenings } from '../src/data/local-discoveries';
import { placeFor } from '../src/lib/planner';
import { isPlannableOpening, openingPlaceId } from '../src/lib/opening-place';

// The opening detail page decides "用这家店开始出游计划" and its place ♡ with the light rule (src/lib/opening-place.ts), so the
// event / offer / opening detail route does not import the planner catalog and the guides corpus. It must give exactly the
// planner catalog's answer for every new shop that has a detail page.
test('every new shop with a detail page is a planner place exactly when the planner catalog lists it', () => {
  let places = 0;
  for (const shop of currentOpenings) {
    const light = isPlannableOpening(shop) ? openingPlaceId(shop.id) : undefined;
    assert.equal(light, placeFor(`opening-${shop.id}`)?.id, shop.id);
    if (light) places++;
  }
  assert.ok(places > 0 && places < currentOpenings.length, 'both open shops and announcements are covered');
});
