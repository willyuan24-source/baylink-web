// UI9-R1-ACCOUNT-PAGES (cold review round 1): /me on the wide frame, the account shell's first paint, the 404 on the site
// Button with a short pre-footer, /about's 还有 row without separators, and the token / hover rules of the four
// stylesheets. CSS facts are read from the stylesheets themselves.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import postcss, { type AtRule, type Rule } from 'postcss';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://www.baylink.us/missing-page', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element,
  Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { default: NotFoundPage } = await import('../src/pages/NotFoundPage');
const { AboutContent } = await import('../src/components/AboutContent');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

const css = (file: string) => postcss.parse(readFileSync(file, 'utf8'));
/** Declarations of the rules whose selector list is exactly `selector`, with the @media they sit in ('' at the top). */
const decls = (file: string, selector: string) => {
  const found: Array<{ media: string; props: Record<string, string> }> = [];
  css(file).walkRules(rule => {
    if (rule.selector !== selector) return;
    const media = rule.parent?.type === 'atrule' ? (rule.parent as AtRule).params : '';
    const props: Record<string, string> = {};
    rule.walkDecls(decl => { props[decl.prop] = decl.value; });
    found.push({ media, props });
  });
  return found;
};
const one = (file: string, selector: string, media = '') => {
  const rule = decls(file, selector).find(item => item.media === media);
  assert.ok(rule, `${file}: ${selector} ${media}`);
  return rule.props;
};
const FILES = ['src/features/profile/me-hub.css', 'src/features/saves/my-week.css', 'src/components/not-found.css', 'src/components/about-baylink.css'];

test('the four stylesheets: every :hover gated (N23), motion from tokens (N24), one underline offset (N13)', () => {
  for (const file of FILES) {
    css(file).walkRules((rule: Rule) => {
      if (!rule.selector.includes(':hover')) return;
      let gated = false;
      for (let parent = rule.parent; parent; parent = parent.parent) if (parent.type === 'atrule' && /hover:\s*hover/.test((parent as AtRule).params)) gated = true;
      assert.ok(gated, `${file}: ungated ${rule.selector}`);
    });
    css(file).walkDecls(decl => {
      if (/^(?:transition|animation)(?:-duration)?$/.test(decl.prop)) assert.doesNotMatch(decl.value, /\d(?:ms|s)\b/, `${file}: ${decl.prop} ${decl.value}`);
      if (decl.prop === 'text-underline-offset') assert.equal(decl.value, 'var(--underline-offset)', `${file}: ${decl.parent && (decl.parent as Rule).selector}`);
    });
  }
});

test('/me sits on the wide frame (x = 112 at 1440), tiles on the grid, sections in columns 1-8; sub-views on the same frame (N16)', () => {
  const file = 'src/features/profile/me-hub.css';
  assert.equal(one(file, '.me-hub')['max-width'], 'var(--container-wide)');
  assert.equal(one(file, '.me-hub')['box-sizing'], 'content-box');
  assert.equal(one(file, '.me-hub,.me-subview', '(min-width:1024px)')['padding-inline'], '32px');
  assert.equal(one(file, '.me-tiles', '(min-width:1024px)')['column-gap'], 'var(--grid-gutter)');
  assert.equal(one(file, '.me-section', '(min-width:1024px)')['max-width'], 'calc((100% + var(--grid-gutter)) * 8 / 12 - var(--grid-gutter))');
  assert.equal(one(file, '.me-subview')['max-width'], 'var(--container-wide)');
  assert.equal(one(file, '.me-subview>*')['max-width'], 'var(--container-reading)');
});

test('pre-footer (N15): /me, my-week, /about and the 404 end at most 24px above the footer', () => {
  assert.match(one('src/features/profile/me-hub.css', '.me-hub').padding, / calc\(env\(safe-area-inset-bottom, 0px\) \+ var\(--sp-5\)\)$/);
  assert.equal(one('src/features/profile/me-hub.css', '.me-hub', '(min-width:768px)').padding, '32px 24px var(--sp-5)');
  assert.equal(one('src/features/saves/my-week.css', '.my-week')['padding-block'], '24px var(--sp-3)');
  assert.equal(one('src/components/about-baylink.css', '.about-page')['padding-block'], 'var(--sp-5) var(--sp-4)');
  assert.equal(one('src/components/about-baylink.css', '.about-page', '(min-width:1024px)')['padding-block'], 'var(--sp-6) var(--sp-5)');
  const page = one('src/components/not-found.css', '.nf-page');
  assert.equal(page.padding, 'var(--sp-5) var(--page-gutter) var(--sp-4)');
  // A 404 shorter than the window: the page fills <main> and the free space goes above 反馈与报错, not above the footer.
  assert.equal(page.flex, '1 0 auto');
  assert.equal(one('src/components/not-found.css', '.site-main:has(>.nf-page)')['flex-direction'], 'column');
  assert.equal(one('src/components/not-found.css', '.nf-feedback')['margin-top'], 'auto');
});

test('the account shell (first paint of the account pages) is a title bar over skeleton rows, the window tall (J1 P21 / J3 P23)', () => {
  const file = 'src/features/profile/me-hub.css';
  assert.equal(one(file, '.account-shell')['min-height'], '100svh');
  assert.equal(one(file, '.account-shell::before').content, '""');
});

test('the 404 uses the site Button (N12) and an input-cornered search field (N11), in three languages', async () => {
  const file = 'src/components/not-found.css';
  assert.doesNotMatch(readFileSync(file, 'utf8'), /\.nf-button/, 'no button look of its own');
  assert.equal(one(file, '.nf-search-field')['border-radius'], 'var(--r-md)');
  const app = { openBayBay: () => {}, warmBayBay: () => {} };
  for (const locale of ['zh-Hans', 'en', 'zh-Hant'] as const) {
    await act(async () => { await setLocale(locale, false); });
    const view = render(<MemoryRouter initialEntries={['/missing-page']}><Routes><Route element={<Outlet context={app} />}><Route path="*" element={<NotFoundPage />} /></Route></Routes></MemoryRouter>);
    const search = within(view.getByRole('search')).getByRole('button');
    assert.equal(search.getAttribute('type'), 'submit');
    assert.equal(search.className, 'ui-button');
    assert.equal(search.dataset.variant, 'primary');
    const actions = view.container.querySelector('.nf-actions')!;
    const buttons = [...actions.querySelectorAll('a,button')] as HTMLElement[];
    assert.deepEqual(buttons.map(item => [item.tagName, item.className, item.dataset.variant]), [['A', 'ui-button', 'secondary'], ['BUTTON', 'ui-button', 'secondary']], locale);
    assert.equal(view.container.querySelectorAll('.nf-button').length, 0);
    cleanup();
  }
});

test('/about: the 还有 row has no " · " separators, so no line of it can start with one (N06)', async () => {
  for (const locale of ['zh-Hans', 'en'] as const) {
    await act(async () => { await setLocale(locale, false); });
    const view = render(<MemoryRouter initialEntries={['/about']}><AboutContent /></MemoryRouter>);
    const more = view.container.querySelector('.about-more')!;
    assert.doesNotMatch(more.textContent!, /·/, locale);
    assert.deepEqual([...more.querySelectorAll('a')].map(link => link.getAttribute('href')), ['/explore', '/tools', '/opus-bay', '/category/rent'], locale);
    cleanup();
  }
  const row = one('src/components/about-baylink.css', '.about-section>.about-more');
  assert.equal(row.display, 'flex');
  assert.equal(row['flex-wrap'], 'wrap');
  assert.equal(row['column-gap'], 'var(--sp-4)');
});
