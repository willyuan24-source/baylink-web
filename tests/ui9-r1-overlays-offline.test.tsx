// UI9-R1-OVERLAYS (RC-25): a lazy dialog whose chunk cannot load (offline, a stale deploy) never leaves a tap that looks
// ignored or a caller that hangs. The confirm card falls back to the browser's confirm / prompt; the guide lightbox closes
// and the site's toast says so (chunk-unavailable.ts). A module hook refuses both chunks for this whole file, as a browser
// offline would (the other lane tests load them: tests/ui9-r1-overlays.test.tsx).
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { GuideImage } from '../src/data/guide-media';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/\/(?:GuideLightbox|ConfirmDialog)(?:\.tsx)?$/.test(specifier)) throw new TypeError(`Failed to fetch dynamically imported module: ${specifier}`);
    return nextResolve(specifier, context);
  },
});

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://www.baylink.us/guides/x', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// No error beacon from a test (ChunkBoundary reports what it catches; trackingAllowed() reads Do Not Track).
Object.defineProperty(dom.window.navigator, 'doNotTrack', { configurable: true, value: '1' });

const { render, cleanup, act, waitFor } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { GuideImageLightbox } = await import('../src/components/GuideVisuals');
const { ConfirmHost, confirmDialog, promptDialog } = await import('../src/components/ui/confirm');
afterEach(() => { cleanup(); });

const photo: GuideImage = {
  src: '/test/coast.webp', alt: '海岸步道与远处海湾', caption: '海岸环境资料照片。', credit: '示例摄影者 · CC BY-SA',
  creditUrl: 'https://example.com/source', licenseUrl: 'https://example.com/license', kind: 'photo', width: 1200, height: 800,
};

test('a guide lightbox whose chunk cannot load closes, and the toast says so (with 重新加载 when online)', async () => {
  const toasts: [message: string, type?: string, action?: string][] = [];
  const showToast = (message: string, type?: string, action?: { label: string }) => { toasts.push([message, type, action?.label]); };
  let closed = 0;
  const Layout = () => <Outlet context={{ showToast }} />;
  const view = render(<MemoryRouter><Routes><Route element={<Layout />}><Route path="/" element={<GuideImageLightbox image={photo} onClose={() => { closed += 1; }} />} /></Route></Routes></MemoryRouter>);
  assert.ok(document.body.querySelector('.site-chunk-spinner'), 'the tap shows the scrim and a spinner while the chunk is asked for');
  await waitFor(() => assert.equal(closed, 1), { timeout: 4000 });
  assert.deepEqual(toasts, [['暂时打不开，请检查网络后重试。', 'error', '重新加载']]);
  assert.equal(view.queryByRole('dialog'), null);
  assert.equal(document.body.querySelector('.site-chunk-spinner'), null, 'nothing left over the page');
});

test('a confirm whose card cannot load is answered by the browser\'s own confirm / prompt (the caller never hangs)', async () => {
  const asked: string[] = [];
  dom.window.confirm = (message?: string) => { asked.push(`confirm:${message}`); return true; };
  dom.window.prompt = (message?: string, value?: string) => { asked.push(`prompt:${message}:${value}`); return '改好的名字'; };
  const view = render(<ConfirmHost />);
  let answer: boolean | undefined;
  await act(async () => { void confirmDialog({ title: '删除计划', message: '删除这份已保存计划？', danger: true }).then(value => { answer = value; }); });
  assert.ok(document.body.querySelector('.site-chunk-spinner'), 'the tap shows the scrim and a spinner while the card loads');
  await waitFor(() => assert.equal(answer, true), { timeout: 4000 });
  let typed: string | null | undefined;
  await act(async () => { void promptDialog({ message: '给计划起个名字', input: { defaultValue: '周末' } }).then(value => { typed = value; }); });
  await waitFor(() => assert.equal(typed, '改好的名字'), { timeout: 4000 });
  assert.deepEqual(asked, ['confirm:删除这份已保存计划？', 'prompt:给计划起个名字:周末']);
  assert.equal(view.queryByRole('dialog'), null);
  assert.equal(document.body.querySelector('.site-chunk-spinner'), null, 'nothing left over the page');
});
