import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

/**
 * Mount guards (WEB-SAVES, plan D19): the offer cards and the new-shop cards carry the one save model's ♡, each saving
 * its own kind. WEB-EVENTS rewrote these cards (`OfferFeedCard` / `OpeningFeedCard` in src/features/events/EventCards.tsx,
 * on the 免费与优惠 and 新店 boards); the ♡ moved with them and this test follows, so offers and new shops stay
 * saveable. The freebie board guides still render keeps its own ♡. The calendar's 加入这天计划 has the same guard in
 * tests/event-calendar-ui.test.tsx.
 */
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/events' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, act, waitFor, fireEvent, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { FreebieBoard } = await import('../src/components/FreebieBoard');
const { default: PerksView } = await import('../src/features/events/PerksView');
const { default: OpeningsView } = await import('../src/features/events/OpeningsView');
const { EventsShell } = await import('../src/features/events/EventsShell');
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
  // A card's own title: h3 on the events boards, h4 under its kind's h3 on the guides' deals board (G26).
  title: within(card).getAllByRole('heading')[0].textContent ?? '',
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

// H31 (EVT13-10, FCC-04, SV13-10): /events cards — the weekend feed and the picks' hero cards — carry the same ♡ in the
// cover's save slot as the home feed, so a reader saves from the list in one tap; the offer and new-shop cards' ♡ sits on
// the cover too (no outlined 收藏 button under the card, no `ev-card--action` placement).
test('every event card on /events — feed and picks — has its ♡ on the cover, named after the card, and one tap saves the event', async () => {
  const view = render(<MemoryRouter initialEntries={['/events']}><EventsShell today="2026-10-13" /></MemoryRouter>);
  const cards = view.getAllByRole('article').filter(card => card.matches('.ui-feed-card,.ui-hero-card')).map(card => ({
    card, title: within(card).getAllByRole('heading')[0].textContent ?? '',
    hearts: within(card).queryAllByRole('button', { name: /^(已)?收藏：/ }) as HTMLButtonElement[],
  }));
  assert.ok(cards.some(({ card }) => card.matches('.ui-feed-card')) && cards.some(({ card }) => card.matches('.ui-hero-card')), 'feed and hero cards render');
  for (const { card, title, hearts } of cards) {
    assert.deepEqual(hearts.map(button => button.getAttribute('aria-label')), [`收藏：${title}`], `one ♡ on "${title}"`);
    assert.ok(hearts[0].closest('.ui-feed-card__save,.ui-hero-card__save'), `"${title}": the ♡ is in the cover's save slot`);
    assert.ok(!card.matches('.ev-card--action'), `"${title}": not the calendar's under-card placement`);
  }
  await allHeartsReady(view);
  const first = cards.find(({ card }) => card.matches('.ui-feed-card'))!;
  const eventId = within(first.card).getByRole('link', { name: first.title }).getAttribute('href')!.replace('/events/', '').split('?')[0];
  await act(async () => { fireEvent.click(within(first.card).getByRole('button', { name: `收藏：${first.title}` })); });
  assert.deepEqual(guestSaves(), [`event:${eventId}`]);
  assert.equal(within(first.card).getByRole('button', { name: `已收藏：${first.title}` }).getAttribute('aria-pressed'), 'true');
});

test('offer and new-shop cards put their ♡ in the cover\'s save slot, like event cards', async () => {
  for (const board of [<PerksView key="perks" today="2026-10-11" region="all" />, <OpeningsView key="openings" today="2026-10-11" region="all" />]) {
    const view = render(<MemoryRouter>{board}</MemoryRouter>);
    const cards = cardsWithHearts(view);
    assert.ok(cards.length > 0);
    for (const { card, hearts } of cards) {
      assert.ok(!card.matches('.ev-card--action'));
      assert.ok(hearts[0]?.closest('.ui-feed-card__save'));
    }
    cleanup();
  }
});

test('the cover ♡ is one 44px circle in every card save slot (reader-library.css), not the outlined 收藏 button', () => {
  // Any rule for the save toggle in both card save slots, whatever its selector's exact form or its declarations' order:
  // the circle (control-height square, 50% radius) with the icon alone (size-0 word).
  const declarations = new Map<string, string>();
  postcss.parse(readFileSync('src/components/reader-library.css', 'utf8')).walkRules(rule => {
    if (!['.ui-feed-card__save', '.ui-hero-card__save', '.saves-toggle'].every(part => rule.selector.includes(part))) return;
    rule.walkDecls(decl => { declarations.set(decl.prop, decl.value); });
  });
  assert.ok(declarations.size, 'a global rule styles the ♡ in the FeedCard and HeroCard save slots');
  for (const prop of ['width', 'height', 'min-height']) assert.equal(declarations.get(prop), 'var(--control-height)', `${prop}: the 44px control`);
  assert.equal(declarations.get('border-radius'), '50%');
  assert.equal(declarations.get('font-size'), '0', 'the icon alone; the name is the aria-label');
  assert.doesNotMatch(readFileSync('src/features/events/EventCards.tsx', 'utf8'), /className="ev-card--action"/, 'offers and openings keep the overlay placement');
});

test('every offer card on the 免费与优惠 board has its ♡, named after the card, and it saves the offer', async () => {
  const view = render(<MemoryRouter><PerksView today="2026-10-11" region="all" /></MemoryRouter>);
  assertOneNamedHeartPerCard(view, 'offer');
  await allHeartsReady(view);
  const [first] = cardsWithHearts(view);
  const offerId = within(first.card).getByRole('link', { name: first.title }).getAttribute('href')!.replace('/offers/', '');
  await act(async () => { fireEvent.click(within(first.card).getByRole('button', { name: `收藏：${first.title}` })); });
  assert.deepEqual(guestSaves(), [`offer:${offerId}`]);
  assert.equal(within(first.card).getByRole('button', { name: `已收藏：${first.title}` }).getAttribute('aria-pressed'), 'true');
});

test('every new-shop card on the 新店 board has its ♡, named after the shop, and it saves the opening', async () => {
  const view = render(<MemoryRouter><OpeningsView today="2026-10-11" region="all" /></MemoryRouter>);
  assertOneNamedHeartPerCard(view, 'new-shop');
  await allHeartsReady(view);
  const [first] = cardsWithHearts(view);
  const shopId = within(first.card).getByRole('link', { name: first.title }).getAttribute('href')!.replace('/openings/', '');
  await act(async () => { fireEvent.click(within(first.card).getByRole('button', { name: `收藏：${first.title}` })); });
  assert.deepEqual(guestSaves(), [`opening:${shopId}`]);
  assert.equal(within(first.card).getByRole('button', { name: `已收藏：${first.title}` }).getAttribute('aria-pressed'), 'true');
});
