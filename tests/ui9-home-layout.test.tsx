import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HOME_WEEKENDS, ELDER_CALLS, guides as HOME_GUIDES } from '../src/lib/home-catalog';
import { HOME_INTENTS } from '../src/data/home-pathways';
import { GUIDE_EDITORIAL } from '../src/data/guide-editorial';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { StaticRouter } = await import('react-router-dom');
const { HomeDiscovery } = await import('../src/components/HomeDiscovery');
const { HomeImageCredits } = await import('../src/features/home/HomeImageCredits');
const { ElderCalls } = await import('../src/features/home/ElderCalls');
const { HeroPicks } = await import('../src/features/home/HeroPicks');

/** UI9-HOME: the home's content arrangement, its 简洁 tags, 长辈常用电话, the trust line and the credits line. */
const snapshots = HOME_WEEKENDS as Record<string, { ids: string[]; feed: string[] }>;
const today = Object.keys(snapshots).sort().find(day => snapshots[day].ids.length === 3 && snapshots[day].feed.length >= 4)!;
const home = (day = today) => new JSDOM(renderToStaticMarkup(<StaticRouter location="/"><HomeDiscovery today={day} onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></StaticRouter>)).window.document;
const CSS = fs.readFileSync('src/components/home-discovery.css', 'utf8').replace(/\r\n/g, '\n');

test('the sections come in the arranged order: the week (去哪), the band, then help (怎么办), the credits line last', () => {
  const doc = home();
  const root = doc.querySelector('section.home-discovery')!;
  assert.deepEqual([...root.children].map(node => node.className.split(' ')[0]), ['home-top', 'home-feed', 'home-offers', 'home-baybay', 'home-guides', 'home-end', 'home-credits']);
  const top = root.querySelector('.home-top')!;
  assert.deepEqual([...top.children].map(node => node.className.split(' ')[0]), ['home-head', 'home-picks', 'home-moods', 'home-share']);
  const head = top.querySelector('.home-head')!;
  assert.deepEqual([...head.children].map(node => node.tagName.toLowerCase() + (node.className ? `.${node.className.split(' ').at(-1)}` : '')),
    ['p.home-head__dateline', 'h1.home-head__title', 'p.home-head__identity', 'form.home-ask', 'button.home-ask-baybay']);
  const picks = top.querySelector('.home-picks')!;
  assert.deepEqual([...picks.children].map(node => node.className.split(' ').at(-1)), ['home-section-head', 'home-picks__list', 'home-picks__all', 'home-trust']);
  assert.deepEqual([...root.querySelector('.home-end')!.children].map(node => node.className.split(' ')[0]), ['home-elder', 'home-3d']);
});

test('简洁 is CSS only: the browse sections are tagged hide, the 3D strip and tile never are', () => {
  const doc = home();
  for (const selector of ['.home-moods', '.home-share', '.home-offers', '.home-baybay', '.home-guides']) {
    assert.equal(doc.querySelector(selector)!.getAttribute('data-simple'), 'hide', selector);
  }
  for (const postcard of doc.querySelectorAll('.home-3d, .home-3d-strip')) {
    for (let node: Element | null = postcard; node; node = node.parentElement) assert.notEqual(node.getAttribute('data-simple'), 'hide', `${postcard.className} sits in a hidden block`);
  }
  // The grandparent path keeps "免费": the identity line shows in 简洁 too; 问 BayBay · AI 助手 does not.
  assert.equal(doc.querySelector('.home-head__identity')!.hasAttribute('data-simple'), false);
  assert.equal(doc.querySelector('.home-ask-baybay')!.getAttribute('data-simple'), 'hide');
  // The feed's cards, heading and button are hidden by a home rule that skips the strip's wide item.
  const rule = CSS.split('\n').find(line => line.includes('html[data-simple] .home-feed'))!;
  assert.match(rule, /\.ui-feed-grid>li:not\(\.ui-feed-grid__wide\)/);
  assert.match(CSS, /html\[data-simple\] \.home-discovery \[data-simple=only\] \{ display:block; \}/);
  // The 3D strip is the first of the two from=home links and sits after the fourth feed card (OPUS contract).
  const links = [...doc.querySelectorAll('a[href="/opus-bay?from=home"]')];
  assert.deepEqual(links.map(link => link.className), ['home-3d-strip', 'home-3d']);
});

