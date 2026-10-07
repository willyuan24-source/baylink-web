import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { MemoryRouter, useLocation } = await import('react-router-dom');
const { SiteNavigation } = await import('../src/components/SiteNavigation');
afterEach(cleanup);

const base = { active: 'home', category: '全部', homeActive: true, user: null, notification: true, notificationCount: 3, onCreate() {}, onAsk() {}, onAccount() {} };
function Location() { return <output aria-label="current route">{useLocation().pathname}</output>; }

test('the More disclosure keeps secondary destinations available and closes after navigation, Escape and outside focus', () => {
  const view = render(<MemoryRouter><SiteNavigation {...base} /><Location /><button type="button">Outside</button></MemoryRouter>);
  const menu = view.container.querySelector('details')!;
  const trigger = view.getByLabelText('更多导航');
  const destinations = ['/explore', '/category/rent', '/tools', '/my-week', '/me', '/opus-bay?from=nav', '/archive', '/about', '/terms', '/privacy', '/sms-consent'];
  for (const href of destinations) assert.ok(menu.querySelector(`a[href="${href}"]`), href);
  menu.open = true;
  fireEvent.click(view.getByRole('link', { name: '生活工具箱' }));
  assert.equal(view.getByLabelText('current route').textContent, '/tools');
  assert.equal(menu.open, false);
  menu.open = true;
  fireEvent.click(view.getByRole('link', { name: '生活工具箱' }));
  assert.equal(menu.open, false, 'selecting the current destination also closes the menu');
  menu.open = true;
  view.getByRole('link', { name: '生活工具箱' }).focus();
  fireEvent.keyDown(document, { key: 'Escape' });
  assert.equal(menu.open, false);
  assert.equal(document.activeElement, trigger);
  menu.open = true;
  view.getByRole('button', { name: 'Outside' }).focus();
  assert.equal(menu.open, false, 'tabbing out does not leave the panel over the page');
  menu.open = true;
  fireEvent.pointerDown(view.getByRole('button', { name: 'Outside' }));
  assert.equal(menu.open, false);
});

test('mobile publishing and account actions close the disclosure and restore a visible opener before opening dialogs', () => {
  let asked = 0;
  const actions: Array<{ kind: string; focused: Element | null }> = [];
  const view = render(<MemoryRouter><SiteNavigation {...base} onAsk={() => asked++} onAccount={() => actions.push({ kind: 'account', focused: document.activeElement })} onCreate={() => actions.push({ kind: 'publish', focused: document.activeElement })} /></MemoryRouter>);
  const menu = view.container.querySelector('details')!;
  const trigger = view.getByLabelText('更多导航');
  menu.open = true;
  fireEvent.click(view.getByRole('button', { name: '登录 / 注册' }));
  assert.equal(menu.open, false);
  assert.equal(actions[0].kind, 'account');
  assert.equal(actions[0].focused, trigger);
  menu.open = true;
  fireEvent.click(view.getByRole('button', { name: '发布信息' }));
  assert.equal(menu.open, false);
  assert.equal(actions[1].kind, 'publish');
  assert.equal(actions[1].focused, trigger);
  fireEvent.click(view.getByRole('button', { name: '问 BayBay' }));
  assert.equal(asked, 1);
  menu.open = true;
  assert.equal(view.getByLabelText('未读消息').textContent, '3');
});
