import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

/**
 * Mount guards (WEB-SAVES, plan D19): the offer cards and the new-shop cards carry the one save model's ♡, each saving
 * its own kind. A lane that rewrites these cards (WEB-EVENTS: `OfferFeedCard` / `OpeningFeedCard` in
 * src/features/events/EventCards.tsx) moves the ♡ with them and ports this test, so offers and new shops stay
 * saveable. The calendar's 加入这天计划 has the same guard in tests/event-calendar-ui.test.tsx.
 */
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/events' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, act, waitFor, fireEvent } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { FreebieBoard } = await import('../src/components/FreebieBoard');
const { MonthlyOpenings } = await import('../src/components/MonthlyOpenings');
const { currentFreebies } = await import('../src/data/october-offers');
const { api } = await import('../src/lib/api');
const { resetSaveStore, savesKey } = await import('../src/lib/saves');
const { setLocale } = await import('../src/i18n/locale');

beforeEach(async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  t.mock.method(api, 'request', async () => { throw new Error('Guests must not call an account API'); });
  await setLocale('zh-Hans', false);
});
afterEach(() => { cleanup(); localStorage.clear(); resetSaveStore(); });
after(() => dom.window.close());

const guestSaves = () => (JSON.parse(localStorage.getItem(savesKey()) || '{"items":[]}').items as { kind: string; id: string }[]).map(item => `${item.kind}:${item.id}`);
const hearts = (root: ParentNode, card: string) => [...root.querySelectorAll(card)].map(element => element.querySelector('button.saves-toggle') as HTMLButtonElement | null);

test('every offer card on the freebie board has its ♡, named after the card, and it saves the offer', async () => {
  const offers = currentFreebies.slice(0, 4);
  const view = render(<MemoryRouter><FreebieBoard offers={offers} today="2026-10-11" /></MemoryRouter>);
  const cards = hearts(view.container, '.bl-freebie-card');
  assert.ok(cards.length > 0);
  assert.ok(cards.every(Boolean), 'one ♡ per offer card');
  await waitFor(() => assert.ok(hearts(view.container, '.bl-freebie-card').every(button => !button!.disabled)));
  const first = hearts(view.container, '.bl-freebie-card')[0]!;
  const id = offers.find(offer => first.getAttribute('aria-label') === `收藏：${offer.title}`)?.id;
  assert.ok(id, `the ♡ is named after its card: ${first.getAttribute('aria-label')}`);
  await act(async () => { fireEvent.click(first); });
  assert.deepEqual(guestSaves(), [`offer:${id}`]);
});

test('every new-shop card has its ♡, named after the shop, and it saves the opening', async () => {
  const view = render(<MemoryRouter><MonthlyOpenings today="2026-10-11" /></MemoryRouter>);
  const cards = hearts(view.container, '.bl-opening-card');
  assert.ok(cards.length > 0);
  assert.ok(cards.every(Boolean), 'one ♡ per new-shop card');
  await waitFor(() => assert.ok(hearts(view.container, '.bl-opening-card').every(button => !button!.disabled)));
  const card = view.container.querySelector('.bl-opening-card')!;
  const shopId = card.querySelector('h3 a')!.getAttribute('href')!.replace('/openings/', '');
  const heart = card.querySelector('button.saves-toggle') as HTMLButtonElement;
  assert.equal(heart.getAttribute('aria-label'), `收藏：${card.querySelector('h3')!.textContent}`);
  await act(async () => { fireEvent.click(heart); });
  assert.deepEqual(guestSaves(), [`opening:${shopId}`]);
  assert.equal(heart.getAttribute('aria-pressed'), 'true');
});
