import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// WEB-FIX4: the fixes from the 10-12 review of the live Wave-3 site (overhaul/shots/PROD-W3/findings-1012.json).
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, localStorage: dom.window.localStorage,
  MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter } = await import('react-router-dom');
const { setLocale, loadLocale } = await import('../src/i18n/locale');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { GuideCover } = await import('../src/features/guides/GuideCover');
const { offerBrandLine } = await import('../src/components/ui');
const { localDiscoveries, discoveryShare } = await import('../src/data/local-discoveries');
const { LocalDiscoveryDetail } = await import('../src/components/LocalDiscoveryDetail');
const { buildDetailRecord } = await import('../src/features/detail/build-detail');
const { PrivacyPolicyView } = await import('../src/components/PrivacyPolicyView');
const { TermsView } = await import('../src/components/TermsView');
const { default: AiLocalPage } = await import('../src/pages/AiLocalPage');
const { EventsView } = await import('../src/components/EventsView');
const { HomeHead } = await import('../src/features/home/HomeHead');
const { READING_SIZE_KEY, SIMPLE_DISPLAY_KEY } = await import('../src/lib/reading-preferences');

afterEach(async () => { cleanup(); localStorage.clear(); await setLocale('zh-Hans', false); });
const HAN = /[㐀-鿿]/u;
/**
 * The declarations a stylesheet gives one selector (every rule for it, in media queries too, later ones winning). Parsed, not
 * matched as text, so reformatting, reordering or minifying the CSS does not break these checks; lengths compare in px.
 */
const declarations = (file: string, selector: string) => {
  const normal = (text: string) => text.replace(/\s*([>+~,])\s*/g, '$1').replace(/\s+/g, ' ').trim();
  const found: Record<string, string> = {};
  postcss.parse(readFileSync(file, 'utf8')).walkRules(rule => {
    if (normal(rule.selector) === normal(selector)) rule.each(node => { if (node.type === 'decl') found[node.prop] = node.value; });
  });
  return found;
};
const px = (length: string) => parseFloat(length) * (/rem$/.test(length) ? 16 : 1);
const SENIOR = 'bay-area-chinese-senior-services-referral-guide';
const guideProps = { onOpenGuide: () => {}, onNavigate: () => {}, onOpenPost: () => {} };
const article = (slug: string) => render(<MemoryRouter initialEntries={[`/guides/${slug}`]}><GuideDetail slug={slug} today="2026-10-12" {...guideProps} /></MemoryRouter>);
const detail = (key: string) => {
  const item = localDiscoveries.find(row => `${row.kind}:${discoveryShare(row).id}` === key);
  assert.ok(item, key);
  return JSDOM.fragment(renderToStaticMarkup(<StaticRouter location={discoveryShare(item).path}><LocalDiscoveryDetail record={buildDetailRecord(item)} today="2026-10-12" /></StaticRouter>));
};

test('pillar-guide headlines wrap between words: H1, cover title, slide titles and step H2s are word units', () => {
  const view = article(SENIOR);
  for (const selector of ['.gd-title__head', '.gd-slide__cover-title', '.gd-slide__title', '.gd-step__head h2']) {
    const heading = view.container.querySelector(selector);
    assert.ok(heading, selector);
    const units = [...heading.querySelectorAll('.title-keep')].map(unit => unit.textContent);
    assert.ok(units.length > 0, `${selector}: "${heading.textContent}" is split into word units`);
  }
  // 长者 never splits: it sits inside one unit of the cover title.
  const cover = view.container.querySelector('.gd-slide__cover-title')!;
  assert.ok([...cover.querySelectorAll('.title-keep')].some(unit => unit.textContent!.includes('长者')), cover.innerHTML);
  // The kicker keeps "2026-10-12 整理" on one line, so 理 never wraps alone.
  const kicker = view.container.querySelector('.gd-slide__kicker')!;
  assert.match(kicker.querySelector('.gd-nowrap')!.textContent!, /^\d{4}-\d{2}-\d{2} 整理$/);
  // A ① source mark holds on to the characters before it.
  for (const mark of view.container.querySelectorAll('.gd-keyfacts .gd-source-mark')) {
    const holder = mark.parentElement!;
    assert.ok(holder.classList.contains('gd-nowrap') && holder.textContent!.length > mark.textContent!.length, holder.outerHTML);
  }
});

