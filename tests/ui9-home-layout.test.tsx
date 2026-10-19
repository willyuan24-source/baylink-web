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
  assert.match(trust.textContent!, /^✓ 每条附官方链接 · ✓ .*官网核对.* · 我们怎么核对 →$/);
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
  assert.equal(doc.querySelectorAll('.ui-cover-credit').length, credits.querySelector('.ui-cover-credit') ? doc.querySelectorAll('.home-feed .ui-cover-credit, .home-offers .ui-cover-credit').length + 1 : doc.querySelectorAll('.ui-cover-credit').length);
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
