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
const { CLOSE_UP_FACE_IMAGES, RELEASED_CLOSE_UPS, leadImageKey } = await import('../src/lib/close-up-faces');
const weekendLead = await import('../src/features/events/weekend-lead');
const { StaticRouter } = await import('react-router-dom');
const { HomeDiscovery } = await import('../src/components/HomeDiscovery');

type Catalog = { generatedAt: string; weekends: Record<string, { ids: string[] }>; events: { id: string; imageKey?: string }[]; images: Record<string, unknown> };
const catalog = JSON.parse(readFileSync('src/data/generated/home-catalog.json', 'utf8')) as Catalog;
const plan = JSON.parse(readFileSync('src/data/generated/plan-weekend.json', 'utf8')) as { days: Record<string, { entries: { id: string }[] }>; events: Record<string, { imageKey?: string }>; images: Record<string, unknown> };
const home = (day: string) => new JSDOM(renderToStaticMarkup(React.createElement(StaticRouter, { location: '/' },
  React.createElement(HomeDiscovery, { today: day, onAskBayBay: () => {}, onBrowseCommunity: () => {} })))).window.document;

test('DECISIONS 15: one list for every lead slot; a face photo never leads, it stays a card\'s photo', () => {
  assert.equal(weekendLead.CLOSE_UP_FACE_IMAGES, CLOSE_UP_FACE_IMAGES, '/events and /calendar use the shared list');
  assert.equal(weekendLead.leadImageKey, leadImageKey);
  // The owner released all six flagged close-ups in chat on 2026-10-21 (「圖片全部批准」, UI9-IMG-B1b): they lead like any photo.
  assert.ok(RELEASED_CLOSE_UPS.has('official-r2-petaluma-lumafest-20261024'), 'LumaFest (four volunteers posing) was flagged and released');
  assert.equal(CLOSE_UP_FACE_IMAGES.has('official-r2-petaluma-lumafest-20261024'), false);
  assert.equal(leadImageKey('official-r2-petaluma-lumafest-20261024'), 'official-r2-petaluma-lumafest-20261024');
  for (const key of CLOSE_UP_FACE_IMAGES) assert.equal(leadImageKey(key), undefined, `${key}: an unreleased close-up never leads`);
  assert.equal(leadImageKey(undefined), undefined);
  assert.equal(leadImageKey('official-mcm-halloween-spectacular-20261031'), 'official-mcm-halloween-spectacular-20261031');
  // The home catalog no longer drops the photo (the acceptance review: /plan's 本周末精选 lost it); only the lead skips it.
  assert.doesNotMatch(readFileSync('scripts/generate-home-catalog.ts', 'utf8'), /CLOSE_UP_FACE_IMAGES/);
});

test('DECISIONS 15/26: the home lead draws its type cover for an unreleased face photo, a released one shows its photo', () => {
  const byId = new Map(catalog.events.map(event => [event.id, event]));
  const leadDays = (keys: ReadonlySet<string>) => Object.keys(catalog.weekends).sort().filter(day => {
    const lead = byId.get(catalog.weekends[day].ids[0] ?? '');
    return !!lead?.imageKey && keys.has(lead.imageKey);
  });
  // LumaFest led the home from 10/20 to 10/24 until Claude's 10-21 weekly review put Cherryland's storytimes first (UI9-IMAGES
  // DECISIONS 26: a lead needs a ① or ② image that may lead). The owner released LumaFest's photo and the five other close-ups
  // on 10-21, so a day whose lead is one of them shows the photo; the type-cover path below runs only for a flagged close-up
  // the owner has not released (none since 10-21), whenever one would lead.
  const releasedDays = leadDays(RELEASED_CLOSE_UPS);
  for (const day of releasedDays.slice(0, 1)) {
    const lead = byId.get(catalog.weekends[day].ids[0])!;
    const first = home(day).querySelector('.home-picks__list>li:first-child')!;
    assert.ok(first.querySelector('img'), `${day}: the lead shows ${lead.imageKey}, released by the owner`);
    assert.equal(first.querySelector('[data-cover=type]'), null, `${day}: no type cover in the lead`);
  }
  for (const day of leadDays(CLOSE_UP_FACE_IMAGES).slice(0, 1)) {
    const lead = byId.get(catalog.weekends[day].ids[0])!;
    assert.ok(lead.imageKey! in catalog.images, `${day}: the catalog keeps ${lead.imageKey} for the feed and /plan`);
    const first = home(day).querySelector('.home-picks__list>li:first-child')!
    assert.ok(first.querySelector('[data-cover=type]'), `${day}: the 16:9 lead frame shows the type cover`);
    assert.equal(first.querySelector('img'), null, `${day}: no face photo in the lead`);
  }
  // /plan's 本周末精选 is no lead: its first pick shows the photo when it has one.
  for (const [day, entry] of Object.entries(plan.days)) {
    const first = plan.events[entry.entries[0]?.id ?? ''];
    if (first?.imageKey && CLOSE_UP_FACE_IMAGES.has(first.imageKey) && first.imageKey in catalog.images) assert.ok(first.imageKey in plan.images, `${day}: /plan keeps the photo`);
  }
});
