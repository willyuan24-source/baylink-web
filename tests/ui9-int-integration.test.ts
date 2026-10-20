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
const { CLOSE_UP_FACE_IMAGES, leadImageKey } = await import('../src/lib/close-up-faces');
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
  assert.ok(CLOSE_UP_FACE_IMAGES.has('official-r2-petaluma-lumafest-20261024'), 'LumaFest (four volunteers posing) is on it');
  assert.equal(leadImageKey('official-r2-petaluma-lumafest-20261024'), undefined);
  assert.equal(leadImageKey(undefined), undefined);
  assert.equal(leadImageKey('official-mcm-halloween-spectacular-20261031'), 'official-mcm-halloween-spectacular-20261031');
  // The home catalog no longer drops the photo (the acceptance review: /plan's 本周末精选 lost it); only the lead skips it.
  assert.doesNotMatch(readFileSync('scripts/generate-home-catalog.ts', 'utf8'), /CLOSE_UP_FACE_IMAGES/);
});

test('DECISIONS 15: the home lead draws its type cover for a face photo, the catalog and /plan keep the photo', () => {
  const byId = new Map(catalog.events.map(event => [event.id, event]));
  const faceDays = Object.keys(catalog.weekends).sort().filter(day => {
    const lead = byId.get(catalog.weekends[day].ids[0] ?? '');
    return !!lead?.imageKey && CLOSE_UP_FACE_IMAGES.has(lead.imageKey);
  });
  // LumaFest leads the home from 10/20 to 10/24, so a catalog built in that window must have such days.
  if (catalog.generatedAt <= '2026-10-24') assert.ok(faceDays.length > 0, 'the gate-day catalog has a face-photo lead');
  for (const day of faceDays.slice(0, 1)) {
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
