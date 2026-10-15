// W5-INT (WEB-LINK-2 × WEB-COMMUNITY-2): the generic sign-in sheet's account line. Post saves stay on the device (H77,
// the favorites API has no post kind), so the line says 收藏（邻里信息除外）; while the board is paused (COMMUNITY_VISIBLE =
// false) it promises no posting and names no posts. Both switch states, both modes, zh-Hans, zh-Hant and en.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, cleanup, fireEvent } = await import('@testing-library/react');
const { LoginModal } = await import('../src/features/auth/LoginModal');
const { setCommunityVisibleForTests } = await import('../src/data/site-flags');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); setCommunityVisibleForTests(true); localStorage.clear(); await setLocale('zh-Hans', false); });
const sheet = () => render(<LoginModal onClose={() => {}} onLogin={() => {}} showToast={() => {}} onForgotPassword={() => {}} />);
const accountLine = () => document.querySelector('.member-auth-heading p')!.textContent;

test('board visible: the account line says post saves stay out of the account and keeps posting (sign-in and sign-up)', async () => {
  sheet();
  assert.equal(accountLine(), '登录后继续聊天、管理发布；收藏（邻里信息除外）和行程跟着账号走。');
  cleanup();
  await setLocale('en', false);
  sheet();
  assert.equal(accountLine(), 'Sign in to keep chatting and manage your posts; saved items (except neighborhood posts) and plans follow your account.');
  cleanup();
  await setLocale('zh-Hans', false);
  sheet();
  fireEvent.click(document.querySelector('.member-auth-switch')!);
  assert.equal(accountLine(), '收藏（邻里信息除外）和行程跟着账号走，换手机也在；也可以发布信息、收发私信。');
});

test('board paused (COMMUNITY_VISIBLE = false): no posting and no posts in the account line, in all three languages', async () => {
  setCommunityVisibleForTests(false);
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    await setLocale(locale, false);
    sheet();
    const signIn = accountLine()!;
    assert.doesNotMatch(signIn, /发布|發佈|發布|邻里|鄰里|post/i, `${locale} sign-in: ${signIn}`);
    assert.match(signIn, locale === 'en' ? /keep chatting; your saved items and plans follow your account/ : /继续聊天；收藏和行程跟着账号走|繼續聊天；收藏和行程跟著帳號走/);
    fireEvent.click(document.querySelector('.member-auth-switch')!);
    const signUp = accountLine()!;
    assert.doesNotMatch(signUp, /发布|發佈|發布|邻里|鄰里|post/i, `${locale} sign-up: ${signUp}`);
    assert.match(signUp, /私信|私訊|send messages/);
    cleanup();
  }
});
