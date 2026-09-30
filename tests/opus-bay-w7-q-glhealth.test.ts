/**
 * W7-Q3 · a lost WebGL context (ui/glHealth.ts): preventDefault, the save written at once, one 重新载入 card; the
 * back / forward-cache return checks isContextLost; R3F's own forced loss after an unmount is ignored.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

type Fn = (e: unknown) => void;
function target() {
  const ls = new Map<string, Fn[]>();
  return {
    addEventListener(type: string, fn: Fn) { ls.set(type, [...(ls.get(type) ?? []), fn]); },
    removeEventListener(type: string, fn: Fn) { ls.set(type, (ls.get(type) ?? []).filter(f => f !== fn)); },
    fire(type: string, e: unknown = {}) { for (const fn of ls.get(type) ?? []) fn(e); },
    count(type: string) { return (ls.get(type) ?? []).length; },
  };
}
function fakeDom() {
  const made: Record<string, unknown>[] = [];
  const el = (tag: string) => {
    const t = target();
    const node: Record<string, unknown> = {
      tag, className: '', textContent: '', type: '', children: [] as unknown[], attrs: {} as Record<string, string>,
      setAttribute(k: string, v: string) { (node.attrs as Record<string, string>)[k] = v; },
      append(...c: unknown[]) { (node.children as unknown[]).push(...c); },
      remove() { node.removed = true; },
      focus() {},
      addEventListener: t.addEventListener, removeEventListener: t.removeEventListener, fire: t.fire,
    };
    made.push(node);
    return node;
  };
  const page = el('main');
  const docT = target();
  const doc = { visibilityState: 'visible', createElement: el, querySelector: (s: string) => (s === '.ob-page' ? page : null), body: el('body'), ...docT };
  return { doc, page, made };
}

async function setup(lost = { v: false }) {
  const { watchGl, glHealth, resetGlHealthForTests } = await import('../src/opus-bay/ui/glHealth');
  resetGlHealthForTests();
  const dom = fakeDom();
  const canvasT = target();
  const canvas = { isConnected: true, ...canvasT };
  const win = target();
  const gl = { domElement: canvas as unknown as HTMLCanvasElement, getContext: () => ({ isContextLost: () => lost.v }) as unknown as WebGL2RenderingContext };
  const off = watchGl(gl, win as unknown as Window, dom.doc as unknown as Document);
  return { glHealth, dom, canvas, win, off, lost };
}

test('W7-Q3 webglcontextlost: preventDefault, the save flushed, one 重新载入 card (a second loss adds no second card)', async () => {
  const { patchSave, readSave } = await import('../src/opus-bay/data/save');
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { window: g.window };
  const store = new Map<string, string>();
  const ls = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
  g.window = { localStorage: ls, location: { search: '' }, addEventListener() {} };
  try {
    const { glHealth, dom, canvas } = await setup();
    readSave();
    patchSave(s => { s.tours = { ...(s.tours ?? {}) }; });
    assert.equal(store.size, 0, 'the save waits 1 s of quiet');
    let prevented = false;
    canvas.fire('webglcontextlost', { preventDefault: () => { prevented = true; } });
    assert.ok(prevented, 'preventDefault');
    assert.equal(store.size, 1, 'the save was written at once');
    assert.equal(glHealth.lost, true);
    assert.equal(glHealth.losses, 1);
    const cards = (dom.page.children as { className: string }[]).filter(c => c.className === 'ob-gl-lost');
    assert.equal(cards.length, 1, 'the card is in .ob-page');
    const texts = JSON.stringify(dom.made.map(n => n.textContent));
    assert.ok(texts.includes('画面需要重新加载') && texts.includes('重新载入'), texts);
    canvas.fire('webglcontextlost', { preventDefault() {} });
    assert.equal((dom.page.children as unknown[]).length, 1, 'no second card');
    assert.equal(glHealth.losses, 2, 'counted for ?debug');
  } finally { g.window = saved.window; }
});

test('W7-Q3 a back / forward-cache return (pageshow persisted) with a lost context shows the card; a live one does not', async () => {
  const lost = { v: false };
  const { glHealth, win, dom } = await setup(lost);
  win.fire('pageshow', { persisted: true });
  assert.equal(glHealth.lost, false, 'the context is fine: nothing');
  win.fire('pageshow', { persisted: false });
  lost.v = true;
  win.fire('pageshow', { persisted: false });
  assert.equal(glHealth.lost, false, 'a fresh load is not checked');
  win.fire('pageshow', { persisted: true });
  assert.equal(glHealth.lost, true);
  assert.equal((dom.page.children as unknown[]).length, 1);
});

test('W7-Q3 a tab made visible again with a lost context shows the card', async () => {
  const lost = { v: true };
  const { glHealth, dom } = await setup(lost);
  dom.doc.fire('visibilitychange');
  assert.equal(glHealth.lost, true);
});

test('W7-Q3 R3F\'s forced loss after the Canvas unmounted is ignored, and the watch ends', async () => {
  const { glHealth, canvas, win, dom } = await setup();
  canvas.isConnected = false;
  let prevented = false;
  canvas.fire('webglcontextlost', { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
  assert.equal(glHealth.lost, false);
  assert.equal((dom.page.children as unknown[]).length, 0, 'no card on a page that left the game');
  assert.equal(canvas.count('webglcontextlost'), 0, 'listeners removed');
  assert.equal(win.count('pageshow'), 0);
  assert.equal(glHealth.gl, null);
});
