// Followup 41 (UI9-R2 batch 2): OverlayHost's chunk waits are DialogWait. While the post, sign-in, ad or profile dialog's
// chunk loads, the scrim holds the page as the dialog will (the viewport locked on <html>, #root inert), and a wait that
// ends without its dialog (closed before the chunk arrived) gives the page and the opener's focus back.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element,
  Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.defineProperty(dom.window.navigator, 'doNotTrack', { configurable: true, value: '1' });
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
const { render, cleanup, act } = await import('@testing-library/react');
const { OverlayHost } = await import('../src/app/OverlayHost');

const html = document.documentElement;
const microtask = () => act(async () => { await Promise.resolve(); });
const opener = () => document.getElementById('opener') as HTMLButtonElement;
const appRoot = () => document.getElementById('root')!;
const wait = () => document.body.querySelector<HTMLElement>(':scope > .fixed.inset-0');

beforeEach(() => {
  document.body.innerHTML = '<div id="root"><button id="opener">Open</button></div>';
  html.removeAttribute('style');
  Object.defineProperty(html, 'clientWidth', { configurable: true, get: () => window.innerWidth });
});
afterEach(async () => { cleanup(); await microtask(); delete (html as { clientWidth?: number }).clientWidth; });

const noop = () => {};
const ref = { current: null };
// Every overlay closed; each case opens one.
const closed = {
  locationKey: 'k', user: null, socket: null, blockedUserIds: [], showToast: noop, navigate: noop, toast: null, closeToast: noop,
  ad: { item: null, close: noop, isAdmin: false },
  search: { open: false, query: '', openerRef: ref, close: noop, onSearch: noop, onAsk: noop },
  baybay: { open: false, loaded: false, scope: 's', sessionKey: 's', openerRef: ref, pendingQuestion: null, pendingQuestionId: 0, currentPath: '/', showLogin: false, onLoginNeeded: noop, onOpenChange: noop, onPendingQuestionConsumed: noop, onCreatePost: noop },
  login: { open: false, close: noop, onLogin: noop, onForgotPassword: noop },
  forgotPassword: { open: false, close: noop },
  resetPassword: { token: null, close: noop, onSuccess: noop },
  create: { open: false, editingPost: null, initialIntent: '', close: noop, onSaved: noop, onManageAvailability: noop },
  post: { selected: null, loading: false, missing: false, error: null, refreshing: false, close: noop, retry: noop, detail: {} },
  chat: { conversation: null, ready: false, close: noop, onViewProfile: noop, onReportMessage: noop, onToggleBlockUser: noop },
  profile: { close: noop, card: {} },
  blockedUsers: { open: false, close: noop, onUnblock: async () => {} },
  report: { target: null, close: noop, onSubmit: async () => {} },
  image: { src: null, close: noop },
  share: { post: null, close: noop },
};
const post = { id: 'p1', title: 'Post', type: 'service' };
const cases: [string, Record<string, unknown>][] = [
  ['post', { post: { ...closed.post, id: 'p1', selected: post } }],
  ['sign-in', { login: { ...closed.login, open: true } }],
  ['ad', { ad: { ...closed.ad, item: { id: 'a1', title: 'Ad' } } }],
  ['profile', { profile: { ...closed.profile, userId: 'u1' } }],
];

for (const [name, open] of cases) {
  test(`the ${name} dialog's chunk wait locks <html> and #root, then gives the page and focus back`, async () => {
    html.style.overflow = 'clip';
    opener().focus();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = render(<OverlayHost {...(closed as any)} {...open} />);
    assert.ok(wait(), 'the scrim is up while the chunk loads');
    assert.ok(wait()!.querySelector('.site-chunk-disc .site-chunk-spinner'), 'DialogWait\'s token disc and spinner');
    assert.equal(html.style.overflow, 'hidden', 'no scrolling behind the scrim');
    assert.equal(appRoot().inert, true, 'the page cannot be used behind it');
    view.unmount();
    await microtask();
    assert.equal(wait(), null);
    assert.equal(html.style.overflow, 'clip', 'the earlier inline value comes back');
    assert.equal(appRoot().inert, false);
    assert.ok(document.activeElement === opener(), 'focus is back on the opener');
  });
}

test('OverlayHost has no chunk fallback of its own: its dialogs wait in DialogWait', () => {
  const source = readFileSync('src/app/OverlayHost.tsx', 'utf8');
  assert.doesNotMatch(source, /OverlayChunkFallback/);
  assert.match(source, /fallback: ReactNode = <DialogWait \/>/);
  assert.match(readFileSync('src/components/ui/DialogWait.tsx', 'utf8'), /<span className="site-chunk-disc">/);
});