test('长辈常用电话: each row links its guide and dials the number the guide\'s own cover phone holds (never typed by hand)', () => {
  const elders = HOME_INTENTS.find(intent => intent.id === 'elders')!.slugs;
  const expected = elders.flatMap(slug => GUIDE_EDITORIAL[slug]?.cover.phone ? [{ slug, tel: GUIDE_EDITORIAL[slug].cover.phone!.tel, number: GUIDE_EDITORIAL[slug].cover.phone!.number }] : []);
  assert.ok(expected.length >= 3, 'the elder guides carry their phones');
  assert.deepEqual(ELDER_CALLS.map(({ slug, tel, number }) => ({ slug, tel, number })), expected, 'the generated projection is the guides\' own phones');
  for (const call of ELDER_CALLS) assert.ok(HOME_GUIDES.some(guide => guide.slug === call.slug), `${call.slug} is a home guide`);
  const doc = home();
  const rows = [...doc.querySelectorAll('.home-elder .ui-row-card')];
  assert.equal(rows.length, ELDER_CALLS.length);
  rows.forEach((row, index) => {
    const call = ELDER_CALLS[index];
    assert.equal(row.querySelector('a[href^="/guides/"]')!.getAttribute('href'), `/guides/${call.slug}`);
    const dial = row.querySelector('a[href^="tel:"]')!;
    assert.equal(dial.getAttribute('href'), `tel:${call.tel}`);
    assert.equal(dial.textContent, `拨打 ${call.number}`);
    assert.equal(dial.getAttribute('aria-label'), `拨打 ${call.label.zh} ${call.number}`);
  });
});

test('the trust line says 官网核对, never 人工核对, and links the one method anchor; the identity line is the shared wording', async () => {
  const doc = home();
  const trust = doc.querySelector('.home-trust')!;
  assert.match(trust.textContent!, /^✓ 每条附官方链接 · ✓ (?:多数 )?\d+\/\d+ 官网核对\u00a0· 我们怎么核对 →$/);
  assert.deepEqual([...doc.querySelectorAll('a[href*="#"]')].map(link => link.getAttribute('href')), ['/about#about-method-title']);
  assert.doesNotMatch(doc.body.innerHTML, /人工核对|编辑核对|how-we-check/);
  const { SITE_IDENTITY, OFFICIAL_LINKS, FREE_NO_SIGN_IN, METHOD_HREF } = await import('../src/lib/check-dates');
  assert.equal(METHOD_HREF, '/about#about-method-title');
  assert.equal(doc.querySelector('.home-head__identity')!.textContent, `${SITE_IDENTITY.zh} · ${FREE_NO_SIGN_IN.zh}`);
  assert.ok(trust.textContent!.startsWith(`✓ ${OFFICIAL_LINKS.zh}`));
});

test('the credits line is #page-credits with its photo count, last in the home, and names the info card once', () => {
  const doc = home();
  const credits = doc.querySelector('#page-credits')!;
  assert.equal(credits, doc.querySelector('.home-discovery')!.lastElementChild);
  assert.ok(credits.hasAttribute('data-credits-at-end'));
  const items = credits.querySelectorAll('details li').length;
  assert.equal(Number(credits.getAttribute('data-count')), items);
  assert.match(credits.querySelector('summary')?.textContent ?? '', new RegExp(`本页图片来源（${items}）`));
  assert.match(CSS, /\.home-discovery :is\(\.ui-feed,\.home-offers\)>\.ui-cover-credit \{ display:none; \}/, 'the lists\' own notes are hidden on the home');
  // Every credited image is shown on the page.
  const shown = new Set([...doc.querySelectorAll('.home-discovery img.ui-cover__img')].map(img => img.getAttribute('src')));
  assert.ok(items <= shown.size);
});

test('the home stylesheet: font sizes, radii and shadows from tokens only; the 3D postcard rules unchanged', () => {
  const root = postcss.parse(CSS);
  root.walkDecls(decl => {
    if (decl.prop === 'font-size') assert.match(decl.value, /^var\(--[a-z0-9-]+\)$/, `${(decl.parent as postcss.Rule).selector}: font-size ${decl.value}`);
    if (decl.prop === 'box-shadow') assert.fail(`${(decl.parent as postcss.Rule).selector}: an ad-hoc shadow`);
    if (decl.prop === 'border-radius') assert.match(decl.value, /^(?:var\(--r(?:-[a-z0-9]+)+\)|0)$/, `${(decl.parent as postcss.Rule).selector}: radius ${decl.value}`);
  });
  // The postcards' own rules, byte for byte as the base had them (captain decision 1).
  const postcard = CSS.split('\n').filter(line => /home-3d/.test(line)).join('\n');
  assert.equal(createHash('sha256').update(postcard).digest('hex').slice(0, 16), POSTCARD_RULES_SHA, postcard);
});

const POSTCARD_RULES_SHA = '71c2b5cfeeb61ad0';

test('the coded-cover note is printed once, in the credits line, exactly when the page shows a coded cover', () => {
  const typeCover = { tier: 'type', reason: 'no-image', label: { zh: '信息卡', en: 'Info card' } } as const;
  const photo = { tier: 'photo', key: 'test-photo', image: { src: '/images/test.webp', credit: 'A. Photographer' }, label: { zh: '实拍', en: 'Photo' }, fit: 'cover', focal: [0.5, 0.5] } as unknown as Parameters<typeof HomeImageCredits>[0]['covers'][number];
  const credits = (covers: Parameters<typeof HomeImageCredits>[0]['covers']) => new JSDOM(renderToStaticMarkup(<HomeImageCredits covers={covers} />)).window.document;
  // A coded cover on the page: the line names it once, beside the photo credits.
  const mixed = credits([photo, typeCover, typeCover]);
  assert.equal(mixed.querySelectorAll('.ui-cover-credit').length, 1);
  assert.equal(mixed.querySelector('#page-credits')!.getAttribute('data-count'), '1');
  // Photos only: no note at all.
  const photos = credits([photo]);
  assert.equal(photos.querySelectorAll('.ui-cover-credit').length, 0);
  assert.equal(photos.querySelector('#page-credits')!.getAttribute('data-count'), '1');
  // On the home the lists' own notes are hidden (home-discovery.css), so the reader sees the credits line's one.
  const doc = home();
  assert.equal(doc.querySelectorAll('#page-credits .ui-cover-credit').length, 1, 'the home shows coded covers today');
});

