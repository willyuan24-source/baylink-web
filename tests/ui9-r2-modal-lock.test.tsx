// UI9-R2-MODAL-LOCK: an open dialog holds the page still. The viewport's overflow lives on <html> (design.css keeps
// `html { overflow-x:clip }`, so body's overflow never reached it), the lock keeps a classic scrollbar's gutter, nested
// dialogs release only at the outermost close, and DialogWait (the scrim while a dialog's chunk loads) takes the same lock,
// keeps it until the dialog that replaces it holds the page (locked once, no unlock in between), and releases it when the
// wait is cancelled or the chunk fails. Body and #scroll-container are left alone (overflow:hidden on them unsticks the
// sticky top bar and the guide rails).
import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element,
  Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// No error beacon from a test (ChunkBoundary reports what it catches; trackingAllowed() reads Do Not Track).
Object.defineProperty(dom.window.navigator, 'doNotTrack', { configurable: true, value: '1' });
// jsdom has no layout. Expose only connected, visible controls to the focus trap.
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
const { render, cleanup, act, fireEvent } = await import('@testing-library/react');
const { ModalShell } = await import('../src/components/ui/Modal');
const { DialogSlot } = await import('../src/components/ui/DialogWait');

const html = document.documentElement;
const microtask = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  document.body.innerHTML = '<div id="root"><button id="opener">Open</button><main id="scroll-container" tabindex="-1"></main></div>';
  html.removeAttribute('style');
  document.body.removeAttribute('style');
  // jsdom has no layout: give the page overlay scrollbars (no gutter to keep) unless a test says otherwise.
  Object.defineProperty(html, 'clientWidth', { configurable: true, get: () => window.innerWidth });
});
afterEach(async () => { cleanup(); await microtask(); delete (html as { clientWidth?: number }).clientWidth; });

const opener = () => document.getElementById('opener') as HTMLButtonElement;
const appRoot = () => document.getElementById('root')!;

test('an open dialog locks the viewport on <html>, leaves body alone, and restores the page on close', () => {
  html.style.overflow = 'clip';
  document.body.style.overflow = 'auto';
  opener().focus();
  const view = render(<ModalShell label="Dialog" onClose={() => {}}><button>Close</button></ModalShell>);
  assert.equal(html.style.overflow, 'hidden', 'the viewport cannot scroll');
  assert.equal(document.body.style.overflow, 'auto', 'body keeps its own value: overflow:hidden there would make it the sticky top bar\'s scroller');
  assert.equal(appRoot().inert, true);
  view.unmount();
  assert.equal(html.style.overflow, 'clip', 'the earlier inline value comes back');
  assert.equal(document.body.style.overflow, 'auto');
  assert.equal(appRoot().inert, false);
  assert.ok(document.activeElement === opener(), 'focus returns to the opener');
});

test('a classic scrollbar keeps its gutter while the page is locked, so nothing moves sideways', () => {
  Object.defineProperty(html, 'clientWidth', { configurable: true, get: () => window.innerWidth - 15 });
  const view = render(<ModalShell label="Dialog"><button>Close</button></ModalShell>);
  assert.equal(html.style.scrollbarGutter, 'stable');
  view.unmount();
  assert.equal(html.style.scrollbarGutter, '', 'the gutter is released with the lock');
  Object.defineProperty(html, 'clientWidth', { configurable: true, get: () => window.innerWidth });
  const overlay = render(<ModalShell label="Dialog"><button>Close</button></ModalShell>);
  assert.equal(html.style.scrollbarGutter, '', 'no gutter is added when the page had no classic scrollbar (overlay scrollbars, a short page)');
  overlay.unmount();
});

test('#scroll-container (a <main> in the page flow) is not turned into a scroll container', () => {
  const scroller = document.getElementById('scroll-container')!;
  const view = render(<ModalShell label="Dialog"><button>Close</button></ModalShell>);
  assert.equal(scroller.style.overflow, '', 'its sticky rails stay put behind the dialog');
  view.unmount();
  assert.equal(scroller.style.overflow, '');
});

