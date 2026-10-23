// UI9-NAV (UI-9 phase 3, chrome): the footer's image-credits contract, the 免费 · 不用登录 rule (captain decision 4), the
// phone language label (A4), the pending tab (aria-current unchanged), the BayBay launcher warm-up, the one account tool
// and the /about#about-method-title landing. CSS facts are read from the stylesheets themselves.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import postcss, { type AtRule } from 'postcss';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, HTMLDetailsElement: dom.window.HTMLDetailsElement, Node: dom.window.Node,
  MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.scrollIntoView = function () {};
const { render, fireEvent, cleanup, act, waitFor, within } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet, useLocation } = await import('react-router-dom');
const { SiteChrome, SiteFooter } = await import('../src/components/SiteChrome');
const { SiteMobileNavigation } = await import('../src/components/SiteMobileNavigation');
const { LanguageSwitcher } = await import('../src/components/LanguageSwitcher');
const { FREE_NO_SIGN_IN, FREE_ONLY, GUEST_CAPABILITIES, METHOD_HREF, SITE_IDENTITY, footerClaim } = await import('../src/lib/ui-navigation');
const { isBayBayWarm } = await import('../src/app/baybay-preload');
const { savesKey } = await import('../src/lib/saves');
const { setLocale } = await import('../src/i18n/locale');
const { default: AboutPage } = await import('../src/pages/AboutPage');
const { usePageScroll } = await import('../src/app/usePageScroll');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

const noop = () => {};

test('the footer offers ↑ 本页图片来源 (n) only for a mid-page credits block, and opens, reveals and focuses it', async () => {
  const Page = ({ end }: { end?: boolean }) => <main id="scroll-container"><p>page</p><details id="page-credits" data-count="5" data-credits-at-end={end ? '' : undefined}><summary>图片来源</summary><p>…</p></details></main>;
  const view = render(<MemoryRouter><Page /><SiteFooter onFeedback={noop} /></MemoryRouter>);
  const link = await view.findByRole('button', { name: '本页图片来源 (5)' });
  assert.equal(link.textContent, '↑ 本页图片来源 (5)');
  assert.ok(link.closest('.site-footer-row--credits'), 'the last row of the footer');
  fireEvent.click(link);
  const credits = document.getElementById('page-credits') as HTMLDetailsElement;
  assert.equal(credits.open, true);
  assert.ok(credits.hasAttribute('data-revealed'));
  assert.equal(document.activeElement, credits.querySelector('summary'));
  // The page relabels its block: the footer follows (attribute change, no polling).
  await act(async () => { credits.setAttribute('data-count', '7'); await new Promise(resolve => setTimeout(resolve, 0)); });
  assert.ok(view.getByRole('button', { name: '本页图片来源 (7)' }));
  view.unmount();
  // A block that already ends the page needs no second entry; no block, no link and no placeholder.
  const atEnd = render(<MemoryRouter><Page end /><SiteFooter onFeedback={noop} /></MemoryRouter>);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  assert.equal(atEnd.queryByText(/本页图片来源/), null);
  atEnd.unmount();
  const none = render(<MemoryRouter><main id="scroll-container"><p>page</p></main><SiteFooter onFeedback={noop} /></MemoryRouter>);
  assert.equal(none.container.querySelector('.site-footer-row--credits'), null);
});

