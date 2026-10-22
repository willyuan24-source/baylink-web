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

test('/me sits on the wide frame (x = 112 at 1440), tiles on the grid, sections, notice and actions in columns 1-8; sub-views on the same frame (N16)', () => {
  const file = 'src/features/profile/me-hub.css';
  assert.equal(one(file, '.me-hub')['max-width'], 'var(--container-wide)');
  assert.equal(one(file, '.me-hub')['box-sizing'], 'content-box');
  assert.equal(one(file, '.me-hub,.me-subview', '(min-width:1024px)')['padding-inline'], '32px');
  assert.equal(one(file, '.me-tiles', '(min-width:1024px)')['column-gap'], 'var(--grid-gutter)');
  // The signed-in account notice and the actions row (with the share link's fallback field) keep to the same columns.
  assert.equal(one(file, '.me-section,.me-hub__notice,.me-hub__actions', '(min-width:1024px)')['max-width'], 'calc((100% + var(--grid-gutter)) * 8 / 12 - var(--grid-gutter))');
  assert.equal(one(file, '.me-subview')['max-width'], 'var(--container-wide)');
  assert.equal(one(file, '.me-subview>*')['max-width'], 'var(--container-reading)');
});

test('pre-footer (N15): /me, my-week, /about and the 404 end 32-48px above the chrome\'s 12px footer step (#61)', () => {
  assert.match(one('src/features/profile/me-hub.css', '.me-hub').padding, / calc\(env\(safe-area-inset-bottom, 0px\) \+ var\(--sp-7\)\)$/);
  assert.equal(one('src/features/profile/me-hub.css', '.me-hub', '(min-width:768px)').padding, '32px 24px var(--sp-7)');
  assert.equal(one('src/features/saves/my-week.css', '.my-week')['padding-block'], '24px var(--sp-6)');
  assert.equal(one('src/components/about-baylink.css', '.about-page')['padding-block'], 'var(--sp-5) var(--sp-6)');
  assert.equal(one('src/components/about-baylink.css', '.about-page', '(min-width:1024px)')['padding-block'], 'var(--sp-6) calc(var(--sp-6) + var(--sp-2))');
  const page = one('src/components/not-found.css', '.nf-page');
  assert.equal(page.padding, 'var(--sp-5) var(--page-gutter) var(--sp-6)');
  // 反馈与报错 stays 8px under the actions (no fill that would strand it above the footer on a tall window), and the
  // page stylesheet leaves the chrome's <main> alone.
  assert.equal(page.flex, undefined);
  assert.equal(one('src/components/not-found.css', '.nf-actions').margin, 'var(--section-gap) 0 var(--sp-2)');
  assert.equal(one('src/components/not-found.css', '.nf-feedback')['margin-top'], undefined);
  // The lazy 反馈与报错 link's row is held from the first paint (the prerender has an empty .nf-feedback).
  assert.equal(one('src/components/not-found.css', '.nf-feedback')['min-height'], 'var(--control-height)');
  assert.doesNotMatch(readFileSync('src/components/not-found.css', 'utf8'), /site-main/);
  // Desktop: the four place cards are 88 tall, which fills a 1440 x 900 window to ≤ 64 above the footer.
  assert.equal(one('src/components/not-found.css', '.nf-links a', '(min-width:1024px)')['min-height'], '5.5rem');
});

test('the account shell (first paint of the account pages) is a title bar over skeleton rows, the window tall (J1 P21 / J3 P23)', () => {
  const file = 'src/features/profile/me-hub.css';
  assert.equal(one(file, '.account-shell')['min-height'], '100svh');
  assert.equal(one(file, '.account-shell::before').content, '""');
  // These rules reach account-shell.html only through the /me prerender: scripts/prerender.tsx renders the shell for /me,
  // so the file links the /me route's CSS, which carries me-hub.css (ProfileView imports it). Either link breaking drops the
  // rules silently (the built file itself is checked after the build, not here: npm test runs before npm run build).
  assert.match(readFileSync('scripts/prerender.tsx', 'utf8'), /renderPage\(\{[^}]*path: '\/me'[^}]*\}, <AccountShell \/>, ACCOUNT_SHELL_FILE\)/);
  assert.match(readFileSync('src/features/profile/ProfileView.tsx', 'utf8'), /^import '\.\/me-hub\.css';$/m);
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