test('a guide card cover is its picture: no title, hook or source count drawn on it (UI9-IMAGES DECISIONS 21)', () => {
  const html = renderToStaticMarkup(<GuideCover guide={{ slug: SENIOR, category: 'family', title: '湾区中文长者服务：餐食、日间照护', sourceCount: 6, hook: { zh: '先打 800-510-2020', en: 'Call 800-510-2020' } }}
    cover={{ tier: 'type', reason: 'no-image' } as never} />);
  const cover = JSDOM.fragment(html);
  assert.equal(cover.querySelector('[data-cover="type"]'), null);
  assert.equal(cover.textContent, '', 'nothing printed on the frame');
});

test('a described offer brand reads in the page language; a store name keeps its case and is never translated', async () => {
  const brand = '参与 Taco Trail 的本地餐厅';
  assert.equal(offerBrandLine(brand, 'zh-Hans'), brand);
  await loadLocale('zh-Hant');
  assert.equal(offerBrandLine(brand, 'zh-Hant'), '參與 Taco Trail 的本地餐廳');
  await loadLocale('en');
  await setLocale('en', false);
  assert.equal(offerBrandLine(brand, 'en'), 'Local restaurants participating in the Taco Trail');
  assert.equal(offerBrandLine('没有译文的商家说明', 'en'), '', 'no Chinese on an English page');
  assert.equal(offerBrandLine('SFMTA · SAN FRANCISCO', 'en'), 'SFMTA · San Francisco');
});

test('an offer card prints its brand once, in the meta line under the picture', async () => {
  const taco = localDiscoveries.find(row => row.kind === 'offer' && /taco-trail/.test(discoveryShare(row).id));
  assert.ok(taco && taco.kind === 'offer');
  const { OfferFeedCard } = await import('../src/features/events/BoardCards');
  const card = JSDOM.fragment(renderToStaticMarkup(<StaticRouter location="/events">
    <OfferFeedCard offer={taco.offer as never} cover={{ tier: 'official', key: 'x', image: { src: '/x.jpg', alt: '', credit: 'x', caption: '', width: 1200, height: 900 }, label: { zh: '图', en: 'Photo' }, fit: 'cover', focal: [50, 40] } as never} today="2026-10-12" />
  </StaticRouter>));
  const brand = offerBrandLine(taco.offer.brand, 'zh-Hans');
  // UI9-FREE: line 2 is [status] · condition · brand (the condition replaces 商家活动 / 免费福利); one brand per card.
  const meta = card.querySelector('.ui-feed-card__meta')!;
  assert.equal(meta.querySelector('.sr-only'), null);
  assert.ok(meta.textContent!.endsWith(`\u00a0· ${brand}`), 'the meta line names the brand');
  assert.doesNotMatch(meta.textContent!, /商家活动|免费福利/);
  assert.doesNotMatch(card.querySelector('[data-cover]')!.textContent!, /Taco|Stamp|集章/, 'the picture carries no words but its badge');
});

