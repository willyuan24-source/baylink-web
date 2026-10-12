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
const { render, cleanup, act, waitFor, fireEvent, within } = await import('@testing-library/react');
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
/**
 * Each card (an `article` named by its heading) with its title and the ♡ buttons inside it, found by role and accessible
 * name (§3.0 rule 9): "收藏：<title>" before a save, "已收藏：<title>" after.
 */
const cardsWithHearts = (view: ReturnType<typeof render>) => view.getAllByRole('article').map(card => ({
  card,
  title: within(card).getByRole('heading', { level: 3 }).textContent ?? '',
  hearts: within(card).queryAllByRole('button', { name: /^(已)?收藏：/ }) as HTMLButtonElement[],
}));
const assertOneNamedHeartPerCard = (view: ReturnType<typeof render>, what: string) => {
  const cards = cardsWithHearts(view);
  assert.ok(cards.length > 0, `${what} cards render`);
  for (const { title, hearts } of cards) {
    assert.deepEqual(hearts.map(button => button.getAttribute('aria-label')), [`收藏：${title}`], `one ♡ on the ${what} card "${title}", named after it`);
  }
  return cards;
};
const allHeartsReady = (view: ReturnType<typeof render>) => waitFor(() => {
  assert.ok((view.getAllByRole('button', { name: /^收藏：/ }) as HTMLButtonElement[]).every(button => !button.disabled));
});

test('every offer card on the freebie board has its ♡, named after the card, and it saves the offer', async () => {
  const offers = currentFreebies.slice(0, 4);
  const view = render(<MemoryRouter><FreebieBoard offers={offers} today="2026-10-11" /></MemoryRouter>);
  assertOneNamedHeartPerCard(view, 'offer');
  await allHeartsReady(view);
  const [first] = cardsWithHearts(view);
  const id = offers.find(offer => offer.title === first.title)?.id;
  assert.ok(id, `the first card is one of the offers: ${first.title}`);
  await act(async () => { fireEvent.click(within(first.card).getByRole('button', { name: `收藏：${first.title}` })); });
  assert.deepEqual(guestSaves(), [`offer:${id}`]);
  assert.equal(within(first.card).getByRole('button', { name: `已收藏：${first.title}` }).getAttribute('aria-pressed'), 'true');
});

test('every new-shop card has its ♡, named after the shop, and it saves the opening', async () => {
  const view = render(<MemoryRouter><MonthlyOpenings today="2026-10-11" /></MemoryRouter>);
  assertOneNamedHeartPerCard(view, 'new-shop');
  await allHeartsReady(view);
  const [first] = cardsWithHearts(view);
  const shopId = within(first.card).getByRole('link', { name: first.title }).getAttribute('href')!.replace('/openings/', '');
  await act(async () => { fireEvent.click(within(first.card).getByRole('button', { name: `收藏：${first.title}` })); });
  assert.deepEqual(guestSaves(), [`opening:${shopId}`]);
  assert.equal(within(first.card).getByRole('button', { name: `已收藏：${first.title}` }).getAttribute('aria-pressed'), 'true');
});