test('免费 · 不用登录 is printed only while a guest can browse, ♡ save and ask BayBay (decision 4); otherwise 免费', () => {
  assert.deepEqual(footerClaim({ browse: true, save: true, baybay: true }), FREE_NO_SIGN_IN);
  for (const missing of ['browse', 'save', 'baybay'] as const) assert.deepEqual(footerClaim({ ...GUEST_CAPABILITIES, [missing]: false }), FREE_ONLY, missing);
  // The two code paths the guest run relies on: the guest list in this browser, and BayBay's guest mode.
  assert.match(savesKey(), /guest$/);
  assert.match(readFileSync('src/components/BayBayAssistantEntry.tsx', 'utf8'), /访客模式：BayBay 只用 BAYLINK 站内已收录的资料回答/);
  assert.deepEqual(GUEST_CAPABILITIES, { browse: true, save: true, baybay: true });
  const view = render(<MemoryRouter><SiteFooter onFeedback={noop} /></MemoryRouter>);
  assert.equal(view.container.querySelector('.site-footer-line')!.textContent, `${SITE_IDENTITY.zh} · ${FREE_NO_SIGN_IN.zh}`, 'HOME’s exact wording');
  const footer = within(view.container.querySelector('footer')!);
  assert.equal(footer.getByRole('link', { name: '我们怎么核对' }).getAttribute('href'), METHOD_HREF);
  assert.equal(METHOD_HREF, '/about#about-method-title');
  assert.doesNotMatch(view.container.textContent!, /核验/, '核对, never 核验');
  // 简洁显示 drops only 内容目录 (短信说明 stays reachable).
  const css = readFileSync('src/components/site-chrome.css', 'utf8');
  assert.match(css, /html\[data-simple\] \.site-app \.site-footer-archive \{ display:none; \}/);
  assert.ok(footer.getByRole('link', { name: '短信说明' }));
});

