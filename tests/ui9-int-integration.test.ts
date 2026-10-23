import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/** UI9-INT: the captain's integration rulings that span lanes (2026-10-20), pinned where no lane test holds them. */
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { CLOSE_UP_FACE_IMAGES, NOT_FOR_LEAD, RELEASED_CLOSE_UPS, leadImageKey, leadImageKeyFor } = await import('../src/lib/close-up-faces');
const weekendLead = await import('../src/features/events/weekend-lead');
const { GUIDE_IMAGES } = await import('../src/data/guide-media');
const { coverItemFor, getCover } = await import('../src/lib/cover');
const { leadItem, leadsWithPicture } = await import('../src/lib/lead-rule');
const { StaticRouter } = await import('react-router-dom');
const { HomeDiscovery } = await import('../src/components/HomeDiscovery');

type Catalog = { generatedAt: string; weekends: Record<string, { ids: string[] }>; events: { id: string; imageKey?: string }[]; images: Record<string, unknown> };
const catalog = JSON.parse(readFileSync('src/data/generated/home-catalog.json', 'utf8')) as Catalog;
const plan = JSON.parse(readFileSync('src/data/generated/plan-weekend.json', 'utf8')) as { days: Record<string, { entries: { id: string }[] }>; events: Record<string, { imageKey?: string }>; images: Record<string, unknown> };
const home = (day: string) => new JSDOM(renderToStaticMarkup(React.createElement(StaticRouter, { location: '/' },
  React.createElement(HomeDiscovery, { today: day, onAskBayBay: () => {}, onBrowseCommunity: () => {} })))).window.document;
/**
 * To check the pages' path, put `key` (a photo that leads today) on the list of pictures that never lead (close-ups and
 * posed groups, DECISIONS 15/32), for `run` only: the pages read the shared list at render time.
 */
const whileFlagged = <T>(key: string, run: () => T): T => {
  const list = NOT_FOR_LEAD as Set<string>;
  assert.equal(list.has(key), false, `${key} is not flagged already`);
  list.add(key);
  try { return run(); } finally { list.delete(key); }
};

test('DECISIONS 15/32: one list for every lead slot; a close-up never leads, released or not, and stays a card\'s photo', () => {
  assert.equal(weekendLead.CLOSE_UP_FACE_IMAGES, CLOSE_UP_FACE_IMAGES, '/events and /calendar use the shared list');
  assert.equal(weekendLead.NOT_FOR_LEAD, NOT_FOR_LEAD);
  assert.equal(weekendLead.leadImageKey, leadImageKey);
  // The owner released all six flagged close-ups in chat on 2026-10-21 (「圖片全部批准」, UI9-IMG-B1b): the release stands (they
  // show on cards, rows and detail pages), and DECISIONS 32 (round 2) keeps every one of them out of the lead slots. Five are
  // still on the site: LumaFest's posed volunteer photo was replaced by the festival's 2025 altar photo (UI9-IMG-B2, 10-23).
  assert.ok(RELEASED_CLOSE_UPS.has('official-sausalito-goblin-jamboree-2026'), 'Goblin Jamboree (families posing close up) was flagged and released');
  assert.equal(CLOSE_UP_FACE_IMAGES.has('official-r2-petaluma-lumafest-20261024'), false, 'the LumaFest key names the altar photo now');
  assert.deepEqual([CLOSE_UP_FACE_IMAGES.size, RELEASED_CLOSE_UPS.size], [5, 5]);
  for (const key of RELEASED_CLOSE_UPS) {
    assert.ok(CLOSE_UP_FACE_IMAGES.has(key) && NOT_FOR_LEAD.has(key), `${key}: released, and still never a lead`);
    assert.equal(leadImageKey(key), undefined, `${key}: the lead slot draws the next candidate`);
  }
  // The rule itself, on the Goblin Jamboree photo: no picture of its own in any lead slot (the slot draws the next candidate, here
  // none: the type cover), never `leadsWithPicture`; the card keeps the photo. Off the list, it would lead.
  {
    const key = 'official-sausalito-goblin-jamboree-2026';
    const record = { id: 'x-close-up', imageKey: key };
    const context = { images: GUIDE_IMAGES, today: '2026-10-21' };
    assert.equal(leadImageKeyFor(key, NOT_FOR_LEAD), undefined, 'a close-up never leads');
    assert.equal(leadImageKeyFor(key, new Set()), key, 'off the list, it would lead as itself');
    assert.equal(getCover(leadItem(record), context).tier, 'type', 'the lead slot draws the type cover');
    assert.equal(leadsWithPicture(record, context), false);
    assert.equal(weekendLead.canLead(record, '2026-10-21'), false, '/events and /calendar: it cannot lead');
    assert.equal(getCover(coverItemFor('event', record), context).tier, 'official', 'a card keeps the photo');
    assert.equal(getCover(leadItem(record, new Set()), context).tier, 'official');
    assert.equal(leadsWithPicture(record, context, new Set()), true);
    assert.equal(weekendLead.canLead(record, '2026-10-21', new Set()), true);
  }
  // DECISIONS 24: an AI illustration the owner approved as a ④ cover shows on a card but never leads. The lead rule holds that
  // (lib/lead-rule.ts: cover.ts refuses ④ on a lead), not this list, which keeps close-ups and posed groups only.
  const approvals = JSON.parse(readFileSync('src/data/ai-cover-approvals.json', 'utf8')).approvals as { key: string }[];
  assert.ok(approvals.length > 0, 'the owner approved AI covers on 2026-10-21');
  for (const { key } of approvals) {
    const record = { id: `x-${key}`, imageKey: key };
    const context = { images: GUIDE_IMAGES, today: '2026-10-21' };
    assert.equal(NOT_FOR_LEAD.has(key), false, `${key}: not on the close-up list`);
    assert.equal(getCover(coverItemFor('event', record), context).tier, 'ai', `${key}: an approved AI cover shows on a card`);
    assert.notEqual(getCover(leadItem(record), context).tier, 'ai', `${key}: an approved AI cover never leads`);
    assert.equal(leadsWithPicture(record, context), false, `${key}: an approved AI cover never leads`);
  }
  assert.equal(leadImageKey(undefined), undefined);
  assert.equal(leadImageKey('official-mcm-halloween-spectacular-20261031'), 'official-mcm-halloween-spectacular-20261031');
  // A poster is not on the list: cover.ts keeps it off a lead by its kind (DECISIONS 32), so it never leads either.
  assert.equal(leadsWithPicture({ id: 'x-poster', imageKey: 'official-mcm-halloween-spectacular-20261031' }, { images: GUIDE_IMAGES, today: '2026-10-21' }), false);
  // The home catalog no longer drops the photo (the acceptance review: /plan's 本周末精选 lost it); only the lead skips it.
  assert.doesNotMatch(readFileSync('scripts/generate-home-catalog.ts', 'utf8'), /CLOSE_UP_FACE_IMAGES/);
});

