// UI9-R1-POLISH-2 (followups-r2 16–24 from the #64 live check, DECISIONS 31 D5):
//   /category's prerendered first paint is the board's own loading state (no other page, CLS 0) · loading cards with a post
//   card's lines · one row for the results line and the layout switch · each board's own short search example · the board's
//   guides heading and links as the app's strip, kept by the app on the prerendered URL (no drop and return)
//   /en guests send no translation request and read "Original text" · the promotions dialog leaves with its exit, one close
//   control, above the phone tab bar; its loading tile has the tile's own lines · the post page rises / sinks and keeps the
//   content line and appears at once when it replaces an open one (sign-in) · one dialog look (feedback, guide picture, desktop
//   Aa panel) · /explore D5
import assert from 'node:assert/strict';
import test, { after, afterEach, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import postcss, { type Rule } from 'postcss';
import React from 'react';
import type { PostData, UserData } from '../src/lib/types';

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"><main><h1>首页</h1></main></div></body></html>', { url: 'https://www.baylink.us/category/rent', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// Motion allowed (no reduced motion, not 简洁显示): the exits play before onClose.
dom.window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof dom.window.matchMedia;
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, fireEvent, cleanup, act, waitFor, within } = await import('@testing-library/react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { StaticRouter } = await import('react-router');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const { default: CommunityBoard, CategoryBoardPrerender, loadingBoardContext } = await import('../src/pages/CommunityBoard');
const { CategoryGuidesPrerender, CategoryHubPrerender } = await import('../src/components/HubPrerender');
const { CategoryGuideStrip } = await import('../src/components/CategoryGuideStrip');
const { PostCard } = await import('../src/features/posts/PostCard');
const { PostDetailModal } = await import('../src/features/posts/PostDetailModal');
const { AdDetailModal, OfficialAds } = await import('../src/features/ads/OfficialAds');
const { EXIT_MS } = await import('../src/components/ui/closing');
const { getGuidesForCategorySlug } = await import('../src/data/guides');
const { SLUG_TO_CATEGORY } = await import('../src/routing');

const originalRequest = api.request;
const pending = (() => new Promise(() => {})) as typeof api.request;
before(() => { api.request = pending; });
afterEach(async () => { cleanup(); api.request = pending; localStorage.clear(); document.documentElement.removeAttribute('data-post-sheet'); await setLocale('zh-Hans', false); });
after(() => { api.request = originalRequest; styles.deregister(); dom.window.close(); });

/** Declarations of the rules in `file` whose selector list contains `selector` (in the @media / @supports `media`, '' = none). */
function declarations(file: string, selector: string, media = '') {
  const out: Record<string, string> = {};
  postcss.parse(readFileSync(file, 'utf8')).walkRules(rule => {
    const parent = rule.parent as unknown as { type: string; params?: string };
    const inMedia = parent.type === 'atrule' ? parent.params ?? '' : '';
    if (inMedia !== media || !(rule as Rule).selectors.includes(selector)) return;
    rule.walkDecls(declaration => { out[declaration.prop] = declaration.value; });
  });
  return out;
}
const COMMUNITY = 'src/features/posts/community.css';

const noop = () => {};
const post = (id: string, overrides: Partial<PostData> = {}): PostData => ({
  id, authorId: 'member-1', author: { id: 'member-1', nickname: '邻居甲' }, type: 'provider', title: `Hayward 独立 Studio 出租 ${id}`, city: '东湾',
  category: '租屋', timeInfo: '', budget: '$1900', description: '近 BART。', contactInfo: null, likesCount: 0, hasLiked: false, imageUrls: [],
  commentsCount: 0, comments: [], createdAt: Date.now(), status: 'active', confirmedAt: null, ...overrides,
});
/** The board inside the app's outlet context, as the app renders it before the posts arrive (the prerender's own context). */
const loadingBoard = (entry: string, slug: string, Board: typeof CommunityBoard = CommunityBoard) =>
  render(<MemoryRouter initialEntries={[entry]}><Routes><Route element={<Outlet context={loadingBoardContext(slug)} />}>
    <Route path="/category/:categorySlug" element={<div className="bay-home"><Board onScrollToFeed={noop} scrollRequest={0} /></div>} />
  </Route></Routes></MemoryRouter>);
const prerender = (slug: string, location = `/category/${slug}`, basename?: string) => new JSDOM(renderToStaticMarkup(
  <StaticRouter basename={basename} location={location}><CategoryBoardPrerender slug={slug} guideStrip={<CategoryGuidesPrerender slug={slug} />} /></StaticRouter>)).window.document;

test('/category: the prerendered page is the board in its loading state, box for box the app\'s first render (no other page, CLS 0)', async () => {
  for (const slug of ['rent', 'used']) {
    const page = prerender(slug);
    const view = loadingBoard(`/category/${slug}`, slug);
    for (const selector of ['.cm-board__header', '.cm-search', '.cm-board__filters', '.cm-board__count', '.ui-feed']) {
      assert.equal(page.querySelector(selector)!.outerHTML, view.container.querySelector(selector)!.outerHTML, `${slug} ${selector}`);
    }
    assert.equal(page.querySelector('.bay-home > section.cm-board')!.getAttribute('data-mode'), 'category', 'HomePage\'s wrapper around the board');
    assert.equal(page.querySelectorAll('.cm-card--skeleton').length, 4);
    // the end-of-list line's room under the loading row: the guides strip stays put when a one-row board arrives
    assert.equal(page.querySelector('[aria-busy=true] .cm-board__end')!.getAttribute('aria-hidden'), 'true');
    // the board's guides in their place for readers and crawlers before the app runs: the strip's three guides
    assert.deepEqual([...page.querySelectorAll('.cm-guides__list a')].map(link => link.getAttribute('href')), getGuidesForCategorySlug(slug, 3).map(guide => `/guides/${guide.slug}`));
    // …box for box the app's own strip once it has loaded: its heading (租房前先看, not a generic one), links and titles
    const strip = await waitFor(() => { const found = view.container.querySelector('.cm-guides'); assert.ok(found); return found; }, { timeout: 10000 });
    assert.equal(page.querySelector('.cm-guides')!.outerHTML, strip.outerHTML, `${slug} .cm-guides`);
    assert.ok(page.querySelector('.cm-board__notes'), 'the safety notes and the other boards');
    assert.doesNotMatch(page.body.textContent!, /最新帖子和地区筛选会在页面加载后显示/);
    cleanup();
  }
  await setLocale('en', false);
  const english = prerender('rent', '/en/category/rent', '/en');
  assert.equal(english.querySelector('h1')!.textContent, 'Housing');
  assert.equal(english.querySelector('.cm-guides__list a')!.getAttribute('href')!.startsWith('/en/guides/'), true, 'links keep the page\'s language');
  // paused (COMMUNITY_VISIBLE = false, scripts/prerender.tsx): the paused notice
  await setLocale('zh-Hans', false);
  assert.match(renderToStaticMarkup(<StaticRouter location="/category/rent"><CategoryHubPrerender slug="rent" /></StaticRouter>), /邻里信息暂停中/);
  // the prerender links the board's stylesheets and preloads its chunk on the category pages only
  const script = readFileSync('scripts/prerender.tsx', 'utf8');
  assert.match(script, /const boardModules = \(path: string\) => COMMUNITY_VISIBLE && path\.startsWith\('\/category\/'\) \? \['src\/pages\/CommunityBoard\.tsx'\] : \[\];/);
  assert.match(script, /COMMUNITY_VISIBLE\s+\? <CategoryBoardPrerender slug=\{slug\} guideStrip=\{<CategoryGuidesPrerender slug=\{slug\} \/>\} \/> : <CategoryHubPrerender slug=\{slug\} \/>/);
});

test('/category: the prerendered guides heading is each board\'s own (the app strip\'s words), in every language', async () => {
  for (const locale of ['zh-Hans', 'en', 'zh-Hant'] as const) {
    await setLocale(locale, false);
    for (const slug of Object.keys(SLUG_TO_CATEGORY)) {
      const page = prerender(slug);
      const view = render(<MemoryRouter><CategoryGuideStrip categorySlug={slug} /></MemoryRouter>);
      const heading = page.querySelector('.cm-guides__title');
      if (!heading) { assert.equal(getGuidesForCategorySlug(slug, 3).length, 0, `${slug}: guides but no strip`); cleanup(); continue; }
      await waitFor(() => assert.equal(view.container.querySelector('.cm-guides__title')?.textContent, heading.textContent, `${locale} ${slug}`), { timeout: 10000 });
      cleanup();
    }
  }
});

test('/category: on the URL it was prerendered for, the app keeps the prerendered guides strip from its first render (no drop and return)', async () => {
  const root = document.getElementById('root')!;
  const before = root.innerHTML;
  const prerendered = prerender('rent').querySelector('.bay-home')!.outerHTML;
  root.innerHTML = `<main data-prerender-path="/category/rent">${prerendered}</main>`;
  // a fresh copy of the board's module reads the prerendered page, as the chunk does when HomePage loads it before the first render
  const fresh = await import(`../src/pages/CommunityBoard.tsx?prerendered=${Date.now()}`) as { default: typeof CommunityBoard };
  root.innerHTML = before;
  const view = loadingBoard('/category/rent', 'rent', fresh.default);
  assert.equal(view.container.querySelector('.cm-guides')!.outerHTML, new JSDOM(prerendered).window.document.querySelector('.cm-guides')!.outerHTML, 'the same strip, at once');
  cleanup();
  // another URL (another board, a language switch) loads the board's own strip as before
  dom.reconfigure({ url: 'https://www.baylink.us/category/used' });
  try {
    const other = loadingBoard('/category/used', 'used', fresh.default);
    assert.equal(other.container.querySelector('.cm-guides'), null);
    await waitFor(() => assert.ok(other.container.querySelector('.cm-guides__title')), { timeout: 10000 });
    assert.equal(other.container.querySelector('.cm-guides__title')!.textContent, '二手交易先看');
  } finally { dom.reconfigure({ url: 'https://www.baylink.us/category/rent' }); }
});

test('/category: a loading card has a post card\'s own lines (cover, two title lines, price, meta, /en original line, status)', async () => {
  const card = prerender('rent').querySelector('.cm-card--skeleton')!;
  assert.equal(card.getAttribute('aria-hidden'), 'true');
  assert.deepEqual([...card.children].map(child => child.className), ['ui-feed-card__title cm-card__title', 'ui-feed-card__media', 'cm-card__price', 'ui-feed-card__meta cm-card__meta', 'cm-status']);
  assert.equal(card.querySelectorAll('.ui-feed-card__title .ui-skeleton').length, 2, 'two title lines');
  assert.ok(card.querySelector('.ui-feed-card__media > .ui-skeleton[data-shape=cover]'), 'the cover at the feed\'s ratio');
  await setLocale('en', false);
  assert.ok(prerender('rent', '/en/category/rent', '/en').querySelector('.cm-card--skeleton .cm-card__translation .post-translation'), '/en: the Original text line');
  assert.equal(declarations(COMMUNITY, '.cm-card--skeleton')['pointer-events'], 'none');
  // the results line wraps beside the layout switch, which keeps the top right (it moved 22px on a phone)
  assert.equal(declarations(COMMUNITY, '.cm-board__results')['align-items'], 'flex-start');
  assert.equal(declarations(COMMUNITY, '.cm-board__results')['flex-wrap'], undefined);
  assert.equal(declarations(COMMUNITY, '.cm-board__tools').flex, 'none');
});

test('/category: each board names its own short search example (whole at 特大 on a 390 phone)', async () => {
  assert.equal(prerender('rent').querySelector('.cm-search input')!.getAttribute('placeholder'), '如「单间」或城市名');
  assert.equal(prerender('used').querySelector('.cm-search input')!.getAttribute('placeholder'), '如「沙发」或城市名');
  await setLocale('en', false);
  // English: an example that finds posts (the API searches their own, mostly Chinese, words and the English area names)
  assert.equal(prerender('rent', '/en/category/rent', '/en').querySelector('.cm-search input')!.getAttribute('placeholder'), 'Try “Studio” or a city');
  assert.equal(prerender('used', '/en/category/used', '/en').querySelector('.cm-search input')!.getAttribute('placeholder'), 'Try “East Bay”');
  await setLocale('zh-Hant', false);
  assert.equal(prerender('rent', '/zh-Hant/category/rent', '/zh-Hant').querySelector('.cm-search input')!.getAttribute('placeholder'), '如「單間」或城市名');
});

test('/en: a guest\'s cards and post page send no translation request and say "Original text" (API H10: members translate)', async () => {
  const calls: string[] = [];
  api.request = (async (path: string) => { calls.push(path); return path.startsWith('/posts?') ? { posts: [] } : {}; }) as typeof api.request;
  await setLocale('en', false);
  const card = render(<MemoryRouter><PostCard post={post('g1')} layout="grid" /></MemoryRouter>);
  assert.equal(card.container.querySelector('[data-post-original]')!.textContent, 'Original text');
  cleanup();
  const sheet = render(<MemoryRouter><PostDetailModal post={post('g2')} currentUser={null} onClose={noop} onLoginNeeded={noop} onOpenChat={noop} onDeleted={noop}
    onImageClick={noop} onShare={noop} showToast={noop} onAskBayBay={noop} /></MemoryRouter>);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  assert.ok(within(sheet.getByRole('dialog')).getByText('Original text'));
  // the post page offers the way forward: members translate
  let signIn = 0;
  sheet.rerender(<MemoryRouter><PostDetailModal post={post('g2')} currentUser={null} onClose={noop} onLoginNeeded={() => { signIn += 1; }} onOpenChat={noop} onDeleted={noop}
    onImageClick={noop} onShare={noop} showToast={noop} onAskBayBay={noop} /></MemoryRouter>);
  fireEvent.click(within(sheet.getByRole('dialog')).getByRole('button', { name: 'Sign in to translate' }));
  assert.equal(signIn, 1);
  assert.equal(calls.filter(path => path.endsWith('/translation')).length, 0, 'no POST /posts/:id/translation for a guest');
  cleanup();
  // a post written in English needs no note; a Chinese reader's card never shows it
  assert.equal(render(<MemoryRouter><PostCard post={post('g3', { title: 'Room in Fremont', description: 'Near BART', budget: '$900' })} layout="grid" /></MemoryRouter>).container.querySelector('[data-post-original]'), null);
  cleanup();
  await setLocale('zh-Hans', false);
  assert.equal(render(<MemoryRouter><PostCard post={post('g4')} layout="grid" /></MemoryRouter>).container.querySelector('[data-post-original]'), null);
});

test('the promotions dialog has one close control and plays its exit; the admin keeps 删除; it sits above the phone tab bar', async () => {
  let closed = 0;
  const ad = { id: 'ad-1', title: '房地产经纪', content: '湾区房地产经纪', imageUrl: '' };
  const view = render(<AdDetailModal ad={ad} onClose={() => { closed += 1; }} />);
  const dialog = view.getByRole('dialog', { name: '推广详情' });
  assert.deepEqual(within(dialog).getAllByRole('button').map(button => button.getAttribute('aria-label') || button.textContent), ['关闭', '复制推广信息']);
  assert.equal(dialog.querySelector('.cm-ad-dialog__foot'), null, 'no full-width 关闭');
  const started = Date.now();
  fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
  assert.ok(dialog.classList.contains('is-closing'), 'the exit plays');
  assert.equal(closed, 0);
  await waitFor(() => assert.equal(closed, 1), { timeout: 2000 });
  assert.ok(Date.now() - started >= EXIT_MS - 5);
  cleanup();
  const admin = render(<AdDetailModal ad={ad} onClose={noop} isAdmin onDelete={noop} />);
  assert.ok(within(admin.getByRole('dialog')).getByRole('button', { name: '删除' }).closest('.cm-ad-dialog__foot'));
  assert.equal(declarations(COMMUNITY, '.cm-ad-dialog.is-closing').animation, 'ui-fade-out var(--dur-2) var(--ease-in) forwards');
  assert.equal(declarations(COMMUNITY, '.cm-ad-dialog', '(max-width:1023px)')['padding-bottom'], 'calc(var(--site-mobile-nav-height) + var(--sp-3))');
  assert.equal(declarations(COMMUNITY, '.cm-ad-dialog__panel', '(max-width:1023px)')['max-height'], '100%');
});

test('the promotions loading tile has the tile\'s own lines; /en adds the note; lines wrap only where the tile\'s text does', async () => {
  const view = render(<OfficialAds isAdmin={false} showToast={noop} onOpenDetail={noop} />);
  const tile = view.container.querySelector('.cm-ads__track[aria-hidden=true] .cm-ad--skeleton')!;
  assert.equal(tile.querySelectorAll('.cm-ad__text .cm-ad-skeleton__line').length, 2);
  assert.equal(tile.querySelectorAll('.cm-ad__disclosure [data-line=wrap]').length, 1);
  assert.equal(tile.querySelector('.cm-ad-note'), null);
  cleanup();
  await setLocale('en', false);
  const english = render(<OfficialAds isAdmin={false} showToast={noop} onOpenDetail={noop} />).container.querySelector('.cm-ad--skeleton')!;
  assert.equal(english.querySelectorAll('.cm-ad-note .cm-ad-skeleton__line').length, 2);
  assert.equal(english.querySelectorAll('.cm-ad__disclosure .cm-ad-skeleton__line').length, 3);
  assert.equal(declarations(COMMUNITY, 'html:not([data-simple]) .cm-ad-skeleton__line[data-line=wrap]', '(min-width:1024px)').display, 'none');
});

test('the post page plays its exit (the board shows again at once) and keeps its toolbar on the content line', async () => {
  let closed = 0;
  api.request = (async (path: string) => path.startsWith('/posts?') ? { posts: [] } : {}) as typeof api.request;
  const view = render(<MemoryRouter><PostDetailModal post={post('s1')} currentUser={null} onClose={() => { closed += 1; }} onLoginNeeded={noop} onOpenChat={noop}
    onDeleted={noop} onImageClick={noop} onShare={noop} showToast={noop} onAskBayBay={noop} /></MemoryRouter>);
  const sheet = view.getByRole('dialog');
  assert.ok(document.documentElement.hasAttribute('data-post-sheet'));
  fireEvent.click(within(sheet).getByRole('button', { name: '返回' }));
  assert.ok(sheet.classList.contains('is-closing'));
  assert.equal(document.documentElement.hasAttribute('data-post-sheet'), false, 'the board under it shows as the page leaves');
  assert.equal(closed, 0);
  await waitFor(() => assert.equal(closed, 1), { timeout: 2000 });
  cleanup();
  // signing in on the post page remounts it (keyed on the reader): the new page appears at once, it does not rise again
  const props = { post: post('s2'), onClose: noop, onLoginNeeded: noop, onOpenChat: noop, onDeleted: noop, onImageClick: noop, onShare: noop, showToast: noop, onAskBayBay: noop };
  const first = render(<MemoryRouter><PostDetailModal {...props} currentUser={null} /></MemoryRouter>);
  assert.equal(first.getByRole('dialog').classList.contains('cm-sheet--replacing'), false, 'the first opening rises');
  first.rerender(<MemoryRouter><PostDetailModal {...props} currentUser={{ id: 'member-2', nickname: '邻居乙' } as UserData} /></MemoryRouter>);
  assert.ok(first.getByRole('dialog').classList.contains('cm-sheet--replacing'));
  assert.ok(document.documentElement.hasAttribute('data-post-sheet'));
  assert.equal(declarations(COMMUNITY, '.cm-sheet.cm-sheet--replacing:not(.is-closing)').animation, 'none');
  assert.equal(declarations(COMMUNITY, '.cm-sheet').animation, 'ui-sheet-up var(--dur-5) var(--ease-out)');
  assert.equal(declarations(COMMUNITY, '.cm-sheet.is-closing').animation, 'ui-sheet-down var(--dur-3) var(--ease-in) forwards');
  assert.equal(declarations(COMMUNITY, '.cm-sheet', '(min-width:1024px)').animation, 'cm-sheet-in var(--dur-4) var(--ease-out)');
  assert.equal(declarations(COMMUNITY, 'html[data-post-sheet] #root main').animation, 'cm-sheet-under var(--dur-5) linear', 'the board shows while the page rises');
  assert.match(declarations(COMMUNITY, '.cm-sheet__toolbar').padding, / var\(--sp-4\) /, '16px on a phone');
  assert.equal(declarations(COMMUNITY, '.cm-sheet__toolbar,.cm-sheet__bar', '(min-width:768px)')['padding-left'], undefined);
  const wide = postcss.parse(readFileSync(COMMUNITY, 'utf8'));
  let column = '';
  wide.walkRules(rule => { if (rule.selector === '.cm-sheet__toolbar,.cm-sheet__bar') rule.walkDecls('padding-left', decl => { column = decl.value; }); });
  assert.equal(column, 'max(2rem, calc((100% - 60rem) / 2 + 2rem))', 'the body\'s column from 768px');
});

test('one dialog look: feedback, the guide picture and the desktop Aa panel (--r-xl, e2, the ✕ 16px in, never on the picture)', () => {
  const feedback = declarations('src/features/feedback/feedback.css', '.feedback-sheet', '(min-width:768px)');
  assert.equal(feedback['border-radius'], 'var(--r-xl)');
  assert.equal(declarations('src/features/feedback/feedback.css', '.feedback-sheet')['box-shadow'], 'var(--e2)');
  const close = declarations('src/features/feedback/feedback.css', '.feedback-sheet-header>.ui-close', '(min-width:768px)');
  assert.deepEqual([close.position, close.top, close.right], ['absolute', 'var(--sp-4)', 'var(--sp-4)']);
  const lightbox = 'src/components/guide-lightbox.css';
  assert.equal(declarations(lightbox, '.guide-image-close').top, 'var(--sp-4)');
  assert.equal(declarations(lightbox, '.guide-image-dialog').padding, 'calc(var(--sp-4) + var(--control-height) + var(--sp-3)) var(--sp-4) var(--sp-4)', 'the ✕ in its own top row');
  assert.match(declarations(lightbox, '.guide-image-overlay', '(max-width:639px)').padding, / var\(--sp-4\) /, 'the phone panel on the 16px line');
  // the two picture-viewer backgrounds are the captain's (INT5 makes them --scrim-media): not this lane's, either value passes
  assert.match(declarations(lightbox, '.guide-image-overlay').background, /^var\(--scrim(-media)?\)$/);
  assert.match(declarations('src/components/site-dialogs.css', '.site-image-viewer').background, /^var\(--scrim(-media)?\)$/);
  const aa = declarations('src/components/site-dialogs.css', '.ui-sheet.reading-sheet', '(min-width:1024px)');
  assert.deepEqual([aa['align-self'], aa['border-radius'], aa.margin], ['flex-start', 'var(--r-xl)', 'var(--sp-2)']);
  assert.equal(declarations('src/components/site-dialogs.css', '.reading-sheet .ui-sheet__header', '(min-width:1024px)').padding, 'var(--sp-4) var(--sp-4) var(--sp-2) var(--sp-5)');
});

test('/explore D5 (DECISIONS 31): the two filters are ui Selects, the place line is 14px, one 24px gutter; no font-size literals left', async () => {
  const source = readFileSync('src/components/AttractionExplorer.tsx', 'utf8');
  assert.doesNotMatch(source, /<select\b/, 'no native select left');
  assert.equal((source.match(/<Select value=/g) || []).length, 2);
  const css = 'src/styles/attractions.css';
  assert.equal(declarations(css, '.xp-grid').gap, 'var(--sp-5)');
  assert.equal(declarations(css, '.xp-grid', '(max-width:639px)').gap, undefined, 'the phone keeps the same gutter');
  assert.equal(declarations(css, '.xp-card__caption p')['font-size'], 'var(--fs-meta)');
  for (const file of [css, COMMUNITY, 'src/features/feedback/feedback.css', 'src/components/guide-lightbox.css', 'src/components/site-dialogs.css']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /font-size:\s*[\d.]+(px|rem|em)\b/, `${file}: font sizes are tokens`);
  }
});