test('UI9-R2 OD7: a phone keeps the lockup, search, Aa 字号 and •••; the language choices are the ••• sheet\'s first row', async () => {
  // From 768px the header's own switch: a globe with the language's name, inside the data-lang-switch subtree.
  for (const [locale, name] of [['zh-Hans', '简体中文'], ['zh-Hant', '繁體中文'], ['en', 'English']] as const) {
    await setLocale(locale, false);
    const view = render(<MemoryRouter><LanguageSwitcher /></MemoryRouter>);
    const trigger = view.container.querySelector('[data-lang-switch] summary')!;
    assert.ok(trigger.querySelector('svg'), `${locale}: the globe`);
    assert.equal(trigger.querySelector('.site-language-name')!.textContent, name);
    view.unmount();
  }
  await setLocale('zh-Hans', false);
  const view = render(<MemoryRouter><SiteChrome pathname="/" user={null} messagesCount={0} onAsk={noop} onSearch={noop} onAccount={noop} onCreate={noop} onLogout={noop}><p>page</p></SiteChrome></MemoryRouter>);
  const header = view.container.querySelector('header')!;
  assert.equal(header.querySelectorAll('[data-lang-switch]').length, 1, 'closed: the header holds one switch (the prerender too)');
  const more = header.querySelector<HTMLDetailsElement>('details.site-navigation-more')!;
  await act(async () => { more.open = true; more.dispatchEvent(new dom.window.Event('toggle')); });
  const row = more.querySelector('.site-language-row')!;
  assert.ok(row, 'open: the ••• sheet starts with the language row');
  assert.equal(more.querySelector('.site-navigation-panel')!.firstElementChild, row);
  assert.equal(row.getAttribute('data-lang-switch'), '');
  assert.equal(row.getAttribute('translate'), 'no');
  const choices = within(row as HTMLElement).getAllByRole('button');
  assert.deepEqual(choices.map(button => [button.getAttribute('lang'), button.textContent, button.getAttribute('aria-pressed')]), [['zh-Hans', '简体中文', 'true'], ['zh-Hant', '繁體中文', 'false'], ['en', 'English', 'false']]);
  await act(async () => { more.open = false; more.dispatchEvent(new dom.window.Event('toggle')); });
  assert.equal(more.querySelector('.site-language-row'), null, 'closed again: gone');
  // A choice in the row closes the ••• sheet with focus on •••, before the row unmounts (focus never drops to <body>): the
  // current language (nothing to load) and a switch, once the new language has loaded.
  const summary = more.querySelector('summary')!;
  for (const [name, after] of [['简体中文', '简体中文'], ['English', 'English']] as const) {
    await act(async () => { more.open = true; more.dispatchEvent(new dom.window.Event('toggle')); });
    const choice = within(more.querySelector('.site-language-row') as HTMLElement).getByRole('button', { name });
    choice.focus();
    await act(async () => { fireEvent.click(choice); });
    await waitFor(() => assert.equal(more.open, false, `${name}: the sheet closes`));
    assert.equal(dom.window.document.activeElement, summary, `${name}: focus on the ••• summary`);
    await act(async () => { more.dispatchEvent(new dom.window.Event('toggle')); });
    assert.equal(more.querySelector('.site-language-row'), null, `${name}: the row is gone`);
    assert.equal(header.querySelector('.site-header-utilities [data-lang-switch] .site-language-name')!.textContent, after);
  }
  await act(async () => { await setLocale('zh-Hans', false); });
  const css = readFileSync('src/components/site-chrome.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  // Below 768px the header's switch steps out and the lockup grows (≥120px at 390); from 768px the sheet row hides.
  assert.match(css, /@media\(max-width:767px\) \{[^@]*\.site-app \.site-header-utilities>\.site-language \{ display:none; \}/);
  assert.match(css, /@media\(max-width:767px\) \{[^@]*\.site-app \.site-header-brand img \{ width:132px; \}/);
  assert.match(css, /@media \(min-width:768px\) \{ \.site-app \.site-language-row \{ display:none; \} \}/);
  assert.doesNotMatch(css, /site-language-(?:pair|short)/, 'the phone trigger\'s short labels are gone with it');
  // C P21: until the PNG is in, the stylesheet paints the lockup in vector (no request), so a slow load shows the logo; the
  // PNG is mostly transparent, so the vector steps out once it has loaded (it would thicken the soft edges).
  assert.match(css, /\.site-app \.site-header-brand img \{ display:block; width:140px; height:auto; \}/);
  assert.match(css, /\.site-app \.site-header-brand img:not\(\[data-loaded\]\) \{ background:url\("data:image\/svg\+xml,%3Csvg [^"]+%3C\/svg%3E"\) 0 0 \/ 100% 100% no-repeat; \}/);
  const img = header.querySelector<HTMLImageElement>('.site-header-brand img')!;
  assert.equal(Number(img.getAttribute('width')) / Number(img.getAttribute('height')), 4, 'the box has the PNG\'s 4:1 ratio before it loads');
  assert.equal(img.dataset.loaded, undefined, 'not loaded yet: the placeholder paints');
  fireEvent.load(img);
  assert.equal(img.dataset.loaded, '', 'loaded: the placeholder steps out');
});

test('G21: a tapped tab looks current at once (data-pending) while aria-current stays the pathname’s, until the route changes', () => {
  const view = render(<MemoryRouter><SiteMobileNavigation pathname="/" notificationCount={0} onAsk={noop} /></MemoryRouter>);
  const events = view.getByRole('link', { name: '活动' });
  fireEvent.pointerDown(events, { button: 0 });
  assert.ok(events.hasAttribute('data-pending'));
  assert.equal(events.getAttribute('aria-current'), null, 'OPUS contract: aria-current comes from the pathname');
  assert.equal(view.getByRole('link', { name: '首页' }).getAttribute('aria-current'), 'page');
  // A press dragged away (still pressed) lets go.
  fireEvent.pointerLeave(events, { buttons: 1 });
  assert.equal(events.hasAttribute('data-pending'), false);
  // ctrl / ⌘ / shift / alt opens a new tab or window: this page does not change, so no pending look.
  for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey'] as const) {
    fireEvent.pointerDown(events, { button: 0, [modifier]: true });
    assert.equal(events.hasAttribute('data-pending'), false, modifier);
  }
  fireEvent.pointerDown(events, { button: 0 });
  view.rerender(<MemoryRouter><SiteMobileNavigation pathname="/events" notificationCount={0} onAsk={noop} /></MemoryRouter>);
  assert.equal(view.getByRole('link', { name: '活动' }).hasAttribute('data-pending'), false);
  assert.equal(view.getByRole('link', { name: '活动' }).getAttribute('aria-current'), 'page');
});

test('BB launcher (d): pointing at 问 BayBay starts loading the panel; A6: the button says it is an AI helper', () => {
  const view = render(<MemoryRouter><SiteMobileNavigation pathname="/" notificationCount={0} onAsk={noop} /></MemoryRouter>);
  const ask = view.getByRole('button', { name: '问 BayBay（AI 助手）' });
  assert.equal(isBayBayWarm(), false);
  fireEvent.pointerEnter(ask);
  assert.equal(isBayBayWarm(), true);
  const overlay = readFileSync('src/app/OverlayHost.tsx', 'utf8');
  assert.match(overlay, /lazyChunk\(\(\) => import\('\.\.\/components\/BayBayAssistantEntry'\), m => m\.BayBayAssistantEntry\)/);
  assert.match(readFileSync('src/app/baybay-preload.ts', 'utf8'), /import\('\.\.\/components\/BayBayAssistantEntry'\)/, 'the warm-up loads the dialog’s own chunk');
  // (e) the 正在打开 BayBay… fallback draws F's sheet frame at the panel's size, without a desktop scrim (decision 7).
  assert.match(overlay, /className=\{`ui-sheet-backdrop site-chunk-sheet site-chunk-sheet--\$\{drawer \? 'drawer' : 'search'\}`\}/);
  assert.match(overlay, /<SheetChunkFallback drawer title=\{t\('问 BayBay', 'Ask BayBay'\)\} label=\{t\('正在打开 BayBay…'/);
  assert.match(overlay, /<SheetChunkFallback title=\{t\('搜索', 'Search'\)\} label=\{t\('正在打开搜索…'/);
  const css = readFileSync('src/components/site-chrome.css', 'utf8');
  // The scrim rule must outrank ui.css's .ui-sheet-backdrop (one class, loaded later): two classes.
  assert.match(css, /@media \(min-width:1024px\) \{\s*\.ui-sheet-backdrop\.site-chunk-sheet--drawer \{ background:transparent; \}\s*\.site-chunk-sheet--drawer \.ui-sheet \{ width:440px; \}/, 'BayBay’s 440px drawer');
  // On a phone each fallback is as tall as the sheet that replaces it: the empty search sheet, BayBay's panel.
  assert.match(css, /@media \(max-width:1023px\) \{\s*\.site-chunk-sheet--search \.ui-sheet \{ height:min\(42rem,85dvh\); \}\s*\.site-chunk-sheet--drawer \.ui-sheet \{ height:min\(43rem,85dvh\); \}/);
});

test('one account tool: 我的 for a guest (the page on /me, the section on its sub-pages); no separate 登录 in the header', () => {
  for (const [pathname, current] of [['/me', 'page'], ['/my-week', 'true'], ['/me/bookings', 'true'], ['/guides', null]] as const) {
    const view = render(<MemoryRouter initialEntries={[pathname]}><SiteChrome pathname={pathname} user={null} messagesCount={0} onAsk={noop} onSearch={noop} onAccount={noop} onCreate={noop} onLogout={noop}><p>page</p></SiteChrome></MemoryRouter>);
    const header = within(view.container.querySelector('header')!);
    const mine = header.getByRole('link', { name: '我的' });
    assert.equal(mine.getAttribute('href'), '/me');
    assert.equal(mine.getAttribute('aria-current'), current, pathname);
    assert.equal(header.queryByRole('button', { name: '登录' }), null);
    view.unmount();
  }
});

test('the chrome CSS: no blur, no ad-hoc shadows, no transition: all, every :hover gated, 14px tab labels, px heights', () => {
  for (const file of ['src/components/site-chrome.css', 'src/components/site-dialogs.css', 'src/design.css', 'src/components/about-baylink.css', 'src/components/legal-page.css', 'src/components/not-found.css']) {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(css, /backdrop-filter:\s*blur/, `${file}: no blur (N10)`);
    assert.doesNotMatch(css, /transition:\s*all/, `${file}: no transition: all`);
    if (file !== 'src/design.css') assert.doesNotMatch(css.replace(/var\(--e[12]\)/g, ''), /box-shadow:\s*(?!none|inset|var\()[^;}]*rgb/, `${file}: shadows are e1 / e2 (N10)`);
    // Every :hover sits inside (hover:hover) and (pointer:fine) (N23).
    postcss.parse(css).walkRules(rule => {
      if (!rule.selector.includes(':hover')) return;
      let gated = false;
      for (let parent = rule.parent; parent; parent = parent.parent) if (parent.type === 'atrule' && /hover:\s*hover/.test((parent as AtRule).params)) gated = true;
      assert.ok(gated, `${file}: ungated ${rule.selector}`);
    });
  }
  // N10: no stylesheet reads a --chrome-shadow-* token nobody defines (an undefined var() drops the shadow, and a fallback
  // brings back an ad-hoc one).
  const sources = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sources(`${dir}/${entry.name}`) : entry.name.endsWith('.css') ? [`${dir}/${entry.name}`] : []);
  const all = sources('src').filter(file => !file.startsWith('src/opus-bay')).map(file => readFileSync(file, 'utf8')).join('\n');
  const defined = new Set([...all.matchAll(/(--chrome-shadow-[\w-]+)\s*:/g)].map(match => match[1]));
  for (const [, token] of all.matchAll(/var\((--chrome-shadow-[\w-]+)/g)) assert.ok(defined.has(token), `${token} is used but never defined`);
  assert.doesNotMatch(readFileSync('src/features/posts/community.css', 'utf8'), /chrome-shadow-pop/, 'the post menu uses e2');
  const chrome = readFileSync('src/components/site-chrome.css', 'utf8');
  assert.match(chrome, /html:root \{ --site-mobile-nav-height:calc\(64px \+ env\(safe-area-inset-bottom,0px\)\); \}/);
  assert.match(chrome, /html:root\[data-simple\] \{ --site-mobile-nav-height:calc\(76px \+ env\(safe-area-inset-bottom,0px\)\); \}/);
  // 14px tab labels: the item's size, which its labels inherit (tokens.css's 13px !important label rule is gone, so the
  // chrome needs no !important of its own).
  assert.match(chrome, /\.site-app \.site-mobile-nav \.site-mobile-item \{[^}]*font-size:var\(--fs-meta\);/);
  assert.doesNotMatch(chrome, /!important/);
});

test('/about#about-method-title: 我们怎么核对 follows the H1 block, is the only anchor, and the layout’s scroll lands it', async () => {
  const scrolled: string[] = [];
  dom.window.HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) { scrolled.push(this.id); };
  const app = { openBayBay: noop };
  // The page itself never scrolls, so Back restores the reader's own place: the layout's usePageScroll lands the hash.
  const alone = render(<MemoryRouter initialEntries={['/about#about-method-title']}><Routes><Route element={<Outlet context={app} />}><Route path="/about" element={<AboutPage />} /></Route></Routes></MemoryRouter>);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  assert.deepEqual(scrolled, [], 'AboutPage has no scroll of its own');
  alone.unmount();
  const Layout = () => { usePageScroll(useLocation()); return <Outlet context={app} />; };
  const view = render(<MemoryRouter initialEntries={['/about#about-method-title']}><Routes><Route element={<Layout />}><Route path="/about" element={<AboutPage />} /></Route></Routes></MemoryRouter>);
  await waitFor(() => assert.deepEqual(scrolled, ['about-method-title']));
  const ids = [...view.container.querySelectorAll('[id]')].map(node => node.id);
  assert.equal(ids.filter(id => id === 'about-method-title').length, 1);
  assert.ok(!ids.includes('how-we-check'));
  const sections = [...view.container.querySelectorAll('section.about-section')].map(section => section.getAttribute('aria-labelledby'));
  assert.deepEqual(sections, ['about-method-title', 'about-uses-title', 'about-images-title', 'about-contact-title']);
  assert.ok(view.container.querySelector('aside.about-aside [aria-labelledby="about-contact-title"]'), '联系与反馈 is the aside');
  assert.equal(view.container.querySelector('.about-policies')!.textContent, '社区安全指南', 'the legal row is the footer’s; the safety guide stays');
  // The heading lands 16px under the sticky header (64 desktop, 56 phone, 64 at 特大 and in 简洁显示).
  const design = readFileSync('src/design.css', 'utf8');
  assert.match(design, /html \{ scroll-padding-top:80px;/);
  assert.match(design, /@media \(max-width:767px\) \{ html \{ scroll-padding-top:72px; \} html:is\(\[data-reading=extra-large\],\[data-simple\]\) \{ scroll-padding-top:80px; \} \}/);
});

test('the search sheet (content arrangement §6): empty, typed (groups in order), no match, and 简洁显示', async () => {
  const { QuickExplore } = await import('../src/components/QuickExplore');
  const { setSimpleDisplay } = await import('../src/lib/reading-preferences');
  const opened: string[] = [];
  const view = render(<QuickExplore onClose={noop} onSearch={noop} onNavigate={path => opened.push(path)} onAsk={noop} />);
  const dialog = await view.findByRole('dialog', { name: '搜索' });
  assert.deepEqual([...dialog.querySelectorAll('.quick-suggestions .ui-chip')].map(chip => chip.textContent), ['小费', '这个周末旧金山免费活动', '南湾新店', '雨天室内亲子活动']);
  const rows = within(dialog).getAllByRole('option').map(option => option.querySelector('.quick-result-title')!.textContent);
  assert.deepEqual(rows, ['问 BayBay（AI 助手）', '活动日历', '长辈与家属', '按地区找景点', '生活工具箱']);
  assert.ok(within(dialog).getAllByRole('option')[0].querySelector('.site-ai-tag'), 'the same AI tag as the tab bar');
  assert.doesNotMatch(dialog.textContent!, /这个周末有什么|发现湾区|按分类探索/);
  fireEvent.click(within(dialog).getByRole('option', { name: /长辈与家属/ }));
  assert.deepEqual(opened, ['/guides?topic=elders']);
  // Typed: the groups follow 近期活动 → 优惠与福利 → 新店 → 站内指南 → 景点 → 工具 → 参考 · 待确认 → 继续探索.
  const input = within(dialog).getByRole('combobox');
  fireEvent.change(input, { target: { value: '免费' } });
  const order = ['近期活动', '优惠与福利', '新店', '站内指南', '景点', '工具', '参考 · 待确认', '继续探索'];
  const groups = [...dialog.querySelectorAll('.quick-group')].map(label => order.findIndex(name => label.textContent!.startsWith(name))).filter(index => index >= 0);
  assert.ok(groups.length >= 2, groups.join());
  assert.deepEqual(groups, [...groups].sort((a, b) => a - b), 'groups in reading order');
  assert.equal(groups.at(-1), 7, '继续探索 last');
  // No match: F's EmptyState with the recovery as the one primary; 问 BayBay stays the second step in 继续探索.
  fireEvent.change(input, { target: { value: '不存在的问句xyz' } });
  assert.ok(within(dialog).getByRole('heading', { name: '没找到「不存在的问句xyz」' }));
  assert.deepEqual(within(dialog).getAllByRole('button').filter(button => button.getAttribute('data-variant') === 'primary').map(button => button.textContent), ['看本周末全部活动']);
  assert.match(within(dialog).getAllByRole('option').at(-1)!.textContent!, /交给 BayBay 继续安排/);
  view.unmount();
  act(() => setSimpleDisplay(true));
  const simple = render(<QuickExplore onClose={noop} onSearch={noop} onNavigate={noop} onAsk={noop} />);
  const sheet = await simple.findByRole('dialog', { name: '搜索' });
  assert.equal(sheet.querySelectorAll('.quick-suggestions .ui-chip').length, 3);
  assert.deepEqual(within(sheet).getAllByRole('option').map(option => option.querySelector('.quick-result-title')!.textContent), ['问 BayBay（AI 助手）', '长辈与家属']);
  simple.unmount();
  act(() => setSimpleDisplay(false));
});

test('UI9-R1 chrome: footer targets, 简洁 footer, pre-footer step, inside rings, selected looks, AI tag, route bar, Aa samples', () => {
  const source = readFileSync('src/components/site-chrome.css', 'utf8');
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  // N25: every footer link and button is a 44px target (48 in 简洁显示), 12px each side; the row reaches 12px past its column.
  assert.match(css, /\.site-app \.site-footer-row \{ display:flex; flex-wrap:wrap; margin:0 calc\(-1 \* var\(--sp-3\)\); \}/);
  assert.match(css, /\.site-app \.site-footer-row>:is\(a,button\) \{ display:inline-flex; align-items:center; min-height:var\(--tool-size\); padding:0 var\(--sp-3\);/);
  // D6: 简洁显示 keeps the two link lines only (the brand column and 内容目录 hide).
  assert.match(css, /html\[data-simple\] \.site-app \.site-footer-about \{ display:none; \}/);
  assert.match(css, /html\[data-simple\] \.site-app \.site-footer-archive \{ display:none; \}/);
  // N15: the footer's own step above it is 12px; a page's 48px end padding lands at ≤64.
  assert.match(css, /\.site-app \.site-footer \{ margin-top:var\(--sp-3\);/);
  // N09: rings that touch the window edge (desktop logo / tabs / 更多, the phone tab bar, footer links) are drawn inside …
  assert.match(css, /\.site-app :is\(\.site-footer-row>:is\(a,button\),\.site-header-brand,\.site-nav-link,\.site-navigation-more>summary,\.site-mobile-item\):focus-visible \{ outline-offset:calc\(-2 \* var\(--focus-ring-width\)\); border-radius:var\(--r-sm\); \}/);
  // … but the phone/tablet 更多 tool keeps the outside ring: inside, a brand ring on its ink selected fill is 2.27:1.
  let phoneMore = false;
  postcss.parse(source).walkRules(rule => {
    if (rule.selector !== '.site-app .site-navigation-more>summary:focus-visible') return;
    const media = rule.parent?.type === 'atrule' ? (rule.parent as AtRule).params : '';
    assert.match(media, /max-width:\s*1023px/, 'the outside 更多 ring is phone/tablet only');
    rule.walkDecls('outline-offset', decl => { phoneMore = decl.value === 'var(--focus-ring-offset)'; });
  });
  assert.ok(phoneMore, 'the phone 更多 tool keeps the outside ring');
  // N08: the chrome's selected looks are FOUNDATION's two (ink line, ink fill); brand-tint is not one of them.
  assert.match(css, /background:var\(--selected-line\)/);
  // UI9-R1-BUTTONS: with the selected edge (the rows carry a transparent 1px edge at rest), as a checked chip.
  assert.match(css, /\.site-app :is\(\.site-secondary-nav a\[aria-current=page\],:is\(\.site-language-menu,\.site-language-options\)>button\[aria-pressed=true\]\) \{ border-color:var\(--selected-line\); background:var\(--selected-bg\); color:var\(--selected-fg\); \}/);
  assert.match(css, /\.site-mobile-item:is\(\.is-active,\[data-pending\]\) \.site-mobile-icon \{ background:var\(--selected-bg\); color:var\(--selected-fg\); \}/);
  // C P18 (UI9-R2): the phone/tablet ••• of a 更多 page is the tab bar's 30px pill in cream with a brand dot, not an ink square.
  assert.match(css, /\.site-app \.site-navigation-more>summary\.is-active::before \{ content:''; position:absolute; inset:7px 0; z-index:-1; border-radius:var\(--r-pill\); background:var\(--color-surface-2\); \}/);
  assert.match(css, /\.site-app \.site-navigation-more>summary\.is-active::after \{ display:block;[^}]*border-radius:var\(--r-circle\); background:var\(--color-brand\);/);
  assert.doesNotMatch(css, /\.site-navigation-more>summary\.is-active \{[^}]*selected-bg/);
  // D2: lime means 免费 only; the AI tag is outlined brand on white.
  const aiTag = css.match(/\.site-ai-tag \{[^}]*\}/)?.[0] ?? '';
  assert.match(aiTag, /border:1px solid;/);
  assert.match(aiTag, /background:var\(--color-surface\); color:var\(--color-brand\);/);
  assert.doesNotMatch(aiTag, /highlight|lime/);
  // N24 + 简洁显示: the route bar's loop reads the motion scale and, with durations 0, stands full width (no 40% box).
  assert.match(css, /\.site-route-progress::before \{[^}]*inset:0;[^}]*animation:site-route-run calc\(6 \* var\(--dur-3\)\)/);
  assert.doesNotMatch(css, /\.site-route-progress::before \{[^}]*width:40%/);
  assert.match(css, /@keyframes site-route-run \{ from \{ translate:-40%; scale:\.4 1; \} to \{ translate:100%; scale:\.4 1; \} \}/);
  // Aa sheet: the 字 samples read the whole-pixel kept steps only (no fractional calc()).
  const sizes: string[] = [];
  postcss.parse(readFileSync('src/components/site-dialogs.css', 'utf8')).walkRules(/reading-sample/, rule => rule.walkDecls('font-size', decl => { sizes.push(decl.value); }));
  assert.ok(sizes.length >= 4);
  for (const size of sizes) assert.match(size, /^var\(--fs-keep-(20|24|28|32)\)$/);
});