test('two nested dialogs release the page only when the outermost one closes', () => {
  const base = <ModalShell key="base" label="Base"><button>Base</button></ModalShell>;
  const top = <ModalShell key="top" label="Top"><button>Top</button></ModalShell>;
  opener().focus();
  const view = render(<>{base}</>);
  view.rerender(<>{base}{top}</>);
  view.rerender(<>{base}</>);
  assert.equal(html.style.overflow, 'hidden', 'the inner close keeps the lock');
  assert.equal(appRoot().inert, true);
  view.unmount();
  assert.equal(html.style.overflow, '');
  assert.equal(appRoot().inert, false);
  assert.ok(document.activeElement === opener());
});

// A lazy dialog whose chunk the test lets arrive (or fail) when it wants.
function controlledDialog() {
  let resolve!: (module: { default: React.ComponentType<{ onClose: () => void; afterWait?: boolean }> }) => void;
  let reject!: (error: Error) => void;
  const Dialog = ({ onClose }: { onClose: () => void; afterWait?: boolean }) => <ModalShell label="Loaded dialog" onClose={onClose}><button>Inside</button></ModalShell>;
  const Lazy = React.lazy(() => new Promise<{ default: typeof Dialog }>((res, rej) => { resolve = res; reject = rej; }));
  return { slot: { current: () => ({ Dialog: Lazy, waits: true }) }, arrive: () => act(async () => { resolve({ default: Dialog }); }), fail: () => act(async () => { reject(new Error('chunk failed')); }) };
}
const wait = () => document.body.querySelector<HTMLElement>(':scope > .fixed.inset-0');

test('DialogWait locks the page while the chunk loads and keeps it locked, once, until the dialog has closed', async () => {
  const lazy = controlledDialog();
  opener().focus();
  // Every write to <html>'s style and to #root's inert between the tap and the close.
  const styles: (string | null)[] = [];
  const watch = new dom.window.MutationObserver(records => { for (const r of records) styles.push(r.oldValue); });
  watch.observe(html, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });
  const inertWrites: boolean[] = [];
  let inert = false;
  Object.defineProperty(appRoot(), 'inert', { configurable: true, get: () => inert, set: (value: boolean) => { inertWrites.push(value); inert = value; } });
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<DialogSlot dialog={lazy.slot} onFail={() => {}} props={{ onClose: () => {} }} />); });
  assert.ok(wait(), 'the scrim is up');
  assert.equal(html.style.overflow, 'hidden', 'no scrolling behind the scrim');
  assert.equal(appRoot().inert, true, 'the page cannot be used while the dialog loads');
  assert.ok(document.activeElement === opener(), 'focus is not moved by the wait (jsdom keeps it on the inert opener)');
  await lazy.arrive();
  await microtask();
  const dialog = view.getByRole('dialog', { name: 'Loaded dialog' });
  assert.equal(wait(), null, 'the wait is gone');
  assert.equal(html.style.overflow, 'hidden');
  assert.equal(appRoot().inert, true);
  assert.ok(dialog.contains(document.activeElement), 'focus moves in when the dialog appears');
  styles.push(...watch.takeRecords().map(r => r.oldValue));
  assert.deepEqual({ styles, inertWrites }, { styles: [null], inertWrites: [true] }, 'locked once by the wait: the dialog\'s lock nests inside it, with no unlock and relock in between');
  view.unmount();
  assert.equal(html.style.overflow, '');
  assert.equal(appRoot().inert, false);
  assert.ok(document.activeElement === opener(), 'closing returns focus to the opener');
  assert.deepEqual(inertWrites, [true, false]);
  watch.disconnect();
});

test('the opener the wait kept gets focus back even when the inert page dropped it (Chrome moves it to <body>)', async () => {
  const lazy = controlledDialog();
  opener().focus();
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<DialogSlot dialog={lazy.slot} onFail={() => {}} props={{ onClose: () => {} }} />); });
  opener().blur();
  assert.ok(document.activeElement === document.body);
  await lazy.arrive();
  assert.ok(view.getByRole('dialog').contains(document.activeElement));
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  view.unmount();
  assert.ok(document.activeElement === opener());
});