test('DECISIONS 15/26/32: the home lead never shows a close-up (its next candidate instead); /plan\'s first pick is a lead photo', () => {
  const byId = new Map(catalog.events.map(event => [event.id, event]));
  // LumaFest led the home from 10/20 to 10/24 until Claude's 10-21 weekly review put Cherryland's storytimes first; DECISIONS
  // 32 (round 2) then moved the storytimes poster off the lead too. The page's two paths are checked on the first day whose
  // lead shows a photo: as it ships, then with that photo put on the list of pictures that never lead.
  const day = Object.keys(catalog.weekends).sort().find(date => {
    const lead = byId.get(catalog.weekends[date].ids[0] ?? '');
    return !!lead?.imageKey && lead.imageKey in catalog.images;
  });
  assert.ok(day, 'some home day leads with a photo');
  const lead = byId.get(catalog.weekends[day].ids[0])!;
  const leadCard = () => home(day).querySelector('.home-picks__list>li:first-child')!;
  // The photo's file stem: the lead's <img> is one of its sized files (-800.webp, -small.webp, …).
  const stem = (GUIDE_IMAGES[lead.imageKey!] as { src: string }).src.replace(/\.webp$/, '');
  const shows = (card: Element) => [...card.querySelectorAll('img')].some(image => `${image.getAttribute('src')} ${image.getAttribute('srcset') ?? ''}`.includes(stem));
  assert.ok(shows(leadCard()), `${day}: the lead shows ${lead.imageKey}`);
  assert.equal(leadCard().querySelector('[data-cover=type]'), null, `${day}: no type cover in the lead`);
  whileFlagged(lead.imageKey!, () => {
    const first = leadCard();
    assert.equal(shows(first), false, `${day}: flagged, the lead never shows ${lead.imageKey}`);
    // The 16:9 frame draws the next candidate: a ③ category photo labelled 示意图 (never ④ on a lead), else the type cover.
    const next = getCover(leadItem(lead, new Set([lead.imageKey!])), { images: GUIDE_IMAGES, today: day });
    assert.ok(next.tier === 'stock' || next.tier === 'type', `${day}: ${next.tier}`);
    if (next.tier === 'stock') assert.match(first.textContent ?? '', /示意图/, `${day}: the ③ photo is labelled`);
    else assert.ok(first.querySelector('[data-cover=type]'), `${day}: the type cover`);
    // The catalog keeps the photo for the feed and /plan (only the lead skips it).
    assert.ok(lead.imageKey! in catalog.images, `${day}: the catalog keeps ${lead.imageKey}`);
  });
  assert.ok(shows(leadCard()), 'off the list again, the lead shows its photo');
  for (const key of RELEASED_CLOSE_UPS) assert.equal(leadImageKey(key), undefined, `${key}: released, and still never a lead`);
  // /plan's 本周末精选 opens with the home's lead (DECISIONS 32: a lead slot), so its first pick ships that photo.
  let planDays = 0;
  for (const [date, entry] of Object.entries(plan.days)) {
    const first = plan.events[entry.entries[0]?.id ?? ''];
    if (!first?.imageKey || !(first.imageKey in catalog.images)) continue;
    planDays++;
    assert.ok(first.imageKey in plan.images, `${date}: /plan keeps ${first.imageKey}`);
  }
  assert.ok(planDays > 0, '/plan has a first pick with a photo');
});
