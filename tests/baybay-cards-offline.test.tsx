import './baybay-test-transport';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import React from 'react';

// The answer cards are their own chunk. While `offline` is set, every import of it fails the way a chunk fetch does when
// the reader has gone offline or a deploy renamed the file (each attempt is its own module, so no failure is cached).
let offline = true, attempts = 0;
registerHooks({ resolve(specifier, context, next) {
  const resolved = next(specifier, context);
  if (!offline || !/\/features\/baybay\/BayBayCards\.tsx$/.test(resolved.url)) return resolved;
  attempts += 1;
  return { url: `data:text/javascript,throw new Error("Failed to fetch dynamically imported module (${attempts})")`, shortCircuit: true };
} });

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, waitFor } = await import('@testing-library/react');
const { BayBayCardRail } = await import('../src/features/baybay/BayBayAnswer');
const { BayBaySaveScope } = await import('../src/features/baybay/BayBaySaveScope');
afterEach(() => { cleanup(); });

const card = { kind: 'event' as const, id: 'santa-clara-library-comic-con-2026', title: 'Santa Clara 图书馆免费 Comic Con', url: '/events/santa-clara-library-comic-con-2026', summary: '', date: '2026-10-10', temporalStatus: 'upcoming' };
/** Waits for a DOM condition; a cheap Error while polling (asserting on DOM nodes would inspect them on every poll). */
const until = (ready: () => boolean, what: string) => waitFor(() => { if (!ready()) throw new Error(`still waiting: ${what}`); }, { timeout: 5000 });

test('when the card chunk cannot load, the cards become plain links instead of an endless placeholder, and load once back online', async () => {
  const paths: string[] = [];
  const view = render(<BayBaySaveScope><BayBayCardRail cards={[card, { ...card }]} today="2026-10-09" onNavigate={path => paths.push(path)} /></BayBaySaveScope>);
  const $ = (selector: string) => view.baseElement.querySelector(selector);
  assert.ok($('.bb-cards--loading'), 'a placeholder holds the space while the chunk loads');
  // The first failure retries once after a second (like the app's lazy panels); then the fallback shows.
  await until(() => !$('.bb-cards--loading'), 'the placeholder to go');
  assert.equal(attempts, 2, 'the chunk was tried twice before the fallback');
  assert.ok(view.getByRole('list', { name: '相关活动与去处' }).hasAttribute('data-fallback'));
  assert.equal(view.getAllByRole('link').length, 1, 'one link per listing');
  fireEvent.click(view.getByRole('link', { name: 'Santa Clara 图书馆免费 Comic Con' }));
  assert.deepEqual(paths, ['/events/santa-clara-library-comic-con-2026'], 'the fallback link opens the listing inside the app');

  // Back online: the rail tries again and the image cards replace the links.
  offline = false;
  dom.window.dispatchEvent(new dom.window.Event('online'));
  await until(() => !!$('.bb-cards [data-card-key="event:santa-clara-library-comic-con-2026"]'), 'the image card');
  assert.equal($('[data-fallback]'), null);
  assert.equal($('.bb-cards--loading'), null);
  // The ♡ on the image card is the one save model (a guest's list is known at once).
  await until(() => !!$('.bb-card__save:not(:disabled)'), 'the save button');
  assert.ok(view.getByRole('button', { name: /^收藏：Santa Clara/ }));
});