test('UI9-R1 polish: one chevron hint on the four /me tiles, 小队与预约 side by side on a desktop; my-week\'s empty import is the ui empty state; /about\'s feedback button has its box from the first paint', () => {
  const hub = 'src/features/profile/me-hub.css';
  // The three tiles that open a page or a sheet end their title with the chevron 小队与预约's links carry.
  const chevron = one(hub, ':is(a,button).me-tile .me-tile__title::after');
  assert.equal(chevron.width, '1rem');
  assert.equal(chevron.background, 'var(--color-brand)');
  assert.match(chevron.mask, /m9 18 6-6-6-6/, 'lucide chevron-right, as the links draw it');
  assert.equal(one(hub, '.me-tile__links a').gap, 'var(--sp-1)', 'the chevron follows its label (no space-between)');
  assert.equal(one(hub, '.me-tile__links a')['justify-content'], undefined);
  assert.equal(one(hub, '.me-tile__links', '(min-width:1024px)')['flex-direction'], 'row', 'two links side by side: no ~85px blank under the other tiles');
  // 我导入的活动 with nothing upcoming: no dashed frame, the icon in the brand-tint circle.
  const empty = one('src/features/saves/my-week.css', '.my-week__legacy .imported-event-empty');
  assert.equal(empty.border, '0');
  assert.equal(empty['flex-direction'], 'column');
  assert.equal(empty['text-align'], 'center');
  const icon = one('src/features/saves/my-week.css', '.my-week__legacy .imported-event-empty>svg');
  assert.equal(icon.background, 'var(--color-brand-tint)');
  assert.equal(icon['border-radius'], 'var(--r-circle)');
  assert.equal(icon.padding, 'var(--sp-4)', 'a 64px circle on the spacing scale');
  // 反馈与报错 on /about: the metrics of feedback-entry.css, which only arrives after the app's first render.
  const feedback = one('src/components/about-baylink.css', '.about-contact>.feedback-footer-link');
  const entry = readFileSync('src/features/feedback/feedback-entry.css', 'utf8');
  assert.match(entry, /\.feedback-footer-link\{display:inline-flex;align-items:center;gap:\.5rem;min-height:var\(--control-height\);[^}]*font-size:var\(--text-fact\)/);
  assert.deepEqual([feedback.display, feedback['align-items'], feedback.gap, feedback['min-height'], feedback['font-size']], ['inline-flex', 'center', 'var(--sp-2)', 'var(--control-height)', 'var(--text-fact)']);
});

test('UI9-R1 polish: my-week\'s 行程 loads in the empty line\'s box, so 收藏 below does not jump when there are no plans', async () => {
  const sheet = 'src/features/saves/my-week.css';
  const line = one(sheet, '.my-week__empty-line');
  assert.equal(line['line-height'], '1.625');
  assert.equal(line.padding, '16px');
  const busy = one(sheet, '.my-week__head+[aria-busy=true]');
  assert.equal(busy['min-height'], 'calc(1.625 * var(--text-body))', 'one line of the empty line on a desktop');
  assert.equal(busy.padding, '16px');
  assert.equal(busy['box-sizing'], 'content-box');
  assert.equal(one(sheet, '.my-week__head+[aria-busy=true]', '(max-width:767px)')['min-height'], 'calc(2 * 1.625 * var(--text-body))', 'two on a phone');
  assert.equal(one(sheet, '.my-week__head+[aria-busy=true]>.ui-row-card').display, 'none');
  // The 行程 section is the one whose loading block follows its head directly (收藏's follows its note).
  const page = readFileSync('src/pages/MyWeekPage.tsx', 'utf8');
  assert.match(page, /<\/Button><\/div>\s*\{library\.loading \? <SkeletonFeed rows count=\{2\} \/>/);
  // The rule keys on SkeletonFeed's rows markup (components/ui/SkeletonCard.tsx): one aria-busy block of RowCards right
  // where it is rendered. A change there must fail here, not silently bring the 0.0413 shift back.
  const { SkeletonFeed } = await import('../src/components/ui/SkeletonCard');
  const block = render(<SkeletonFeed rows count={2} />).container.firstElementChild!;
  assert.equal(block.getAttribute('aria-busy'), 'true');
  assert.equal(block.querySelectorAll(':scope>.ui-row-card').length, 2);
  // It reads as loading: the skeleton's shimmer, none under reduced motion.
  assert.equal(busy.animation, 'ui-shimmer calc(6 * var(--dur-3)) linear infinite', 'the skeleton\'s 1.2s, from the motion tokens');
  assert.equal(one(sheet, '.my-week__head+[aria-busy=true]', '(prefers-reduced-motion:reduce)').animation, 'none');
});
