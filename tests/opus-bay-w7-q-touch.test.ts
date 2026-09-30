/**
 * W7-Q6 · iOS touch guards (ui/iosTouch.ts): WebKit's pinch events are cancelled; a page left scrolled by the keyboard
 * (the map search) goes back to 0, 0 once nothing is typed in; the CSS carries the callout / text-size / pan rules.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function fakes() {
  const ls = new Map<string, ((e: Event) => void)[]>();
  const vls = new Map<string, (() => void)[]>();
  const doc = {
    activeElement: null as { tagName: string } | null,
    documentElement: { scrollTop: 0 },
    addEventListener(t: string, fn: (e: Event) => void) { ls.set(t, [...(ls.get(t) ?? []), fn]); },
    removeEventListener(t: string, fn: (e: Event) => void) { ls.set(t, (ls.get(t) ?? []).filter(f => f !== fn)); },
    fire(t: string, e: Partial<Event> = {}) { for (const fn of ls.get(t) ?? []) fn(e as Event); },
    count(t: string) { return (ls.get(t) ?? []).length; },
  };
  const scrolls: [number, number][] = [];
  const win = {
    scrollX: 0, scrollY: 0,
    scrollTo(x: number, y: number) { scrolls.push([x, y]); win.scrollY = y; win.scrollX = x; },
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number,
    clearTimeout: (id: number) => clearTimeout(id),
    visualViewport: {
      offsetTop: 0,
      addEventListener(t: string, fn: () => void) { vls.set(t, [...(vls.get(t) ?? []), fn]); },
      removeEventListener(t: string, fn: () => void) { vls.set(t, (vls.get(t) ?? []).filter(f => f !== fn)); },
      fire(t: string) { for (const fn of vls.get(t) ?? []) fn(); },
    },
  };
  return { doc, win, scrolls };
}
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

test('W7-Q6 pinch (gesturestart / gesturechange) is cancelled; the disposer removes every listener', async () => {
  const { installIosTouchGuards } = await import('../src/opus-bay/ui/iosTouch');
  const { doc, win } = fakes();
  const off = installIosTouchGuards(win, doc);
  let n = 0;
  doc.fire('gesturestart', { preventDefault: () => { n++; } });
  doc.fire('gesturechange', { preventDefault: () => { n++; } });
  assert.equal(n, 2);
  off();
  for (const t of ['gesturestart', 'gesturechange', 'focusout']) assert.equal(doc.count(t), 0, t);
});

test('W7-Q6 the map search keyboard closed with the page shifted up: back to 0, 0 (not while still typing)', async () => {
  const { installIosTouchGuards } = await import('../src/opus-bay/ui/iosTouch');
  const { doc, win, scrolls } = fakes();
  const off = installIosTouchGuards(win, doc);
  try {
    // typing: iOS scrolled the layout viewport to show the input; the viewport shrinks — nothing is moved
    doc.activeElement = { tagName: 'INPUT' };
    win.scrollY = 180;
    win.visualViewport.fire('resize');
    await wait(160);
    assert.deepEqual(scrolls, []);
    // the keyboard closes: the input loses focus
    doc.activeElement = null;
    doc.fire('focusout');
    await wait(160);
    assert.deepEqual(scrolls, [[0, 0]]);
    // nothing shifted: no scroll call
    win.visualViewport.fire('resize');
    await wait(160);
    assert.equal(scrolls.length, 1);
    // a visual-viewport offset alone (iOS) also counts
    win.visualViewport.offsetTop = 40;
    win.visualViewport.fire('resize');
    await wait(160);
    assert.equal(scrolls.length, 2);
  } finally { off(); }
});

test('W7-Q6 the CSS: touch-callout none on the game, text-size-adjust 100%, pan-y / pan-x on the scrollers, the album photo long-pressable', () => {
  const css = fs.readFileSync('src/opus-bay/opus-bay.css', 'utf8');
  assert.match(css, /\.ob-root \{[^}]*-webkit-touch-callout: none/);
  assert.match(css, /\.ob-page \{[^}]*-webkit-text-size-adjust: 100%; text-size-adjust: 100%/);
  assert.match(css, /\.ob-root :where\([^)]*\.ob-sheet-body[^)]*\) \{ touch-action: pan-y; \}/);
  assert.match(css, /\.ob-root :where\([^)]*\.mw-chips[^)]*\) \{ touch-action: pan-x; \}/);
  const album = fs.readFileSync('src/opus-bay/ui/album.css', 'utf8');
  assert.match(album, /\.ob-album-press \.ob-album-photo img \{ -webkit-touch-callout: default/);
  const page = fs.readFileSync('src/opus-bay/OpusBayPage.tsx', 'utf8');
  assert.match(page, /installIosTouchGuards\(\)/);
});