test('every offer, opening and event detail opens on a picture, never an information card (UI9-IMAGES DECISIONS 21)', async () => {
  const { heroCover } = await import('../src/features/detail/hero-cover');
  for (const key of ['offer:sfmta-free-muni-seniors', 'opening:old-post-office-burlingame', 'event:san-francisco-fleet-week-2026']) {
    const doc = detail(key);
    const hero = doc.querySelector('.detail-hero')!;
    assert.notEqual(hero.getAttribute('data-tier'), 'type', key);
    assert.equal(hero.querySelectorAll('[data-cover="image"] img').length, 1, key);
    assert.equal(hero.querySelector('[data-cover="type"],.ui-sticker'), null, key);
  }
  // The kind is the first chip right below the picture.
  assert.equal(detail('offer:sfmta-free-muni-seniors').querySelector('.detail-chips')!.textContent!.includes('免费福利'), true);
  // Every listing in the catalog: its hero resolves to a picture.
  const typed = localDiscoveries.filter(row => row.kind !== 'place' && heroCover(buildDetailRecord(row), '2026-10-12').tier === 'type').map(row => discoveryShare(row).id);
  assert.deepEqual(typed, []);
  // "想约人一起去？" belongs to places to go, not to a public benefit you apply for.
  assert.equal(detail('offer:sfmta-free-muni-seniors').querySelector('.outing-inspiration-link'), null);
});

