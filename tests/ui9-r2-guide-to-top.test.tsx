// UI9-R2-GUIDE (R2-14, round 3): 回到顶部 steps aside while a link, a control or a text line is under it, comes back once
// nothing is, and never steps the labelled end-of-page button (大 / 特大 / 简洁 on a phone, position static) aside. jsdom has
// no layout, so the button's box, what lies under it (elementsFromPoint) and the text lines' boxes are stubbed.
import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/guides/x' });
let position = 'fixed';
const realStyle = dom.window.getComputedStyle.bind(dom.window);
const style = (element: Element) => element.classList.contains('gd-to-top') ? { ...realStyle(element), position } as CSSStyleDeclaration : realStyle(element);
// No requestAnimationFrame here: the component then runs its full check at once on every scroll (its no-frames path).
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, getComputedStyle: style, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const hooks = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
after(() => hooks.deregister());
const { render, cleanup, act } = await import('@testing-library/react');
const { GuideToTop } = await import('../src/features/guides/GuidePageParts');
afterEach(() => { cleanup(); position = 'fixed'; });

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;
// What lies under the button, and the boxes of the text lines in it.
let under: Element[] = [];
let lines: DOMRect[] = [];
(document as unknown as { elementsFromPoint: (x: number, y: number) => Element[] }).elementsFromPoint = (x: number, y: number) => (x >= 326 && x <= 374 && y >= 700 && y <= 748 ? under : []);
dom.window.Range.prototype.getClientRects = function () { return lines as unknown as DOMRectList; };

function mount() {
  const view = render(<main><h1>标题</h1><GuideToTop /></main>);
  const button = view.container.querySelector<HTMLButtonElement>('.gd-to-top')!;
  button.getBoundingClientRect = () => rect(326, 700, 48, 48);
  Object.defineProperty(window, 'scrollY', { configurable: true, value: window.innerHeight * 2 + 10 });
  return { view, button };
}
const scroll = () => act(() => { window.dispatchEvent(new dom.window.Event('scroll')); });

test('回到顶部 steps aside while a link is under it and comes back once nothing is', () => {
  const { button } = mount();
  under = []; scroll();
  assert.equal(button.hidden, false);
  assert.equal(button.getAttribute('data-off'), null, 'nothing under it: shown');
  const link = document.createElement('a'); link.href = '/guides/y'; link.textContent = '下一篇'; document.body.append(link);
  under = [link]; scroll();
  assert.equal(button.getAttribute('data-off'), '', 'a link under it: stepped aside');
  under = []; scroll();
  assert.equal(button.getAttribute('data-off'), null, 'back once the link has passed');
  link.remove();
});

test('回到顶部 steps aside over a text line, not over a paragraph box whose lines miss it', () => {
  const { button } = mount();
  const paragraph = document.createElement('p'); paragraph.textContent = '这一段的最后一行很短'; document.body.append(paragraph);
  under = [paragraph];
  lines = [rect(16, 690, 358, 24)];
  scroll();
  assert.equal(button.getAttribute('data-off'), '', 'a line runs under the button');
  lines = [rect(16, 640, 358, 24), rect(16, 664, 120, 24)];
  scroll();
  assert.equal(button.getAttribute('data-off'), null, 'the paragraph box is under it but its lines end before it');
  paragraph.remove(); lines = []; under = [];
});

test('the labelled end-of-page button (position static) is never stepped aside, a link beside it or not', () => {
  position = 'static';
  const { button } = mount();
  const link = document.createElement('a'); link.href = '/guides/y'; document.body.append(link);
  under = [link]; scroll();
  assert.equal(button.getAttribute('data-off'), null);
  link.remove(); under = [];
});
