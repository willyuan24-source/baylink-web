import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

/**
 * Mount guards (WEB-SAVES, plan D19) for the /events event cards (UI9-EVENTS): the weekend feed's cards and the picks' hero
 * cards carry the one save model's ♡ on the cover. UI9-PREP split this out of tests/save-mounts.test.tsx (the offer and
 * new-shop boards stay there, UI9-FREE); the assertions are unchanged.
 */
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/events' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, act, waitFor, fireEvent, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { EventsShell } = await import('../src/features/events/EventsShell');
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
const allHeartsReady = (view: ReturnType<typeof render>) => waitFor(() => {
  assert.ok((view.getAllByRole('button', { name: /^收藏：/ }) as HTMLButtonElement[]).every(button => !button.disabled));
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

test('event cards keep their ♡ in the cover slot: EventCards.tsx has no under-card ♡ placement', () => {
  assert.doesNotMatch(readFileSync('src/features/events/EventCards.tsx', 'utf8'), /className="ev-card--action"/, 'event cards keep the overlay placement');
});
