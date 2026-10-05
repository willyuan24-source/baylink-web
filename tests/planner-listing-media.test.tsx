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
const { api } = await import('../src/lib/api');
const originalRequest = api.request;

beforeEach(context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-05T19:00:00Z') });
  localStorage.clear();
  api.request = async endpoint => { throw new Error(`Unexpected API call: ${endpoint}`); };
});
afterEach(() => { cleanup(); localStorage.clear(); api.request = originalRequest; });

test('new-shop recommendations show known official media and preserve text/source when only AI art exists', () => {
  const openings = PLANNER_PLACES.filter(place => place.id.startsWith('opening-'));
  const illustrated = openings.find(place => place.imageKey && GUIDE_IMAGES[place.imageKey]?.kind === 'illustration')!;
  const photographed = openings.find(place => place.imageKey && ['photo', 'poster'].includes(GUIDE_IMAGES[place.imageKey]?.kind))!;
  assert.ok(illustrated && photographed, 'exercise both real catalog cases');
  const view = render(<MemoryRouter><PlannerPlaceRecommendations
    suggestions={[illustrated, photographed].map(place => ({ id: `media-${place.id}`, placeId: place.id, date: '2026-10-05', reason: 'Official source available', reasons: [], unknowns: [] }))}
    filters={{}} message="" onChoose={() => {}} onStart={() => {}}
  /></MemoryRouter>);
  const cards = [...view.container.querySelectorAll('article.planner-option')];
  const textCard = cards.find(card => card.querySelector('h3')?.textContent === illustrated.title)!;
  const photoCard = cards.find(card => card.querySelector('h3')?.textContent === photographed.title)!;
  assert.ok(textCard.querySelector(`a[href="${illustrated.officialUrl}"]`));
  assert.equal(textCard.querySelector('img'), null);
  assert.match(textCard.textContent || '', /费用待确认/);
  assert.equal(photoCard.querySelector('img')?.getAttribute('src'), GUIDE_IMAGES[photographed.imageKey!].src);
});

test('planner shop catalog never restores an illustration for a text-only new-shop card', async () => {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<MemoryRouter initialEntries={['/plan?date=2026-10-05']}><PlannerPage /></MemoryRouter>); });
  fireEvent.click(view.getByRole('button', { name: '商店', exact: true }));
  const cards = [...view.container.querySelectorAll('.planner-catalog article.planner-place')];
  assert.ok(cards.length > 0);
  const illustratedSources = new Set(Object.values(GUIDE_IMAGES).filter(image => image.kind === 'illustration').map(image => image.src));
  for (const card of cards) {
    for (const image of card.querySelectorAll('img')) assert.ok(!illustratedSources.has(image.getAttribute('src') || ''), card.querySelector('h3')?.textContent || 'shop');
    assert.ok(card.querySelector('h3')?.textContent);
  }
  assert.ok(cards.some(card => !card.querySelector('img')), 'missing official shop images keep a useful text card');
});