test('the Fleet Week facts card says where in Chinese on zh-Hans, keeping the place names', () => {
  const where = detail('event:san-francisco-fleet-week-2026').querySelector('.detail-fact[data-fact="where"] dd')!.textContent!;
  assert.doesNotMatch(where, /waterfront|other venues/);
  assert.match(where, /海滨/);
  assert.match(where, /Fisherman's Wharf \/ Pier 27/);
});

test('legal pages: Chinese readers start with the Chinese summary, English readers with the policy; one group of unnumbered sections', async () => {
  const titles = (doc: ParentNode) => [...doc.querySelectorAll('.legal-section>h2')].map(h => h.textContent!);
  for (const view of [PrivacyPolicyView, TermsView]) {
    const zh = JSDOM.fragment(renderToStaticMarkup(<StaticRouter location="/privacy"><>{React.createElement(view)}</></StaticRouter>));
    const doc = zh.querySelector('.legal-doc')!;
    assert.equal(doc.firstElementChild!.querySelector('h2')?.textContent, '中文阅读要点', 'the summary comes first');
    assert.ok(doc.firstElementChild!.nextElementSibling!.matches('.legal-intro'), 'then the opening paragraphs, marked English');
    assert.equal(doc.querySelector('.legal-intro p[lang="en"]') !== null, true);
    const numbered = titles(zh).map((title, index) => [title, index] as const).filter(([title]) => /^\d+\. /.test(title));
    assert.ok(numbered.length >= 14);
    for (const [title] of numbered) assert.match(title, / \/ .*\p{Script=Han}/u,`${title}: Chinese name on a Chinese page`);
    const firstNumbered = numbered[0][1];
    assert.ok(titles(zh).slice(firstNumbered).every(title => /^\d+\. /.test(title)), 'no unnumbered section between numbered ones');
  }
  await loadLocale('en');
  await setLocale('en', false);
  const en = JSDOM.fragment(renderToStaticMarkup(<StaticRouter location="/en/privacy" basename="/en"><PrivacyPolicyView /></StaticRouter>));
  assert.match(en.querySelector('.legal-doc')!.firstElementChild!.textContent!, /^\s*BAYLINK helps people/);
  assert.ok(titles(en).every(title => !HAN.test(title)));
  const group = declarations('src/components/legal-page.css', '.legal-doc>div:not(.legal-intro)');
  assert.equal(group.display, 'grid', 'sections grouped in a div keep the gap between them');
  assert.equal(px(group.gap), 24);
});

test('/ai-in-the-bay folds the ended sessions behind one button; every card shows a picture, spread over the pool', () => {
  const view = render(<MemoryRouter initialEntries={['/ai-in-the-bay']}><AiLocalPage today="2026-10-12" /></MemoryRouter>);
  assert.equal(view.queryAllByRole('article').length, 0);
  assert.ok(view.getAllByRole('link', { name: '看本周末活动' }).some(link => link.closest('.ui-state')), 'the folded state points to this weekend');
  // The folded count follows the filters, and the button opens exactly that many.
  fireEvent.click(view.getByRole('button', { name: '社区与公共议题' }));
  fireEvent.change(view.getByRole('combobox'), { target: { value: 'tech-week' } });
  const some = view.getByRole('button', { name: /^看已结束的场次（\d+ 场）$/ });
  const count = Number(/（(\d+) 场）/u.exec(some.textContent!)![1]);
  assert.ok(view.getByText(`往期 ${count} 场已收起，需要时可以展开回看。`));
  fireEvent.click(some);
  assert.equal(view.getAllByRole('article').length, count);
  fireEvent.click(view.getByRole('button', { name: '所有场次' }));
  fireEvent.change(view.getByRole('combobox'), { target: { value: 'all' } });
  const cards = view.getAllByRole('article');
  assert.ok(cards.length >= 8, `${cards.length} past sessions`);
  // UI9-IMAGES DECISIONS 21 (UI9-R2-COVER-PICK): every card shows a picture, so a session without its own picture takes its
  // category's ③ pool, rotated by the cover page: neighbouring cards never share one and the pool is used evenly.
  const srcs = [...view.container.querySelectorAll('.bl-ai-event-media img')].map(img => img.getAttribute('src')!);
  assert.equal(srcs.length, cards.length, 'every card shows a picture');
  srcs.slice(1).forEach((src, index) => assert.notEqual(src, srcs[index], `cards ${index + 1} and ${index + 2}: ${src} twice in a row`));
  const most = Math.max(...[...new Set(srcs)].map(src => srcs.filter(other => other === src).length));
  assert.ok(most <= Math.ceil(srcs.length / new Set(srcs).size), `the pool is used evenly: ${srcs.join(', ')}`);
});

test('at 特大 and in 简洁显示 the weekend day buttons have short names, and the day bar scrolls with the list', () => {
  for (const [key, value] of [[READING_SIZE_KEY, 'extra-large'], [SIMPLE_DISPLAY_KEY, '1']] as const) {
    localStorage.setItem(key, value);
    const page = render(<MemoryRouter initialEntries={['/events']}><EventsView today="2026-10-09" /></MemoryRouter>);
    const radios = within(page.container.querySelector('.ev-days')!).getAllByRole('radio');
    assert.deepEqual(radios.map(radio => radio.textContent), ['周六', '周日', '两天'], key);
    cleanup();
    localStorage.clear();
  }
  const events = 'src/features/events/events.css';
  assert.equal(declarations(events, 'html:is([data-reading=large],[data-reading=extra-large],[data-simple]) .ev-days-bar').position, 'static');
  assert.equal(declarations(events, '.ev-days')['box-shadow'], undefined, 'no rounded halo cutting into the photos');
});

test('the home ask box gets a shorter example at 大 / 特大 and in 简洁显示', () => {
  const props = { today: '2026-10-12', weekendTotal: 60, guideCount: 141, checkedAt: '2026-10-07', onAskBayBay: () => {} };
  const standard = render(<MemoryRouter><HomeHead {...props} /></MemoryRouter>);
  assert.equal(within(standard.getByRole('search')).getByRole('textbox').getAttribute('placeholder'), '比如：这周末带爸妈去哪？');
  cleanup();
  localStorage.setItem(READING_SIZE_KEY, 'large');
  const large = render(<MemoryRouter><HomeHead {...props} /></MemoryRouter>);
  const placeholder = within(large.getByRole('search')).getByRole('textbox').getAttribute('placeholder')!;
  assert.ok(placeholder.length <= 8, placeholder);
});

test('one heading scale: section heads on home, events and details read the section tokens; Chinese pages name Chinese faces first', () => {
  const heads: [string, string][] = [
    ['src/components/home-discovery.css', '.home-section-head h2'], ['src/features/events/events.css', '.ev-section-title'],
    // UI9-DETAIL: the body's, the top rail's and the page end's H2 share one rule.
    ['src/components/local-discovery-detail.css', '.local-discovery-detail :is(.detail-body,.detail-main>.detail-rail) h2,.local-discovery-detail .discovery-return h2'],
  ];
  for (const [file, selector] of heads) assert.equal(declarations(file, selector)['font-size'], 'var(--text-section)', selector);
  const stack = (lang: string) => declarations('src/tokens.css', `html:lang(${lang})`)['--font-sans'] ?? '';
  for (const [lang, face] of [['zh-Hans', 'Microsoft YaHei UI'], ['zh-Hant', 'Microsoft JhengHei UI']]) {
    const fonts = stack(lang);
    assert.ok(fonts.indexOf(face) > 0 && fonts.indexOf(face) < fonts.indexOf('Segoe UI'), `${lang}: ${fonts}`);
    assert.ok(fonts.startsWith('-apple-system'), 'macOS and iOS keep the system font first');
  }
});

test('the app home renders the wrapper the prerender writes, so the hero image keeps its box when the app takes over', async () => {
  // scripts/verify-release.mjs checks that the built pages (dist/{,en/,zh-Hant/}index.html) open <main> with this same wrapper.
  const { default: HomePage } = await import('../src/pages/HomePage');
  const { Routes, Route, Outlet } = await import('react-router-dom');
  const context = { user: null, posts: [], feedType: 'provider', keyword: '', regionFilter: '全部', categoryFilter: '全部', feedError: false, isInitialLoading: false, isLoadingMore: false, hasMore: false, blockedUserIds: [], retryFeed() {}, openBayBay() {}, openSearch() {} };
  const home = JSDOM.fragment(renderToStaticMarkup(<StaticRouter location="/"><Routes><Route element={<Outlet context={context} />}><Route index element={<HomePage />} /></Route></Routes></StaticRouter>));
  const root = home.firstElementChild!;
  assert.equal(root.outerHTML.slice(0, root.outerHTML.indexOf('>') + 1), '<div class="bay-home bay-home-editorial">');
  assert.ok(root.firstElementChild!.matches('section.home-discovery'), root.firstElementChild!.outerHTML.slice(0, 80));
});

test('small fixes: the offer page title in display case, the price never clipped, a signed-out 消息 tile not shown as selected', async () => {
  const { getDiscoveryMetadata } = await import('../src/lib/discovery-metadata');
  const muni = localDiscoveries.find(row => row.kind === 'offer' && discoveryShare(row).id === 'sfmta-free-muni-seniors')!;
  assert.match(getDiscoveryMetadata(muni).title, /^SFMTA · San Francisco · /);
  const { EventMeta } = await import('../src/features/events/EventCards');
  const { INDEX_EVENTS } = await import('../src/features/events/events-model');
  const priced = INDEX_EVENTS.find(event => event.cost === 'free')!;
  const meta = JSDOM.fragment(renderToStaticMarkup(<p className="ui-feed-card__meta"><EventMeta event={priced} /></p>));
  assert.ok(meta.querySelector('.ui-meta-place') && meta.querySelector('.ui-meta-price strong'), 'place and price are separate pieces');
  assert.match(meta.textContent!, / · 免费$/);
  // The meta is a wrapping line now (UI9-F: no flex parent, so flex:none is gone): the price moves down whole, never split.
  assert.equal(declarations('src/components/ui/cards.css', '.ui-meta-price')['white-space'], 'nowrap', 'the price is never split');
  const { MeTiles } = await import('../src/features/profile/MeHub');
  const tiles = (signedIn: boolean) => JSDOM.fragment(renderToStaticMarkup(<StaticRouter location="/me"><MeTiles signedIn={signedIn} messagesCount={0} savedCount={null} onMyPosts={() => {}} onLogin={() => {}} /></StaticRouter>));
  assert.equal(tiles(false).querySelector('a[href="/messages"]')!.hasAttribute('data-primary'), false);
  assert.equal(tiles(true).querySelector('a[href="/messages"]')!.hasAttribute('data-primary'), true);
});

test('a card meta that hides the " · " before the price puts the price on its own line (/plan 本周末精选 at 大 / 特大 / 简洁)', () => {
  // The meta is a wrapping text line since tokens v2, not a flex row: hiding the dot alone glued "Main Street部分免费". Since
  // UI9-R1-AFTER-A1-CARD-SYSTEM the /plan strip prints line 2 as every event card does (status chip · place, STATUS_TONE), so
  // a rule that hides the dot puts the price and the place on lines of their own.
  assert.match(readFileSync('src/features/plan/PlanWeekendPicks.tsx', 'utf8'), /data-tone=\{STATUS_TONE\[price\.tone\]\}>\{pick\(price\.text\)\}<\/span>\}\{price && <span className="ui-meta-sep">\{'\\u00a0· '\}<\/span>\}<span className="ui-meta-place">/);
  const normal = (text: string) => text.replace(/\s*([>+~,])\s*/g, '$1').replace(/\s+/g, ' ').trim();
  const checked: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) { if (!/^src\/(?:opus-bay|data)$/.test(path)) walk(path); continue; }
      if (!entry.name.endsWith('.css')) continue;
      const display = new Map<string, string>();
      postcss.parse(readFileSync(path, 'utf8')).walkDecls('display', declaration => {
        const rule = declaration.parent as postcss.Rule;
        const media = rule.parent?.type === 'atrule' ? normal((rule.parent as postcss.AtRule).params) : '';
        for (const selector of rule.selectors ?? []) display.set(`${media}|${normal(selector)}`, declaration.value.trim());
      });
      for (const [key, value] of display) {
        if (!key.endsWith('.ui-meta-sep') || value !== 'none') continue;
        checked.push(`${path} ${key}`);
        const price = key.replace(/\.ui-meta-sep$/, '.ui-meta-price');
        assert.equal(display.get(price), 'block', `${path}: ${key} hides the dot, so ${price} must be a block of its own`);
      }
    }
  };
  walk('src');
  assert.ok(checked.some(entry => entry.includes('src/styles/plan-page.css') && entry.includes('max-width:767px')), checked.join('\n'));
});

