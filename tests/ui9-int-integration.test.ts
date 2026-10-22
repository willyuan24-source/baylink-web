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
const { CLOSE_UP_FACE_IMAGES, RELEASED_CLOSE_UPS, leadImageKey, leadImageKeyFor } = await import('../src/lib/close-up-faces');
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
 * The owner released every flagged close-up on 2026-10-21, so the list of close-ups that never lead is empty; DECISIONS 15
 * and 26 still bind the next one flagged. To check the pages' path, flag `key` (a photo that leads today) as a close-up the
 * owner has not released, for `run` only: the pages read the shared list at render time.
 */
const whileFlagged = <T>(key: string, run: () => T): T => {
  const list = CLOSE_UP_FACE_IMAGES as Set<string>;
  assert.equal(list.has(key), false, `${key} is not flagged already`);
  list.add(key);
  try { return run(); } finally { list.delete(key); }
};

test('DECISIONS 15: one list for every lead slot; a face photo never leads, it stays a card\'s photo', () => {
  assert.equal(weekendLead.CLOSE_UP_FACE_IMAGES, CLOSE_UP_FACE_IMAGES, '/events and /calendar use the shared list');
  assert.equal(weekendLead.leadImageKey, leadImageKey);
  // The owner released all six flagged close-ups in chat on 2026-10-21 (「圖片全部批准」, UI9-IMG-B1b): they lead like any photo.
  assert.ok(RELEASED_CLOSE_UPS.has('official-r2-petaluma-lumafest-20261024'), 'LumaFest (four volunteers posing) was flagged and released');
  assert.equal(CLOSE_UP_FACE_IMAGES.has('official-r2-petaluma-lumafest-20261024'), false);
  assert.equal(leadImageKey('official-r2-petaluma-lumafest-20261024'), 'official-r2-petaluma-lumafest-20261024');
  // The list is flagged minus released: all six released, none left. A new close-up goes on the flagged list unreleased
  // (close-up-faces.ts); this pin then changes, and so does what the checks below exercise.
  assert.deepEqual([CLOSE_UP_FACE_IMAGES.size, RELEASED_CLOSE_UPS.size], [0, 6]);
  for (const key of RELEASED_CLOSE_UPS) assert.equal(CLOSE_UP_FACE_IMAGES.has(key), false, `${key}: released`);
  // The rule itself, on a close-up the owner has not released (LumaFest's photo, flagged as it was before 10-21): no picture
  // in any lead slot (the slot draws the type cover), never `leadsWithPicture`; the card keeps the photo. Released, it leads.
  {
    const key = 'official-r2-petaluma-lumafest-20261024';
    const flagged: ReadonlySet<string> = new Set([key]);
    const record = { id: 'x-close-up', imageKey: key };
    const context = { images: GUIDE_IMAGES, today: '2026-10-21' };
    assert.equal(leadImageKeyFor(key, flagged), undefined, 'a flagged close-up never leads');
    assert.equal(leadImageKeyFor(key, new Set()), key, 'released, it leads as itself');
    assert.equal(getCover(leadItem(record, flagged), context).tier, 'type', 'the lead slot draws the type cover');
    assert.equal(leadsWithPicture(record, context, flagged), false);
    assert.equal(weekendLead.canLead(record, '2026-10-21', flagged), false, '/events and /calendar: it cannot lead');
    assert.equal(getCover(coverItemFor('event', record), context).tier, 'official', 'a card keeps the photo');
    assert.equal(getCover(leadItem(record, new Set()), context).tier, 'official');
    assert.equal(leadsWithPicture(record, context, new Set()), true);
    assert.equal(weekendLead.canLead(record, '2026-10-21', new Set()), true);
  }
  // DECISIONS 24: an AI illustration the owner approved as a ④ cover shows on a card but never leads. The lead rule holds that
  // (lib/lead-rule.ts: cover.ts refuses ④ on a lead), not this list, which keeps close-ups only.
  const approvals = JSON.parse(readFileSync('src/data/ai-cover-approvals.json', 'utf8')).approvals as { key: string }[];
  assert.ok(approvals.length > 0, 'the owner approved AI covers on 2026-10-21');
  for (const { key } of approvals) {
    const record = { id: `x-${key}`, imageKey: key };
    const context = { images: GUIDE_IMAGES, today: '2026-10-21' };
    assert.equal(CLOSE_UP_FACE_IMAGES.has(key), false, `${key}: not on the close-up list`);
    assert.equal(getCover(coverItemFor('event', record), context).tier, 'ai', `${key}: an approved AI cover shows on a card`);
    assert.notEqual(getCover(leadItem(record), context).tier, 'ai', `${key}: an approved AI cover never leads`);
    assert.equal(leadsWithPicture(record, context), false, `${key}: an approved AI cover never leads`);
  }
  assert.equal(leadImageKey(undefined), undefined);
  assert.equal(leadImageKey('official-mcm-halloween-spectacular-20261031'), 'official-mcm-halloween-spectacular-20261031');
  // The home catalog no longer drops the photo (the acceptance review: /plan's 本周末精选 lost it); only the lead skips it.
  assert.doesNotMatch(readFileSync('scripts/generate-home-catalog.ts', 'utf8'), /CLOSE_UP_FACE_IMAGES/);
});

test('DECISIONS 15/26: the home lead never shows an unreleased face photo (its next candidate instead), a released one shows its photo', () => {
  const byId = new Map(catalog.events.map(event => [event.id, event]));
  // LumaFest led the home from 10/20 to 10/24 until Claude's 10-21 weekly review put Cherryland's storytimes first (UI9-IMAGES
  // DECISIONS 26: a lead needs a ① or ② image that may lead). No home day leads with a released close-up now, and none is
  // left unreleased (since 10-21), so the page's two paths are checked on the first day whose lead shows a photo: as it
  // ships (a photo off the list leads with it, as a released close-up does), then with that photo flagged and unreleased.
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
  assert.ok(shows(leadCard()), 'unflagged again, the lead shows its photo');
  for (const key of RELEASED_CLOSE_UPS) assert.equal(leadImageKey(key), key, `${key}: released, it leads with its photo`);
  // /plan's 本周末精选 is no lead: its first pick ships its photo whatever the close-up list says (the generator never reads it).
  let planDays = 0;
  for (const [date, entry] of Object.entries(plan.days)) {
    const first = plan.events[entry.entries[0]?.id ?? ''];
    if (!first?.imageKey || !(first.imageKey in catalog.images)) continue;
    planDays++;
    assert.ok(first.imageKey in plan.images, `${date}: /plan keeps ${first.imageKey}`);
  }
  assert.ok(planDays > 0, '/plan has a first pick with a photo');
});
