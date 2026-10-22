// UI9-R1-OVERLAYS (cold review round 1: N10 / N11 / N13 / N24): every overlay enters and leaves (an exit of at least 120 ms,
// at once under reduced motion and in 简洁显示), saves confirm on the one Toast, overlays sit on the one scrim without blur,
// and their close buttons share F's look.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { GuideImage } from '../src/data/guide-media';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.defineProperty(dom.window.HTMLElement.prototype, 'getClientRects', { configurable: true, value: function (this: HTMLElement) { return this.isConnected ? [this.getBoundingClientRect()] : []; } });
// A screen that plays motion unless a test turns reduced motion on.
let reduced = false;
dom.window.matchMedia = ((query: string) => ({
  matches: query.includes('reduced-motion') ? reduced : false,
  media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
})) as unknown as typeof dom.window.matchMedia;

const { render, fireEvent, cleanup, act, waitFor, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { EXIT_MS, useClosing } = await import('../src/components/ui/Modal');
const { GuideImageLightbox } = await import('../src/components/GuideVisuals');
const { ConfirmHost, confirmDialog } = await import('../src/components/ui/confirm');
const { SaveToast } = await import('../src/features/saves/SaveToast');
const { TOAST_EXIT_MS } = await import('../src/components/Toast');
afterEach(() => { cleanup(); reduced = false; document.documentElement.removeAttribute('data-simple'); document.body.style.overflow = ''; });

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const photo: GuideImage = {
  src: '/test/coast.webp', alt: '海岸步道与远处海湾', caption: '海岸环境资料照片。', credit: '示例摄影者 · CC BY-SA',
  creditUrl: 'https://example.com/source', licenseUrl: 'https://example.com/license', kind: 'photo', width: 1200, height: 800,
};

test('useClosing waits EXIT_MS (≥120 ms) before onClose; at once under reduced motion and in 简洁显示', async () => {
  assert.ok(EXIT_MS >= 120 && TOAST_EXIT_MS >= 120, 'N24: exits of at least 120 ms');
  const states: boolean[] = [];
  let closed = 0;
  let close: () => void = () => {};
  const Probe = () => { const [closing, leave] = useClosing(() => { closed += 1; }); states.push(closing); close = leave; return null; };
  render(<Probe />);
  const started = Date.now();
  act(() => { close(); close(); });
  assert.equal(states.at(-1), true, 'closing while the exit plays');
  assert.equal(closed, 0);
  await waitFor(() => assert.equal(closed, 1), { timeout: 2000 });
  assert.ok(Date.now() - started >= EXIT_MS - 5);
  cleanup();
  for (const quick of [() => { reduced = true; }, () => { document.documentElement.setAttribute('data-simple', ''); }]) {
    quick();
    closed = 0;
    render(<Probe />);
    act(() => { close(); });
    assert.equal(closed, 1, 'no exit to wait for');
    cleanup(); reduced = false; document.documentElement.removeAttribute('data-simple');
  }
});

test('the guide lightbox leaves over --dur-3 (is-closing) and closes with F\'s close button', async () => {
  let closed = 0;
  const view = render(<GuideImageLightbox image={photo} onClose={() => { closed += 1; }} />);
  const dialog = view.getByRole('dialog', { name: `图片放大：${photo.alt}` });
  const close = within(dialog).getByRole('button', { name: '关闭放大图片' });
  assert.ok(close.classList.contains('ui-icon-button') && close.classList.contains('ui-close'), 'N13: the one close button');
  assert.equal(close.textContent, '', 'no 关闭 pill text');
  fireEvent.click(close);
  assert.ok(dialog.classList.contains('is-closing'), 'the exit plays');
  assert.equal(closed, 0);
  await waitFor(() => assert.equal(closed, 1), { timeout: 2000 });
});

test('a confirm answers at once, then leaves with an exit before the next one opens', async () => {
  const view = render(<ConfirmHost />);
  let first: boolean | undefined;
  await act(async () => { void confirmDialog({ title: '删除计划', message: '删除这份已保存计划？' }).then(value => { first = value; }); });
  void confirmDialog({ message: '第二个确认' });
  const dialog = await waitFor(() => view.getByRole('dialog', { name: '删除计划' }));
  assert.match(dialog.className, /bg-\[color:var\(--scrim\)\]/);
  assert.match(dialog.className, /animate-in/);
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: '确认' })); });
  assert.equal(first, true, 'the answer does not wait for the exit');
  assert.match(dialog.className, /animate-out/, 'the exit plays');
  assert.equal(view.queryByRole('dialog', { name: '确认操作' }), null, 'the next confirm waits for the exit');
  await waitFor(() => assert.ok(view.getByRole('dialog', { name: '确认操作' })), { timeout: 2000 });
  assert.equal(view.queryByRole('dialog', { name: '删除计划' }), null);
});