test('a cancelled wait releases the page and gives focus back to the opener', async () => {
  const lazy = controlledDialog();
  html.style.overflow = 'clip';
  opener().focus();
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<DialogSlot dialog={lazy.slot} onFail={() => {}} props={{ onClose: () => {} }} />); });
  assert.equal(html.style.overflow, 'hidden');
  opener().blur();
  view.unmount();
  await microtask();
  assert.equal(html.style.overflow, 'clip', 'released, with the earlier inline value back');
  assert.equal(appRoot().inert, false);
  assert.ok(document.activeElement === opener(), 'focus is back on the opener');
});

test('a wait whose chunk fails releases the page (onFail closes the slot)', async () => {
  const lazy = controlledDialog();
  opener().focus();
  const quiet = console.error;
  console.error = () => {};
  try {
    function Host() {
      const [open, setOpen] = React.useState(true);
      return open ? <DialogSlot dialog={lazy.slot} onFail={() => setOpen(false)} props={{ onClose: () => setOpen(false) }} /> : null;
    }
    await act(async () => { render(<Host />); });
    assert.equal(html.style.overflow, 'hidden');
    await lazy.fail();
    await microtask();
  } finally { console.error = quiet; }
  assert.equal(wait(), null);
  assert.equal(html.style.overflow, '');
  assert.equal(appRoot().inert, false);
  assert.ok(document.activeElement === opener());
});

test('a wait inside an open dialog keeps the outer lock and leaves it to the outer dialog', async () => {
  const lazy = controlledDialog();
  opener().focus();
  let view!: ReturnType<typeof render>;
  const outer = <ModalShell key="outer" label="Outer"><button>Outer</button></ModalShell>;
  await act(async () => { view = render(<>{outer}</>); });
  await act(async () => { view.rerender(<>{outer}<DialogSlot key="slot" dialog={lazy.slot} onFail={() => {}} props={{ onClose: () => {} }} /></>); });
  await act(async () => { view.rerender(<>{outer}</>); });
  await microtask();
  assert.equal(html.style.overflow, 'hidden', 'the outer dialog still holds the page');
  assert.equal(appRoot().inert, true);
  view.unmount();
  assert.equal(html.style.overflow, '');
  assert.ok(document.activeElement === opener());
});

test('under React.StrictMode (effects run, clean up and run again) the wait still holds the page, and lets go on cancel and on close', async () => {
  const strict = (lazy: ReturnType<typeof controlledDialog>) => <React.StrictMode><DialogSlot dialog={lazy.slot} onFail={() => {}} props={{ onClose: () => {} }} /></React.StrictMode>;
  // Cancelled: the doubled effect's deferred release does not leave the page locked or unlocked early.
  const cancelled = controlledDialog();
  opener().focus();
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(strict(cancelled)); });
  await microtask();
  assert.equal(html.style.overflow, 'hidden', 'the release of the first effect run is balanced by the second run');
  assert.equal(appRoot().inert, true);
  view.unmount();
  await microtask();
  assert.equal(html.style.overflow, '');
  assert.equal(appRoot().inert, false);
  assert.ok(document.activeElement === opener());
  // The chunk arrives: the dialog takes over the lock, and closing releases it.
  const lazy = controlledDialog();
  const styles: (string | null)[] = [];
  const watch = new dom.window.MutationObserver(records => { for (const r of records) styles.push(r.oldValue); });
  watch.observe(html, { attributes: true, attributeFilter: ['style'], attributeOldValue: true });
  await act(async () => { view = render(strict(lazy)); });
  await microtask();
  assert.equal(html.style.overflow, 'hidden');
  assert.equal(appRoot().inert, true);
  await lazy.arrive();
  await microtask();
  assert.equal(wait(), null);
  assert.ok(view.getByRole('dialog', { name: 'Loaded dialog' }).contains(document.activeElement));
  assert.equal(html.style.overflow, 'hidden');
  assert.equal(appRoot().inert, true);
  styles.push(...watch.takeRecords().map(r => r.oldValue));
  watch.disconnect();
  assert.equal(styles.length, 1, 'locked once: the replayed effects never unlock and relock the page');
  view.unmount();
  await microtask();
  assert.equal(html.style.overflow, '');
  assert.equal(appRoot().inert, false);
  assert.ok(document.activeElement === opener(), 'focus is back on the opener');
});
