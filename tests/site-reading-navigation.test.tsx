import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { SiteMobileNavigation } = await import('../src/components/SiteMobileNavigation');
const { ReadingPreferencesButton } = await import('../src/components/ReadingPreferences');
const { getReadingSize, setReadingSize, initializeReadingSize, READING_SIZE_KEY, getSimpleDisplay, setSimpleDisplay, SIMPLE_DISPLAY_KEY, withFamilyReading } = await import('../src/lib/reading-preferences');
afterEach(() => { cleanup(); setReadingSize('standard'); setSimpleDisplay(false); dom.window.localStorage.clear(); });

test('events and personal routes have one correct tab, while BayBay opens in one action', () => {
  let asked = 0;
  const view = render(<MemoryRouter><SiteMobileNavigation pathname="/events/festival" notificationCount={3} onAsk={() => asked++} /></MemoryRouter>);
  assert.equal(view.container.querySelectorAll('a').length, 4);
  assert.equal(view.container.querySelector('[aria-current=page]')?.getAttribute('href'), '/events');
  fireEvent.click(view.getByRole('button', { name: '问 BayBay' })); assert.equal(asked, 1);
  assert.ok(view.getByLabelText('3 条未读消息'));
  view.rerender(<MemoryRouter><SiteMobileNavigation pathname="/messages/neighbor" notificationCount={0} onAsk={() => asked++} /></MemoryRouter>);
  assert.equal(view.container.querySelectorAll('[aria-current=page]').length, 1);
  assert.equal(view.container.querySelector('[aria-current=page]')?.getAttribute('href'), '/me');
  for (const pathname of ['/this-week', '/calendar', '/events', '/plan']) {
    view.rerender(<MemoryRouter><SiteMobileNavigation pathname={pathname} notificationCount={0} onAsk={() => asked++} /></MemoryRouter>);
    assert.equal(view.container.querySelectorAll('[aria-current=page]').length, 1, pathname);
    assert.equal(view.container.querySelector('[aria-current=page]')?.getAttribute('href'), '/events', pathname);
  }
  // 邻里 (category boards, posts) belongs to 更多: no primary tab, never 首页
  for (const pathname of ['/category/rent', '/posts/neighbor-post']) {
    view.rerender(<MemoryRouter><SiteMobileNavigation pathname={pathname} notificationCount={0} onAsk={() => asked++} /></MemoryRouter>);
    assert.equal(view.container.querySelectorAll('[aria-current=page]').length, 0, pathname);
  }
});

test('reading choices persist, initialize from a shared link, and close with restored focus', () => {
  const view = render(<ReadingPreferencesButton />);
  const trigger = view.getByRole('button', { name: '调整阅读字号' }); trigger.focus(); fireEvent.click(trigger);
  fireEvent.click(view.getByRole('button', { name: /特大/ }));
  assert.equal(getReadingSize(), 'extra-large');
  assert.equal(document.documentElement.dataset.reading, 'extra-large');
  assert.equal(dom.window.localStorage.getItem(READING_SIZE_KEY), 'extra-large');
  fireEvent.keyDown(view.getByRole('dialog'), { key: 'Escape' });
  assert.equal(view.queryByRole('dialog'), null); assert.equal(document.activeElement, trigger);
  dom.window.history.replaceState({}, '', '/?reading=large');
  act(() => initializeReadingSize());
  assert.equal(getReadingSize(), 'large');
  dom.window.history.replaceState({}, '', '/');
});

