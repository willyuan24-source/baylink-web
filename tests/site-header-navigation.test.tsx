import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter, useLocation } = await import('react-router-dom');
const { renderToStaticMarkup } = await import('react-dom/server');
const { SiteNavigation } = await import('../src/components/SiteNavigation');
afterEach(cleanup);

const base = { active: 'home', category: '全部', homeActive: true, user: null, notification: true, notificationCount: 3, onCreate() {}, onAsk() {}, onAccount() {} };
const member = { id: 'u1', nickname: '邻居', token: 'fixture' } as never;
function Location() { return <output aria-label="current route">{useLocation().pathname}</output>; }

test('the More disclosure keeps secondary destinations available and closes after navigation, Escape and outside focus', () => {
  const view = render(<MemoryRouter><SiteNavigation {...base} /><Location /><button type="button">Outside</button></MemoryRouter>);
  const menu = view.container.querySelector('details')!;
  const trigger = view.getByLabelText('更多导航');
  // Plan §1 更多 (反馈 arrives with WEB-SHELL2); /archive stays until the global footer carries it.
  const destinations = ['/my-week', '/category/rent', '/explore', '/tools', '/opus-bay?from=nav', '/about', '/archive', '/terms', '/privacy', '/sms-consent'];
  assert.deepEqual([...menu.querySelectorAll('a')].map(a => a.getAttribute('href')), destinations, 'a guest sees no 消息 (nothing to read yet)');
  assert.equal(view.getByRole('link', { name: '邻里信息（测试中）' }).getAttribute('href'), '/category/rent', 'the board is labelled as a trial (G16)');
  assert.ok(view.getByRole('link', { name: '我的这周' }), 'naming table: 我的这周, not 我的收藏与计划');
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

test('the account action closes the disclosure and restores a visible opener; 发布 is not in the header (G16)', () => {
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
  assert.equal(view.queryByRole('button', { name: /发布/ }), null, '发布 lives only inside 邻里 (D20)');
  assert.doesNotMatch(view.container.textContent!, /发布信息/);
  fireEvent.click(view.getByRole('button', { name: '问 BayBay' }));
  assert.equal(asked, 1);
  assert.equal(actions.length, 1);
});

test('G1: a member reaches the inbox in two taps — 更多, then 消息 with its unread count', () => {
  const view = render(<MemoryRouter initialEntries={['/guides']}><SiteNavigation {...base} user={member} /><Location /></MemoryRouter>);
  const menu = view.container.querySelector('details')!;
  const links = [...menu.querySelectorAll('.site-secondary-nav a')].map(a => a.getAttribute('href'));
  assert.equal(links[0], '/messages', '消息 leads the list');
  menu.open = true; // tap 1: 更多 (the native <details> toggle)
  const inbox = view.getByRole('link', { name: /^消息/ });
  assert.equal(within(inbox).getByLabelText('未读消息').textContent, '3');
  fireEvent.click(inbox); // tap 2
  assert.equal(view.getByLabelText('current route').textContent, '/messages');
  assert.equal(menu.open, false);
  assert.ok(view.getByRole('button', { name: '账号设置' }));
});

test('更多 is the current section on 邻里, post and profile overlays, about and legal pages — 首页 never is', () => {
  const summary = (view: ReturnType<typeof render>) => view.container.querySelector('summary')!;
  for (const [route, real] of [['/category/rent', undefined], ['/', '/posts/123'], ['/category/rent', '/users/abc'], ['/about', undefined], ['/en/terms', undefined]] as const) {
    const view = render(<MemoryRouter initialEntries={[route]}><SiteNavigation {...base} pathname={real} /></MemoryRouter>);
    assert.equal(summary(view).getAttribute('aria-current'), 'true', real || route);
    assert.ok(summary(view).classList.contains('is-active'), real || route);
    assert.equal(view.container.querySelector('.site-header-primary [aria-current]'), null, `${real || route}: no primary tab, 首页 included`);
    view.unmount();
  }
  for (const route of ['/', '/events', '/guides/x', '/me', '/messages/t1']) {
    const view = render(<MemoryRouter initialEntries={[route]}><SiteNavigation {...base} /></MemoryRouter>);
    assert.equal(summary(view).getAttribute('aria-current'), null, route);
    assert.ok(!summary(view).classList.contains('is-active'), route);
    view.unmount();
  }
  const home = render(<MemoryRouter initialEntries={['/']}><SiteNavigation {...base} /></MemoryRouter>);
  assert.equal(home.getByRole('link', { name: '首页' }).getAttribute('aria-current'), 'page');
});

test('RC-8(ii): the closed 更多 panel is in the static markup, 3D link and 消息 included', () => {
  const html = renderToStaticMarkup(<StaticRouter location="/guides"><SiteNavigation {...base} user={member} /></StaticRouter>);
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.querySelector('details')!.hasAttribute('open'), false);
  assert.match(doc.querySelector('a[href="/opus-bay?from=nav"]')!.textContent!, /3D 旧金山/);
  assert.ok(doc.querySelector('a[href="/messages"]'));
});

test('keyboard selection of a current or new destination restores visible focus before hiding the menu', () => {
  const view = render(<MemoryRouter initialEntries={['/tools']}><SiteNavigation {...base} /><Location /></MemoryRouter>);
  const menu = view.container.querySelector('details')!;
  const trigger = view.getByLabelText('更多导航');
  const menuOpenWhenFocusReturns: boolean[] = [];
  trigger.addEventListener('focus', () => menuOpenWhenFocusReturns.push(menu.open));
  for (const [label, path] of [['生活工具箱', '/tools'], ['按地区找景点', '/explore']]) {
    menu.open = true;
    const link = view.getByRole('link', { name: label });
    link.focus();
    assert.equal(document.activeElement, link);
    // Native keyboard activation emits a click with no pointer-click count.
    fireEvent.click(link, { detail: 0 });
    assert.equal(view.getByLabelText('current route').textContent, path);
    assert.equal(menu.open, false);
    assert.equal(document.activeElement, trigger, 'focus must not remain in the collapsed navigation');
  }
  assert.deepEqual(menuOpenWhenFocusReturns, [true, true]);
});
