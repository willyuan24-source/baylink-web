import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/plan' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { default: PlannerPage } = await import('../src/pages/PlannerPage');
const { PlannerPlaceRecommendations } = await import('../src/components/PlannerPlaceRecommendations');
const { PLANNER_PLACES } = await import('../src/data/planner-catalog');
const { GUIDE_IMAGES } = await import('../src/data/guide-media');
const { resolveCovers } = await import('../src/lib/cover');
const { stopCoverImage, stopCoverItem } = await import('../src/lib/plan-stop-cover');
const { api } = await import('../src/lib/api');
const originalRequest = api.request;

beforeEach(context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-05T19:00:00Z') });
  localStorage.clear();
  api.request = async endpoint => { throw new Error(`Unexpected API call: ${endpoint}`); };
});
afterEach(() => { cleanup(); localStorage.clear(); api.request = originalRequest; });

test('new-shop recommendations show known official media, and a ③ 示意图 (never AI art) when only AI art exists', () => {
  const openings = PLANNER_PLACES.filter(place => place.id.startsWith('opening-'));
  const illustrated = openings.find(place => place.imageKey && GUIDE_IMAGES[place.imageKey]?.kind === 'illustration')!;
  const photographed = openings.find(place => place.imageKey && ['photo', 'poster'].includes(GUIDE_IMAGES[place.imageKey]?.kind))!;
  assert.ok(illustrated && photographed, 'exercise both real catalog cases');
  const view = render(<MemoryRouter><PlannerPlaceRecommendations
    suggestions={[illustrated, photographed].map(place => ({ id: `media-${place.id}`, placeId: place.id, date: '2026-10-05', reason: 'Official source available', reasons: [], unknowns: [] }))}
    filters={{}} message="" onChoose={() => {}} onStart={() => {}}
    covers={resolveCovers([illustrated, photographed].map(place => stopCoverItem({ kind: 'place', id: place.id })), { images: stopCoverImage, today: '2026-10-05' })}
  /></MemoryRouter>);
  const cards = [...view.container.querySelectorAll('article.planner-option')];
  const textCard = cards.find(card => card.querySelector('h3')?.textContent === illustrated.title)!;
  const photoCard = cards.find(card => card.querySelector('h3')?.textContent === photographed.title)!;
  assert.ok(textCard.querySelector(`a[href="${illustrated.officialUrl}"]`));
  // UI9-IMAGES DECISIONS 21/22: the shop's own AI art ranks after its category's stock photos, so the card shows a ③ photo
  // labelled 示意图 — never the AI art and never an information card. (Compare src strings: a failing assert on a jsdom node
  // makes node:test inspect the whole window and stall.)
  const textImage = textCard.querySelector('img')?.getAttribute('src') ?? '';
  assert.match(textImage, /\/category-stock\//);
  assert.notEqual(textImage, GUIDE_IMAGES[illustrated.imageKey!].src);
  assert.equal(textCard.querySelector('[data-cover="type"]') === null, true);
  assert.equal(textCard.querySelector('.ui-provenance')?.textContent, '示意图');
  assert.match(textCard.textContent || '', /费用待确认/);
  assert.equal(photoCard.querySelector('img')?.getAttribute('src'), GUIDE_IMAGES[photographed.imageKey!].src);
});

test('planner shop catalog shows a picture on every row: own photo or a ③ stock photo, never AI art or an information card', async () => {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<MemoryRouter initialEntries={['/plan?date=2026-10-05']}><PlannerPage /></MemoryRouter>); });
  fireEvent.click(view.getByRole('button', { name: '商店', exact: true }));
  const cards = [...view.container.querySelectorAll('.planner-catalog .planner-place')];
  assert.ok(cards.length > 0);
  const illustratedSources = new Set(Object.values(GUIDE_IMAGES).filter(image => image.kind === 'illustration').map(image => image.src));
  for (const card of cards) {
    for (const image of card.querySelectorAll('img')) assert.ok(!illustratedSources.has(image.getAttribute('src') || ''), card.querySelector('h3')?.textContent || 'shop');
    assert.ok(card.querySelector('h3')?.textContent);
    // Every row shows a picture (DECISIONS 21): the shop's own photo, else a ③ stock photo of its kind — never AI art and
    // never an information card.
    assert.equal(card.querySelectorAll('.ui-row-card__thumb [data-cover="image"] img').length, 1, card.querySelector('h3')?.textContent || 'shop');
    assert.equal(card.querySelector('[data-cover="type"]') === null, true, card.querySelector('h3')?.textContent || 'shop');
  }
  assert.ok(cards.some(card => /\/category-stock\//.test(card.querySelector('img')?.getAttribute('src') ?? '')), 'a shop with no official image shows a ③ stock photo');
});
