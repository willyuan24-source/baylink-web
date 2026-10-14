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
  // H12: the tone's drawing is a decorative mask (public/covers/art), not a UI icon, and the item picks one by its id.
  const art = root.querySelector('.ui-type-cover__art');
  assert.equal(art?.getAttribute('aria-hidden'), 'true', 'the drawing is decorative');
  assert.match(art?.getAttribute('data-art') ?? '', /^family-[12]$/, 'a family event draws from the family set');
  assert.equal(root.querySelector('svg'), null, 'no UI icon inside a TypeCover');
  assert.equal(root.querySelector('img'), null, 'no picture inside a TypeCover');
});

test('the TypeCover translates: English label, weekday and title; zh-Hant converts the Chinese', async () => {
  await act(async () => { await setLocale('en', false); });
  const english = wrap(<EventTypeCover event={{ ...fleetWeek, title: 'Fleet Week', shortTitle: undefined }} today={today} />);
  assert.equal(english.container.querySelector('[data-provenance]')?.textContent, 'Info card');
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

test('offer and opening TypeCovers: value, normal-case brand, deadline; honest opening chip', async () => {
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
  // The card's caption carries the title, so the cover does not repeat it, value or not (PROD-W3: "Concord Taco Tra…").
  assert.equal(retail.container.querySelector('.ui-type-cover__title'), null, 'without a value the cover shows the brand, not the title');
  assert.equal(retail.container.querySelector('.ui-type-cover__brand')?.textContent, 'Yogurtland');
  const withOrder = { brand: 'SMASHBURGER', title: '周三买完整成人套餐，12 岁及以下儿童餐免费', availability: 'ongoing', kind: 'purchase' } as const;
  const zhOrder = wrap(<OfferTypeCover offer={withOrder} today={today} />);
  assert.equal(zhOrder.container.querySelector('.ui-type-cover__value')?.textContent, '随单免费');
  assert.equal(zhOrder.container.querySelector('.ui-type-cover__value-small'), null);
  await act(async () => { await setLocale('en', false); });
  const enOrder = wrap(<OfferTypeCover offer={withOrder} today={today} />);
  assert.equal(enOrder.container.querySelector('.ui-type-cover__value')?.textContent, 'Freewith purchase');
  assert.equal(enOrder.container.querySelector('.ui-type-cover__value-small')?.textContent, 'with purchase', 'the condition stays on the cover, set small');
  await act(async () => { await setLocale('zh-Hans', false); });
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
  const offer = wrap(<OfferCover offer={{ brand: 'IKEA', title: '免费咖啡', availability: 'ongoing' }} today={today} cover={{ tier: 'type', reason: 'no-image', label: { zh: 'BAYLINK 信息卡', en: 'Info card' } }} />);
  assert.equal(offer.container.querySelector('.ui-type-cover__brand')?.textContent, 'IKEA');
});

const css = readFileSync('src/components/ui/ui.css', 'utf8');
const rootTokens = new Map<string, string>();
postcss.parse(css).walkRules(':root', rule => rule.walkDecls(declaration => { rootTokens.set(declaration.prop, declaration.value); }));
const tokens = readFileSync('src/tokens.css', 'utf8');
postcss.parse(tokens).walkRules(':root', rule => rule.walkDecls(declaration => { if (!rootTokens.has(declaration.prop)) rootTokens.set(declaration.prop, declaration.value); }));
const resolve = (name: string, depth = 0): number[] => {
  const value = rootTokens.get(name) ?? '';
  // The palette's channel form (TOKENS-B): --tc-x:var(--color-y), --color-y:rgb(var(--color-y-rgb)), --color-y-rgb:R G B.
  const alias = /^(?:var\(|rgb\(var\()(--[\w-]+)\)\)?$/.exec(value);
  if (alias && depth < 5) return resolve(alias[1], depth + 1);
  const channels = /^(\d{1,3}) (\d{1,3}) (\d{1,3})$/.exec(value);
  assert.ok(channels, `${name} resolves to an opaque colour (${value})`);
  return channels.slice(1).map(channel => Number(channel) / 255);
};
const luminance = (rgb: number[]) => rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (fg: string, bg: string) => { const [a, b] = [luminance(resolve(fg)), luminance(resolve(bg))].sort((x, y) => y - x); return (a + .05) / (b + .05); };

test('every TypeCover and status pair is at least 4.5:1', () => {
  const pairs: [string, string][] = ['family', 'culture', 'outdoors', 'food', 'seniors', 'free'].map(tone => [`--tc-${tone}-fg`, `--tc-${tone}-bg`]);
  pairs.push(['--color-success', '--color-success-tint'], ['--color-warning', '--color-warning-tint'], ['--color-danger', '--color-danger-tint'], ['--color-info', '--color-info-tint'], ['--color-brand-deep', '--color-highlight']);
  for (const [fg, bg] of pairs) assert.ok(contrast(fg, bg) >= 4.5, `${fg} on ${bg}: ${contrast(fg, bg).toFixed(2)}:1`);
});

test('TypeCover text scales with Aa once: every size is a text token, a rem, a clamp() between rem bounds, or a share of its parent never below the caption size', () => {
  postcss.parse(css).walkDecls('font-size', declaration => {
    const where = `${(declaration.parent as postcss.Rule).selector}: ${declaration.value}`;
    // Root Aa (html[data-reading], WEB-TOKENS-A) scales every rem: a second --reading-scale would double-scale, px never grows.
    assert.doesNotMatch(declaration.value, /--reading-scale|\d(?:\.\d+)?px\b/, where);
    // A bare .47em under a 22px value floor was 10.3px; the small date/value part now keeps the caption size as its floor.
    assert.match(declaration.value, /^(?:var\(--text-(?:caption|fact|body|reading|card|section|title|h1|display)\)|[\d.]+rem|max\(var\(--text-caption\), \d+%\)|clamp\(.*\))$/, where);
    if (declaration.value.startsWith('clamp(')) {
      const clamp = /^clamp\((?:([\d.]+)rem|max\([\d.]+rem, var\(--text-floor\)\)), (.*), [\d.]+rem\)$/.exec(declaration.value);
      assert.ok(clamp, `${where}: clamp(rem floor, …, rem cap)`);
      assert.ok(!clamp[1] || Number(clamp[1]) >= 1, `${where}: a floor under 1rem keeps the 简洁显示 text floor, max(floor, var(--text-floor))`);
      assert.doesNotMatch(clamp[2].replace(/calc\([\d.]+(?:cqw|cqi|vw) \* var\(--fluid-scale\)\)/g, ''), /\d(?:cqw|cqi|vw)\b/, `${where}: a width term grows with Aa through --fluid-scale`);
    }
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

test('the palette lives in tokens.css: ui.css defines no global names, and every name it reads exists', () => {
  // TOKENS-B moved the WEB-UI token block (TypeCover pairs, status colours, badge, highlight, scrims) into tokens.css.
  // ui.css loads lazily after tokens.css at the same specificity, so a :root name here would override the site-wide value
  // once a primitive mounts; it may only set element-scoped layout variables.
  postcss.parse(css).walkRules(':root', rule => assert.fail(`ui.css has a :root block again (${rule.toString().slice(0, 60)}…): palette names belong in src/tokens.css`));
  postcss.parse(css).walkDecls(declaration => {
    if (declaration.prop.startsWith('--')) assert.match(declaration.prop, /^--(?:ui-cover-ratio|ui-feed-cols|ui-feed-ratio|ui-art|tc-bg|tc-fg|tc-art|tc-art-shift|tc-art-width|tc-badge-room)$/, `${declaration.prop} (${(declaration.parent as postcss.Rule).selector})`);
  });
  const globalNames = new Set<string>();
  postcss.parse(tokens).walkRules(':root', rule => rule.walkDecls(declaration => { globalNames.add(declaration.prop); }));
  for (const name of ['--tc-family-bg', '--tc-free-fg', '--color-success', '--color-highlight', '--color-badge-bg', '--color-backdrop', '--scrim-photo']) assert.ok(globalNames.has(name), `tokens.css defines ${name}`);
  const local = new Set(['--ui-cover-ratio', '--ui-feed-cols', '--ui-feed-ratio', '--ui-lqip', '--ui-art', '--tc-bg', '--tc-fg', '--tc-art', '--tc-art-shift', '--tc-art-width', '--tc-badge-room']);
  // A read with a fallback (var(--header-height, 0px)) is fine without a definition.
  for (const [, name, fallback] of css.matchAll(/var\((--[\w-]+)\s*(,)?/g)) assert.ok(fallback || local.has(name) || globalNames.has(name), `ui.css reads ${name}, which tokens.css does not define`);
  for (const [, name] of css.matchAll(/var\((--ui-(?:success|warning|danger|info|highlight|badge|scrim)[\w-]*)/g)) assert.fail(`ui.css reads the old stand-in ${name}; read the --color-* name`);
});

const declarations = (selector: string) => {
  const found = new Map<string, string>();
  postcss.parse(css).walkRules(rule => { if (rule.selector === selector) rule.walkDecls(declaration => { found.set(declaration.prop, declaration.value); }); });
  return found;
};
const px = (value: string | undefined) => Number(/^(-?[\d.]+)px/.exec(value ?? '')?.[1] ?? Number.NaN);

test('hit areas: each day-toggle radio covers the full 44px track, and nothing clips its extension', () => {
  const track = declarations('.ui-segmented'), item = declarations('.ui-segmented__item'), extension = declarations('.ui-segmented__item::before');
  assert.equal(track.get('min-height'), 'var(--control-height)');
  const padding = px(track.get('padding'));
  assert.equal(item.get('min-height'), `calc(var(--control-height) - ${padding * 2}px)`, 'the thumb sits inside the track padding');
  assert.equal(item.get('position'), 'relative');
  assert.equal(item.get('overflow'), undefined, 'overflow on the radio would clip its ::before hit area');
  const border = px(item.get('border'));
  const [vertical, horizontal = vertical] = (extension.get('inset') ?? '').split(/\s+/).map(value => -px(value));
  const control = 44;
  // Border-box item (control − 2 × padding) → padding box (− 2 × border) → hit area (+ 2 × vertical extension).
  assert.ok(control - padding * 2 - border * 2 + vertical * 2 >= control, `radio hit height ${control - padding * 2 - border * 2 + vertical * 2}px`);
  const gap = px(track.get('gap'));
  assert.ok(horizontal >= border && horizontal - border <= gap / 2, `the side extension (${horizontal - border}px past the border) stays inside half of the ${gap}px gap`);
  assert.match(declarations('.ui-segmented__label').get('overflow') ?? '', /hidden/, 'the ellipsis lives on the label instead');
});

test('a photo hero card is one link from edge to edge: its text box never becomes the link’s containing block', () => {
  const text = declarations('.ui-hero-card[data-overlay] .ui-hero-card__text');
  for (const prop of ['position', 'transform', 'filter', 'contain', 'will-change', 'container-type']) assert.equal(text.get(prop), undefined, prop);
  assert.equal(declarations('.ui-hero-card__media').get('position'), 'relative', 'the media box holds the stretched link');
  assert.equal(declarations('.ui-hero-card[data-overlay] .ui-hero-card__media').get('display'), 'grid');
});

test('every drawing a TypeCover can pick has its mask rule and its own small vector file (H12)', async () => {
  const { readdirSync } = await import('node:fs');
  const rules = new Set<string>();
  for (const [, name, file] of css.matchAll(/\.ui-type-cover__art\[data-art=([\w-]+)\] \{ --ui-art:url\(\/covers\/art\/([\w-]+)\.svg\); \}/g)) { assert.equal(file, name); rules.add(name); }
  const files = readdirSync('public/covers/art').filter(file => file.endsWith('.svg')).map(file => file.replace(/\.svg$/, ''));
  assert.deepEqual([...rules].sort(), files.sort(), 'one rule per drawing file');
  for (const file of files) {
    const svg = readFileSync(`public/covers/art/${file}.svg`, 'utf8');
    assert.ok(svg.length < 2048, `${file}: a small drawing`);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 90 120">/, `${file}: the 3:4 drawing box`);
    assert.doesNotMatch(svg, /<(?:image|text|script|use|foreignObject)\b|href=|url\(/i, `${file}: shapes only, nothing embedded or linked`);
  }
  const seen = new Set<string>();
  const tones = ['family', 'culture', 'outdoors', 'food', 'seniors', 'free'] as const;
  for (const tone of tones) for (const icon of [undefined, tone, 'store', 'book', 'landmark', 'bike', 'music', 'film', 'dog', 'plane']) for (const family of ['event', 'guide'] as const) for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const view = wrap(<TypeCover tone={tone} family={family} label="标签" icon={icon} seed={seed} />);
    const art = view.container.querySelector('.ui-type-cover__art')!.getAttribute('data-art')!;
    assert.ok(rules.has(art), `${tone}/${icon}/${family}: ${art} has a rule`);
    seen.add(art); cleanup();
  }
  assert.deepEqual([...seen].sort(), files.sort(), 'every drawing is in use');
  // The drawing belongs to the item: the same id draws the same picture in every language and on every page.
  const first = wrap(<EventTypeCover event={fleetWeek} today={today} />).container.querySelector('.ui-type-cover__art')!.getAttribute('data-art');
  cleanup(); await act(async () => { await setLocale('en', false); });
  assert.equal(wrap(<EventTypeCover event={{ ...fleetWeek, title: 'Fleet Week' }} today={today} />).container.querySelector('.ui-type-cover__art')!.getAttribute('data-art'), first);
});

test('a list names the info card once: its cards that credit their source drop the drawn badge, never the DOM text (H12)', async () => {
  const { FeedGrid, FeedItem, FeedCard } = await import('../src/components/ui');
  const view = wrap(<FeedGrid label="本周末活动">
    <FeedItem><FeedCard title="社区讲座" to="/events/a" cover={<EventTypeCover event={fleetWeek} today={today} />} trust="官网核对 10/7" /></FeedItem>
    <FeedItem><FeedCard title="无来源行" to="/events/b" cover={<EventTypeCover event={{ ...fleetWeek, id: 'b' }} today={today} />} /></FeedItem>
  </FeedGrid>);
  const feed = view.container.querySelector('.ui-feed')!;
  assert.equal(feed.getAttribute('data-cover-credit'), '');
  assert.equal(feed.querySelector(':scope > .ui-cover-credit')?.textContent, '没有照片的条目用 BAYLINK 信息卡，插画仅作装饰。');
  const [credited, plain] = feed.querySelectorAll('.ui-feed-card');
  assert.equal(credited.getAttribute('data-credited'), '');
  assert.equal(plain.hasAttribute('data-credited'), false, 'a card without a source line keeps its badge');
  for (const card of [credited, plain]) assert.equal(card.querySelector('[data-provenance]')?.textContent, 'BAYLINK 信息卡', 'screen readers and probes still read the label');
  // Only the credited card in a credited list hides the badge (visually) and gives its room to the label; the caption hides
  // itself in a list without such a card.
  assert.match(css, /\[data-cover-credit\] \.ui-feed-card\[data-credited\] \.ui-type-cover \.ui-provenance \{ width:1px; height:1px;[^}]*clip:rect\(0 0 0 0\)/);
  assert.match(css, /\[data-cover-credit\] \.ui-feed-card\[data-credited\] \.ui-type-cover:not\(\[data-size=mini\]\) \{ --tc-badge-room:0px; \}/);
  assert.match(css, /\.ui-feed:not\(:has\(\.ui-feed-card\[data-credited\] \[data-cover=type\]\)\)>\.ui-cover-credit \{ display:none; \}/);
  cleanup(); await act(async () => { await setLocale('en', false); });
  const english = wrap(<FeedGrid label="Events"><FeedItem><FeedCard title="Talk" to="/events/a" cover={<EventTypeCover event={fleetWeek} today={today} />} trust="Source checked 10/7" /></FeedItem></FeedGrid>);
  assert.equal(english.container.querySelector('.ui-cover-credit')?.textContent, 'No photo: a BAYLINK info card; drawings are decorative.');
});