test('长辈常用电话 with no numbers: nothing in standard, 长辈与家属指南 → in 简洁 only', () => {
  const doc = new JSDOM(renderToStaticMarkup(<StaticRouter location="/"><ElderCalls calls={[]} /></StaticRouter>)).window.document;
  assert.equal(doc.querySelector('.home-elder .ui-row-card'), null);
  const fallback = doc.querySelector('.home-elder')!;
  assert.equal(fallback.getAttribute('data-simple'), 'only');
  assert.equal(fallback.querySelector('a')!.getAttribute('href'), '/guides?topic=elders');
});

test('the date guard covers the picks block by block: from 1024 the section is display:contents and draws no skeleton', () => {
  // A skeleton on a display:contents box is positioned against the page, not the section (it covered the masthead).
  assert.match(CSS, /@media \(min-width:1024px\) \{[^@]*\.home-picks,\.home-picks__list \{ display:contents; \}/);
  assert.ok(CSS.includes('html[data-date-stale] .home-discovery>.home-top>.home-picks::before { content:none; }'));
  const doc = home();
  assert.equal(doc.querySelector('.home-picks')!.hasAttribute('data-date-scope'), false);
  for (const block of doc.querySelectorAll('.home-picks>.home-section-head, .home-picks__list>li, .home-picks__all, .home-trust')) {
    assert.equal(block.getAttribute('data-date-scope'), 'weekend', block.className || block.tagName);
  }
});

test('an unknown weekend with no picks: a text panel holds the lead\'s place (no blank columns beside the masthead)', () => {
  const doc = new JSDOM(renderToStaticMarkup(<StaticRouter location="/"><HeroPicks picks={[]} covers={[]} today="2099-01-05" start="2099-01-10" end="2099-01-11" total={null} checked={null} /></StaticRouter>)).window.document;
  const empty = doc.querySelector('.home-picks .home-empty')!;
  assert.doesNotMatch(empty.textContent!, /\d+ 场|暂没有已确认/);
  assert.deepEqual([...empty.querySelectorAll('a')].map(link => link.getAttribute('href')), ['/calendar', '/explore']);
  assert.equal(doc.querySelector('.home-picks__all')!.textContent, '看本周末全部活动');
});

test('phone: the lead asks for the 800w rung (the site\'s 266px phone cap), the share card is one row of its buttons', () => {
  const doc = home();
  const lead = doc.querySelector('.home-picks__list>li:first-child img');
  if (lead) assert.match(lead.getAttribute('sizes') ?? '', /^\(max-width: 767px\) 266px, /);
  assert.ok(CSS.includes('@media (max-width:767px) {\n  :is(.home-picks>.home-section-head,.home-share>:is(h2,p)) { position:absolute;'), 'below 768 the share card\'s heading and sentence are for screen readers only');
});

test('free days and deals and the guide intents load after the page in production, and the prerender still carries both', () => {
  // Captain 10-19 15:15 (home route JS ≤ the 200dfb4 base): a production build imports the two below-the-fold sections
  // through import(), with no Suspense boundary of their own (the boot snapshot stays until they are in); Node renders them
  // as they are, so the prerendered home and the tests see the whole page.
  const source = fs.readFileSync('src/components/HomeDiscovery.tsx', 'utf8');
  for (const name of ['GuideRail', 'OfferTickets']) {
    assert.ok(source.includes(`const ${name} = import.meta.env?.PROD ? /* @__PURE__ */ afterPage(chunkLoader(() => import('../features/home/${name}View'), module => module.${name}View)) : ${name}Now;`), `${name} loads after the page`);
    // The view imports nothing from the home's own modules: the home's chunk then exports nothing to it and keeps its
    // manifest entry, src/pages/HomePage.tsx (verify-release).
    const view = fs.readFileSync(`src/features/home/${name}View.tsx`, 'utf8');
    const imports = [...view.matchAll(/^import (?!type )[^;]* from '([^']+)';$/gm)].map(match => match[1]);
    for (const own of ['home-pathways', 'home-model', 'home-offers', 'home-catalog', 'home-weekend']) assert.ok(!imports.some(path => path.endsWith(own)), `${name}View must not import ${own}`);
  }
  assert.doesNotMatch(source, /<Suspense\b/, 'no boundary of their own: the page commits once');
  const doc = home();
  assert.ok(doc.querySelector('section.home-offers .home-offers__rail li'), 'the prerender carries 免费与优惠');
  assert.ok(doc.querySelector('section.home-guides .home-guides__rail li'), 'the prerender carries the guide intents');
});
