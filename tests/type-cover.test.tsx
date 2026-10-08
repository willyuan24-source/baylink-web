import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// Node does not load browser stylesheets; the primitives' own ui.css is checked as text below.
const cssHook = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith('/components/ui/ui.css')) return { format: 'module', shortCircuit: true, source: 'export {};' };
  return nextLoad(url, context);
} });
const { render, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { TypeCover, EventTypeCover, OfferTypeCover, OpeningTypeCover, EventCover, OfferCover } = await import('../src/components/ui');
cssHook.deregister();
const { setLocale } = await import('../src/i18n/locale');
const { getCover } = await import('../src/lib/cover');
const { GUIDE_IMAGES } = await import('../src/data/guide-media');

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
const today = '2026-10-08';
const fleetWeek = {
  id: 'fleet', title: 'Fleet Week 蓝天使航展：海军舰艇开放与飞行表演', startDate: '2026-10-10', endDate: '2026-10-11', occurrenceDates: undefined,
  city: 'San Francisco', category: 'family' as const, cost: 'free' as const, audience: ['家庭'], iconKey: 'plane',
};
const wrap = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

test('an event TypeCover is real DOM text with the honest label, category, big date, title, city and price', () => {
  const view = wrap(<EventTypeCover event={fleetWeek} today={today} />);
  const root = view.container.querySelector('[data-cover="type"]');
  assert.ok(root, 'the root carries data-cover="type" for the image-area probe (RC-31)');
  assert.equal(root.getAttribute('data-tone'), 'family');
  assert.equal(root.querySelector('[data-provenance]')?.textContent, 'BAYLINK 信息卡');
  assert.equal(root.querySelector('.ui-type-cover__label')?.textContent, '亲子活动');
  assert.equal(root.querySelector('.ui-type-cover__date')?.textContent, '10/10–11周六–周日');
  assert.equal(root.querySelector('.ui-type-cover__title')?.textContent, 'Fleet Week 蓝天使航展');
  assert.equal(root.querySelector('.ui-type-cover__place')?.textContent, 'San Francisco');
  assert.equal(root.querySelector('.ui-sticker')?.textContent, '免费');
  assert.equal(root.querySelector('svg')?.getAttribute('aria-hidden'), 'true', 'the texture icon is decorative');
  assert.equal(root.querySelector('img'), null, 'no picture inside a TypeCover');
});

test('the TypeCover translates: English label, weekday and title; zh-Hant converts the Chinese', async () => {
  await act(async () => { await setLocale('en', false); });
  const english = wrap(<EventTypeCover event={{ ...fleetWeek, title: 'Fleet Week', shortTitle: undefined }} today={today} />);
  assert.equal(english.container.querySelector('[data-provenance]')?.textContent, 'BAYLINK info card');
  assert.equal(english.container.querySelector('.ui-type-cover__label')?.textContent, 'Family');
  assert.equal(english.container.querySelector('.ui-type-cover__date')?.textContent, '10/10–11Sat–Sun');
  assert.equal(english.container.querySelector('.ui-type-cover__title')?.getAttribute('lang'), 'en');
  assert.equal(english.container.querySelector('.ui-sticker')?.textContent, 'Free');
  cleanup();
  await act(async () => { await setLocale('zh-Hant', false); });
  const traditional = wrap(<EventTypeCover event={{ ...fleetWeek, title: '长者太极与健康讲座', audience: ['长者'] }} today={today} />);
  assert.equal(traditional.container.querySelector('.ui-type-cover__label')?.textContent, '長者與社區');
  assert.equal(traditional.container.querySelector('.ui-type-cover__title')?.textContent, '長者太極與健康講座');
});

test('unknown cost shows no price; an unknown date says so instead of printing dateLabel', () => {
  const view = wrap(<EventTypeCover event={{ ...fleetWeek, cost: 'unknown', occurrenceDates: [] }} today={today} />);
  assert.equal(view.container.querySelector('.ui-sticker'), null);
  assert.equal(view.container.querySelector('.ui-type-cover__date'), null);
  const mini = wrap(<EventTypeCover event={fleetWeek} today={today} size="mini" />);
  const thumb = mini.container.querySelectorAll('[data-cover="type"]')[0];
  assert.equal(thumb.getAttribute('data-size'), 'mini');
  assert.equal(thumb.textContent, '10/10–11周六–周日', 'a row thumbnail keeps only palette and date');
});

test('offer and opening TypeCovers: value, normal-case brand, deadline; honest opening chip', () => {
  const offer = wrap(<OfferTypeCover offer={{ brand: 'SAN FRANCISCO PUBLIC LIBRARY', title: '借书证免费参观博物馆', endDate: '2026-10-09', availability: 'dated' }} today={today} />);
  const root = offer.container.querySelector('[data-cover="type"]')!;
  assert.equal(root.getAttribute('data-family'), 'offer');
  assert.equal(root.getAttribute('data-ratio'), '1:1');
  assert.equal(root.getAttribute('data-tone'), 'free');
  assert.equal(root.querySelector('.ui-type-cover__label')?.textContent, '免费福利');
  assert.equal(root.querySelector('.ui-type-cover__value')?.textContent, '免费');
  assert.equal(root.querySelector('.ui-type-cover__brand')?.textContent, 'San Francisco Public Library');
  assert.equal(root.querySelector('.ui-sticker')?.getAttribute('data-tone'), 'danger');
  assert.equal(root.querySelector('.ui-sticker')?.textContent, '明天截止');
  const retail = wrap(<OfferTypeCover offer={{ brand: 'YOGURTLAND', title: '会员生日礼', availability: 'ongoing' }} today={today} />);
  assert.equal(retail.container.querySelector('.ui-type-cover__label')?.textContent, '商家活动');
  assert.equal(retail.container.querySelector('.ui-type-cover__title')?.textContent, '会员生日礼', 'without a value the title is shown');
  const opening = wrap(<OpeningTypeCover opening={{ name: 'Sergeant Ma', city: 'San Francisco', status: 'announced', openingType: 'new-restaurant' }} today={today} />);
  assert.equal(opening.container.querySelector('.ui-sticker')?.textContent, '即将开业');
  assert.equal(opening.container.querySelector('[data-cover="type"]')?.getAttribute('data-tone'), 'food');
});

test('EventCover shows the resolved photo with its provenance and stickers, or falls back to the TypeCover', () => {
  const photo = getCover({ kind: 'event', id: 'fleet', imageKey: 'dvids-blue-angels-sffw-2024' }, { images: GUIDE_IMAGES, today });
  const withPhoto = wrap(<EventCover event={fleetWeek} today={today} cover={photo} priority />);
  const img = withPhoto.container.querySelector('img.ui-cover__img')!;
  assert.equal(img.getAttribute('loading'), 'eager');
  assert.equal(img.getAttribute('fetchpriority'), 'high');
  assert.ok(img.getAttribute('srcset')?.includes('480w'));
  assert.equal(withPhoto.container.querySelector('[data-provenance]')?.textContent, '资料图 · 2024');
  assert.deepEqual([...withPhoto.container.querySelectorAll('.ui-sticker')].map(node => node.textContent), ['10/10–11', '免费']);
  const typed = wrap(<EventCover event={fleetWeek} today={today} cover={getCover({ kind: 'event', id: 'fleet', imageKey: 'weekend' }, { images: GUIDE_IMAGES, today })} />);
  assert.ok(typed.container.querySelector('[data-cover="type"]'), 'an AI illustration is replaced by the TypeCover');
  assert.equal(typed.container.querySelector('img'), null);
  const offer = wrap(<OfferCover offer={{ brand: 'IKEA', title: '免费咖啡', availability: 'ongoing' }} today={today} cover={{ tier: 'type', reason: 'no-image', label: { zh: 'BAYLINK 信息卡', en: 'BAYLINK info card' } }} />);
  assert.equal(offer.container.querySelector('.ui-type-cover__brand')?.textContent, 'IKEA');
});

const css = readFileSync('src/components/ui/ui.css', 'utf8');
const rootTokens = new Map<string, string>();
postcss.parse(css).walkRules(':root', rule => rule.walkDecls(declaration => { rootTokens.set(declaration.prop, declaration.value); }));
const tokens = readFileSync('src/tokens.css', 'utf8');
postcss.parse(tokens).walkRules(':root', rule => rule.walkDecls(declaration => { if (!rootTokens.has(declaration.prop)) rootTokens.set(declaration.prop, declaration.value); }));
const resolve = (name: string, depth = 0): number[] => {
  const value = rootTokens.get(name) ?? '';
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  if (alias && depth < 5) return resolve(alias[1], depth + 1);
  const hex = /^#([\da-f]{6})$/i.exec(value);
  assert.ok(hex, `${name} resolves to an opaque colour (${value})`);
  return [0, 2, 4].map(offset => Number.parseInt(hex[1].slice(offset, offset + 2), 16) / 255);
};
const luminance = (rgb: number[]) => rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (fg: string, bg: string) => { const [a, b] = [luminance(resolve(fg)), luminance(resolve(bg))].sort((x, y) => y - x); return (a + .05) / (b + .05); };

test('every TypeCover and status pair is at least 4.5:1', () => {
  const pairs: [string, string][] = ['family', 'culture', 'outdoors', 'food', 'seniors', 'free'].map(tone => [`--tc-${tone}-fg`, `--tc-${tone}-bg`]);
  pairs.push(['--color-success', '--color-success-tint'], ['--color-warning', '--color-warning-tint'], ['--color-danger', '--color-danger-tint'], ['--color-info', '--color-info-tint'], ['--color-brand-deep', '--color-highlight']);
  for (const [fg, bg] of pairs) assert.ok(contrast(fg, bg) >= 4.5, `${fg} on ${bg}: ${contrast(fg, bg).toFixed(2)}:1`);
});

test('TypeCover text scales with Aa: every size is a text token, an em, or a calc() with --reading-scale', () => {
  postcss.parse(css).walkDecls('font-size', declaration => {
    assert.match(declaration.value, /^(?:var\(--text-(?:caption|fact|body|reading|card|section)\)|calc\(.*var\(--reading-scale\)\)|[\d.]+em)$/, `${(declaration.parent as postcss.Rule).selector}: ${declaration.value}`);
    const rem = [...declaration.value.matchAll(/([\d.]+)rem/g)].map(match => Number(match[1]));
    if (rem.length) assert.ok(Math.min(...rem) >= .8125, `${(declaration.parent as postcss.Rule).selector}: never below 13px`);
  });
  postcss.parse(css).walkDecls('font-weight', declaration => assert.ok(['400', '600', '700'].includes(declaration.value), declaration.value));
  const outsideTokens = css.replace(/:root\s*\{[^}]*\}/, '');
  assert.doesNotMatch(outsideTokens, /#[\da-f]{3,8}\b/i, 'colours outside the token block come from tokens');
});

test('a neighbour palette changes only the colour: the label stays the item’s own category', () => {
  const view = wrap(<><EventTypeCover event={fleetWeek} today={today} /><EventTypeCover event={fleetWeek} today={today} tone="food" /></>);
  const [first, second] = view.container.querySelectorAll('[data-cover="type"]');
  assert.deepEqual([first.getAttribute('data-tone'), second.getAttribute('data-tone')], ['family', 'food']);
  assert.equal(second.querySelector('.ui-type-cover__label')?.textContent, '亲子活动');
  const bare = wrap(<TypeCover tone="culture" label="文化活动" title="社区讲座" ratio="16:9" />);
  assert.equal(bare.container.querySelector('[data-cover="type"]')?.getAttribute('data-ratio'), '16:9');
  assert.equal(bare.container.querySelector('.ui-type-cover__footer'), null, 'no empty footer');
});