test('简洁显示 is a 48px switch that persists, follows a family link, and can be switched off by one', () => {
  const view = render(<ReadingPreferencesButton />);
  fireEvent.click(view.getByRole('button', { name: '调整阅读字号' }));
  const toggle = view.getByRole('switch', { name: /简洁显示（适合长辈）/ });
  assert.equal(toggle.getAttribute('aria-checked'), 'false');
  fireEvent.click(toggle);
  assert.equal(toggle.getAttribute('aria-checked'), 'true');
  assert.equal(getSimpleDisplay(), true);
  assert.ok(document.documentElement.hasAttribute('data-simple'));
  assert.equal(dom.window.localStorage.getItem(SIMPLE_DISPLAY_KEY), '1');
  fireEvent.click(toggle);
  assert.equal(document.documentElement.hasAttribute('data-simple'), false);
  const tokens = postcss.parse(readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8'));
  let minHeight = '';
  tokens.walkRules(rule => { if (toggle.matches(rule.selector)) rule.walkDecls('min-height', declaration => { minHeight = declaration.value; }); });
  assert.equal(minHeight, 'max(48px,var(--control-height))');
  view.unmount();
  dom.window.history.replaceState({}, '', '/guides?reading=extra-large&simple=1');
  act(() => initializeReadingSize());
  assert.equal(getReadingSize(), 'extra-large'); assert.equal(getSimpleDisplay(), true);
  assert.ok(document.documentElement.hasAttribute('data-simple'));
  dom.window.history.replaceState({}, '', '/guides?simple=0');
  act(() => initializeReadingSize());
  assert.equal(getSimpleDisplay(), false); assert.equal(document.documentElement.hasAttribute('data-simple'), false);
  dom.window.history.replaceState({}, '', '/');
});

test('a family link carries 特大 and 简洁显示 and keeps the page’s own parameters and anchor', () => {
  assert.equal(withFamilyReading('/guides?topic=elders'), '/guides?topic=elders&reading=extra-large&simple=1');
  assert.equal(withFamilyReading('https://www.baylink.us/offers/sfmta-free-muni-seniors#apply'), 'https://www.baylink.us/offers/sfmta-free-muni-seniors?reading=extra-large&simple=1#apply');
  assert.equal(withFamilyReading('/x?reading=large&simple=0'), '/x?reading=extra-large&simple=1');
});

test('blocked storage still changes text size for this session', () => {
  const prototype = Object.getPrototypeOf(dom.window.localStorage);
  const original = prototype.setItem;
  prototype.setItem = () => { throw new Error('blocked'); };
  try { setReadingSize('large'); assert.equal(getReadingSize(), 'large'); assert.equal(document.documentElement.dataset.reading, 'large'); }
  finally { prototype.setItem = original; }
});

test('search controls outside the app root are covered by the shared keyboard focus ring', async () => {
  const { QuickExplore } = await import('../src/components/QuickExplore');
  const tokens = postcss.parse(readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8'));
  const view = render(<QuickExplore onClose={() => {}} onSearch={() => {}} onNavigate={() => {}} onAsk={() => {}} />);
  const dialog = view.getByRole('dialog');
  assert.equal(dialog.closest('.site-app'), null, 'the actual search portal is outside the app-scoped focus rule');
  for (const control of dialog.querySelectorAll<HTMLElement>('input,button,a')) {
    let covered = false;
    tokens.walkRules(rule => {
      if (!rule.selector.includes(':focus-visible') || !control.matches(rule.selector.replaceAll(':focus-visible', ''))) return;
      const declarations = new Map(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
      if (declarations.get('outline') === '2px solid var(--color-brand)' && declarations.get('outline-offset') === '3px') covered = true;
    });
    assert.ok(covered, `${control.tagName}: a theme focus rule must match the actual portal control`);
  }
});

test('actual sign-in and MFA safety facts use reading tokens, including registration utility text', async () => {
  const { LoginModal } = await import('../src/features/auth/LoginModal');
  const { MfaLoginChallenge } = await import('../src/features/auth/MfaLoginChallenge');
  const { ModalShell } = await import('../src/components/ui/Modal');
  const tokens = postcss.parse(readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8'));
  const usesToken = (element: Element, property: string, value: string) => {
    let matched = false;
    tokens.walkRules(rule => {
      if (rule.parent?.type !== 'root' || !element.matches(rule.selector)) return;
      if (rule.nodes.some(node => node.type === 'decl' && node.prop === property && node.value === value)) matched = true;
    });
    assert.ok(matched, `${element.tagName}.${element.className}: ${property} must use ${value}`);
  };
  act(() => setReadingSize('extra-large'));
  usesToken(document.documentElement, 'font-size', '125%');
  const login = render(<LoginModal onClose={() => {}} onLogin={() => {}} showToast={() => {}} onForgotPassword={() => {}} />);
  const dialog = login.getByRole('dialog');
  assert.equal(dialog.closest('.site-app'), null);
  for (const fact of dialog.querySelectorAll('.member-auth-heading p,.member-auth-form > label,.member-auth-privacy')) usesToken(fact, 'font-size', 'var(--text-fact)');
  usesToken(login.getByLabelText('邮箱或用户名'), 'font-size', 'var(--text-body)');
  usesToken(login.getByRole('button', { name: '关闭登录注册' }), 'min-height', 'var(--control-height)');
  fireEvent.click(login.getByRole('button', { name: '还没有账号？去注册' }));
  usesToken(login.getByText('仅用于账号信任与联系方式请求功能，不会公开显示。'), 'font-size', 'var(--text-fact)');
  login.unmount();
  const mfa = render(<ModalShell label="Two-step verification"><MfaLoginChallenge challengeToken="test-only" onComplete={() => {}} onRestart={() => {}} onClose={() => {}} /></ModalShell>);
  for (const fact of mfa.getByRole('dialog').querySelectorAll('.member-auth-heading p,.member-auth-form > label')) usesToken(fact, 'font-size', 'var(--text-fact)');
  usesToken(mfa.getByLabelText('验证器六位代码'), 'font-size', 'var(--text-body)');
});
