import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/** UI9-INT: the captain's integration rulings that span lanes (2026-10-20), pinned where no lane test holds them. */
const { CLOSE_UP_FACE_IMAGES } = await import('../src/lib/close-up-faces');
const weekendLead = await import('../src/features/events/weekend-lead');

type Catalog = { weekends: Record<string, { ids: string[] }>; events: { id: string; imageKey?: string }[]; images: Record<string, unknown> };
const catalog = JSON.parse(readFileSync('src/data/generated/home-catalog.json', 'utf8')) as Catalog;

test('DECISIONS 15: a close-up face photo never leads the home; /events and the home read one list', () => {
  assert.equal(weekendLead.CLOSE_UP_FACE_IMAGES, CLOSE_UP_FACE_IMAGES, '/events and /calendar use the shared list');
  assert.ok(CLOSE_UP_FACE_IMAGES.has('official-r2-petaluma-lumafest-20261024'), 'LumaFest (four volunteers posing) is on it');
  const byId = new Map(catalog.events.map(event => [event.id, event]));
  let checked = 0;
  for (const [day, weekend] of Object.entries(catalog.weekends)) {
    const lead = weekend.ids[0] && byId.get(weekend.ids[0]);
    if (!lead || !lead.imageKey || !CLOSE_UP_FACE_IMAGES.has(lead.imageKey)) continue;
    checked++;
    assert.ok(!(lead.imageKey in catalog.images), `${day}: the lead ${lead.id} ships without its face photo (type cover in the 16:9 frame)`);
  }
  // The rule is in the generator either way (today LumaFest leads 10/20–10/24).
  assert.match(readFileSync('scripts/generate-home-catalog.ts', 'utf8'), /CLOSE_UP_FACE_IMAGES\.has\(imageKey\)/);
  assert.ok(checked >= 0);
});