test('SaveToast is the one Toast: its look, its close button, its exit; the announcer stays the only live region', async () => {
  let closed = 0;
  const view = render(<MemoryRouter><SaveToast message="已收藏" actionLabel="查看" to="/my-week#saved" closeLabel="关闭提示" onClose={() => { closed += 1; }} /></MemoryRouter>);
  const toast = view.getByTestId('save-toast');
  const box = toast.querySelector<HTMLElement>('.site-toast-box')!;
  assert.equal(box.getAttribute('role'), null);
  assert.equal(within(toast).getByRole('link', { name: '查看' }).getAttribute('href'), '/my-week#saved');
  const close = within(toast).getByRole('button', { name: '关闭提示' });
  assert.ok(close.classList.contains('ui-icon-button') && close.classList.contains('ui-close'), 'N13: the one close button');
  fireEvent.click(close);
  assert.ok(box.hasAttribute('data-leaving'), 'N24: the save toast leaves too');
  assert.equal(closed, 0);
  await waitFor(() => assert.equal(closed, 1), { timeout: 2000 });
  const source = read('src/features/saves/SaveToast.tsx');
  assert.match(source, /<Toast /);
  assert.doesNotMatch(source, /createPortal|site-toast-box/, 'one toast system');
});

test('every overlay in the lane sits on var(--scrim) without blur, on --r-* corners and --dur-* motion', () => {
  for (const file of ['src/components/guide-visuals.css', 'src/components/site-dialogs.css', 'src/features/feedback/feedback.css', 'src/styles/event-import.css']) {
    const css = read(file);
    assert.doesNotMatch(css, /backdrop-filter/, `${file}: no blur behind an overlay`);
    assert.doesNotMatch(css, /color-scrim-rgb\) \/ \.9|rgb\(22 46 41|rgb\(13 32 27/, `${file}: no off-token scrim`);
    for (const [, value] of css.matchAll(/(?:transition|animation)\s*:\s*([^;}]+)/g)) assert.doesNotMatch(value.replace(/var\([^)]*\)/g, ''), /\d(?:ms|s)\b/, `${file}: ${value}`);
  }
  for (const file of ['src/components/ui/confirm.tsx', 'src/components/OfficialVerificationModal.tsx', 'src/app/OverlayHost.tsx']) {
    const source = read(file);
    const layers = [...source.matchAll(/fixed inset-0[^"'`]*/g)].map(match => match[0]);
    assert.ok(layers.length, `${file}: has a full-screen layer`);
    for (const layer of layers) {
      assert.match(layer, /bg-\[color:var\(--scrim\)\]|bg-baylink-bg /, `${file}: ${layer}`);
      assert.doesNotMatch(layer, /bg-black\/|bg-white\/|backdrop-blur/, `${file}: scrims are var(--scrim), no blur`);
    }
    assert.doesNotMatch(source, /rounded-\[(?:24|28)px\]/, `${file}: corners on --r-*`);
  }
  for (const file of ['src/components/GuideVisuals.tsx', 'src/features/feedback/FeedbackSheet.tsx', 'src/components/EventScreenshotImport.tsx', 'src/components/OfficialVerificationModal.tsx']) {
    assert.match(read(file), /<CloseButton /, `${file}: F's close button`);
  }
});