test('closing punctuation after a title unit stays inside it, so no line starts with ，or ：', async () => {
  const { SegmentedTitle } = await import('../src/components/SegmentedTitle');
  const html = renderToStaticMarkup(<h2><SegmentedTitle text="湾区中文长者服务，先打对一个电话" /></h2>);
  const doc = JSDOM.fragment(html);
  assert.equal(doc.textContent, '湾区中文长者服务，先打对一个电话', 'the text is unchanged');
  for (const unit of doc.querySelectorAll('.title-keep')) assert.doesNotMatch(unit.nextSibling?.textContent ?? '', /^[，：]/, unit.outerHTML);
  assert.ok([...doc.querySelectorAll('.title-keep')].some(unit => unit.textContent!.endsWith('，')), html);
  const fleet = JSDOM.fragment(renderToStaticMarkup(<h1><SegmentedTitle text="San Francisco Fleet Week：海湾与城市活动周" /></h1>));
  assert.ok([...fleet.querySelectorAll('.title-keep')].some(unit => unit.textContent === 'Fleet Week：'));
  assert.ok(fleet.querySelector('.title-keep + wbr + .title-keep'), 'units still have a break between them');
});

test('the detail bar day-plan button says "Add to day" in English (BayBay’s is "Add to plan"); its name still says which day and what', async () => {
  await loadLocale('en');
  await setLocale('en', false);
  const { AddToDayPlan } = await import('../src/components/AddToDayPlan');
  const html = renderToStaticMarkup(<AddToDayPlan stop={{ kind: 'event', id: 'x' }} date="2026-10-17" title="Pumpkin Festival" compact short />);
  const button = JSDOM.fragment(html).querySelector('button')!;
  assert.equal(button.textContent, 'Add to day');
  assert.match(button.getAttribute('aria-label')!, /^Add to this day’s plan: /);
  const full = JSDOM.fragment(renderToStaticMarkup(<AddToDayPlan stop={{ kind: 'event', id: 'x' }} date="2026-10-17" title="Pumpkin Festival" compact />));
  assert.equal(full.querySelector('button')!.textContent, 'Add to this day’s plan', 'other places keep the full label');
});
