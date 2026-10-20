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
  if (/\/components\/ui\/(?:ui|covers|cards)\.css$/.test(url)) return { format: 'module', shortCircuit: true, source: 'export {};' };
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

test('an event type cover is the date family: real DOM text, the honest label, the day and weekday, the venue; never the title', () => {
  const view = wrap(<EventTypeCover event={fleetWeek} today={today} />);
  const root = view.container.querySelector('[data-cover="type"]');
  assert.ok(root, 'the root carries data-cover="type" for the image-area probe (RC-31)');
  assert.deepEqual(['data-family', 'data-kind', 'data-mark', 'data-tone'].map(name => root.getAttribute(name)), ['date', 'event', 'calendar', 'family']);
  assert.equal(root.getAttribute('data-key'), '10/10–11');
  assert.equal(root.querySelector('[data-provenance]')?.textContent, 'BAYLINK 信息卡');
  assert.equal(root.querySelector('.tc-cal__top')?.textContent, '周六–周日');
  assert.equal(root.querySelector('.tc-cal__day')?.textContent, '10/10–11');
  assert.equal(root.querySelector('.tc-eyebrow')?.textContent, 'San Francisco');
  assert.doesNotMatch(root.textContent ?? '', /Fleet Week|蓝天使/, 'the caption prints the title; the cover never repeats it (N19)');
  assert.equal(root.querySelector('.ui-sticker'), null, 'no stickers on a cover (N22)');
  assert.equal(root.querySelector('.tc-bar'), null, 'a two-day run draws no time bar');
  assert.equal(root.hasAttribute('data-art'), false, 'no drawings (G3)');
  assert.equal(root.querySelector('img'), null, 'no picture inside a type cover');
});

test('the type cover translates: English weekday, day and venue; zh-Hant converts the Chinese', async () => {
  await act(async () => { await setLocale('en', false); });
  const english = wrap(<EventTypeCover event={{ ...fleetWeek, title: 'Fleet Week', shortTitle: undefined }} today={today} />);
  assert.equal(english.container.querySelector('[data-provenance]')?.textContent, 'Info card');
  assert.equal(english.container.querySelector('.tc-cal__top')?.textContent, 'Sat–Sun');
  assert.equal(english.container.querySelector('.tc-cal__day')?.textContent, 'Oct 10–11');
  assert.equal(english.container.querySelector('.tc-eyebrow')?.getAttribute('lang'), 'en');
  cleanup();
  await act(async () => { await setLocale('zh-Hant', false); });
  const traditional = wrap(<EventTypeCover event={{ ...fleetWeek, city: '长者中心', audience: ['长者'] }} today={today} />);
  assert.equal(traditional.container.querySelector('.tc-cal__top')?.textContent, '週六–週日');
  assert.equal(traditional.container.querySelector('.tc-eyebrow')?.textContent, '長者中心');
});

test('an unknown date says so instead of printing dateLabel; a thumbnail shows the time, else the place, else the price', () => {
  const view = wrap(<EventTypeCover event={{ ...fleetWeek, cost: 'unknown', occurrenceDates: [] }} today={today} />);
  assert.equal(view.container.querySelector('.tc-cal__day')?.textContent, '日期见详情');
  assert.equal(view.container.querySelector('.ui-sticker'), null);
  cleanup();
  const mini = wrap(<EventTypeCover event={fleetWeek} today={today} size="mini" />);
  const thumb = mini.container.querySelector('[data-cover="type"]')!;
  assert.equal(thumb.getAttribute('data-size'), 'mini');
  assert.equal(thumb.textContent, 'San Francisco', 'no time: the place; never the date the row already prints, and not a row of 免费');
  cleanup();
  const timed = wrap(<EventTypeCover event={{ ...fleetWeek, endDate: '2026-10-10', sessions: [{ date: '2026-10-10', start: '11:00', end: '16:00' }] }} today={today} size="mini" />);
  assert.equal(timed.container.querySelector('[data-cover="type"]')!.textContent, '11:00–16:00');
});

test('offer and opening type covers: the ticket (value, condition, brand as written, deadline stub) and the shop sign', async () => {
  const offer = wrap(<OfferTypeCover offer={{ brand: 'SAN FRANCISCO PUBLIC LIBRARY', title: '借书证免费参观博物馆', endDate: '2026-10-09', availability: 'dated' }} today={today} />);
  const root = offer.container.querySelector('[data-cover="type"]')!;
  assert.deepEqual(['data-family', 'data-kind', 'data-ratio', 'data-tone'].map(name => root.getAttribute(name)), ['ticket', 'offer', '1:1', 'free']);
  assert.equal(root.querySelector('.tc-ticket__value')?.textContent, '免费');
  assert.equal(root.querySelector('.tc-eyebrow')?.textContent, 'San Francisco Public Library');
  assert.equal(root.querySelector('.tc-ticket__stub')?.textContent, '10/9截止');
  assert.equal(root.querySelector('.ui-sticker'), null);
  cleanup();
  const retail = wrap(<OfferTypeCover offer={{ brand: 'YOGURTLAND', title: '会员生日礼', availability: 'ongoing' }} today={today} />);
  // No value: the deadline leads; the caption carries the title, so the cover never repeats it (PROD-W3: "Concord Taco Tra…").
  assert.equal(retail.container.querySelector('.tc-ticket__value')?.textContent, '长期有效');
  assert.equal(retail.container.querySelector('.tc-ticket__stub'), null);
  assert.equal(retail.container.querySelector('.tc-eyebrow')?.textContent, 'Yogurtland');
  assert.doesNotMatch(retail.container.textContent ?? '', /会员生日礼/);
  cleanup();
  const withOrder = { brand: 'SMASHBURGER', title: '周三买完整成人套餐，12 岁及以下儿童餐免费', availability: 'ongoing', kind: 'purchase' } as const;
  const zhOrder = wrap(<OfferTypeCover offer={withOrder} today={today} />);
  assert.equal(zhOrder.container.querySelector('.tc-ticket__value')?.textContent, '随单免费');
  cleanup();
  await act(async () => { await setLocale('en', false); });
  const enOrder = wrap(<OfferTypeCover offer={withOrder} today={today} />);
  assert.equal(enOrder.container.querySelector('.tc-ticket__value')?.textContent, 'Free');
  assert.equal(enOrder.container.querySelector('.tc-ticket__cond')?.textContent, 'with purchase', 'the condition stays on the cover');
  cleanup();
  await act(async () => { await setLocale('zh-Hans', false); });
  const opening = wrap(<OpeningTypeCover opening={{ name: 'Sergeant Ma', city: 'San Francisco', status: 'announced', openingType: 'new-restaurant' }} today={today} />);
  const shop = opening.container.querySelector('[data-cover="type"]')!;
  assert.deepEqual(['data-family', 'data-mark', 'data-tone'].map(name => shop.getAttribute(name)), ['shop', 'shopfront', 'food']);
  assert.equal(shop.querySelector('.tc-sign')?.textContent, '新开餐厅即将开业');
  assert.doesNotMatch(shop.textContent ?? '', /Sergeant Ma/, 'the sign says what it sells, not the name the caption prints (G4)');
  cleanup();
  const dated = wrap(<OpeningTypeCover opening={{ name: 'Marufuku', city: 'Burlingame', status: 'open', openedOn: '2026-10-01', openingType: 'new-restaurant', category: '拉面' }} today={today} />);
  assert.equal(dated.container.querySelector('.tc-sign')?.textContent, '拉面10/1 开业');
});

test('EventCover shows the resolved photo with its provenance chip and nothing else, or falls back to the date family', () => {
  const photo = getCover({ kind: 'event', id: 'fleet', imageKey: 'dvids-blue-angels-sffw-2024' }, { images: GUIDE_IMAGES, today });
  const withPhoto = wrap(<EventCover event={fleetWeek} today={today} cover={photo} priority />);
  const img = withPhoto.container.querySelector('img.ui-cover__img')!;
  assert.equal(img.getAttribute('loading'), 'eager');
  assert.equal(img.getAttribute('fetchpriority'), 'high');
  assert.ok(img.getAttribute('srcset')?.includes('480w'));
  const chip = withPhoto.container.querySelector('[data-provenance]')!;
  assert.equal(chip.textContent, '资料图 · 2024');
  assert.equal(chip.hasAttribute('data-chip'), true);
  assert.equal(withPhoto.container.querySelectorAll('.ui-sticker').length, 0, 'the date and price live in the caption (N22)');
  assert.equal(withPhoto.container.querySelector('[data-cover="image"]')?.getAttribute('data-family'), 'photo');
  assert.equal(withPhoto.container.querySelectorAll('img').length, 1, 'one image: no blurred duplicate');
  cleanup();
  const typed = wrap(<EventCover event={fleetWeek} today={today} cover={getCover({ kind: 'event', id: 'fleet', imageKey: 'weekend' }, { images: GUIDE_IMAGES, today })} />);
  assert.equal(typed.container.querySelector('[data-cover="type"]')?.getAttribute('data-family'), 'date', 'an AI illustration is replaced by the date family');
  assert.equal(typed.container.querySelector('img'), null);
  cleanup();
  const offer = wrap(<OfferCover offer={{ brand: 'IKEA', title: '免费咖啡', availability: 'ongoing' }} today={today} cover={{ tier: 'type', reason: 'no-image', label: { zh: 'BAYLINK 信息卡', en: 'Info card' } }} />);
  assert.equal(offer.container.querySelector('.tc-eyebrow')?.textContent, 'IKEA');
});

// The primitives' three sheets in load order (UI9-PREP split ui.css; the cover rules are in covers.css).
const css = ['ui', 'covers', 'cards'].map(name => readFileSync(`src/components/ui/${name}.css`, 'utf8')).join('\n');
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
    // Tokens v2 (UI9-F): the --fs-* ladder steps are text tokens too (the --text-* names alias them), and so are the kept
    // steps (--fs-keep-<px>: the ladder step at 标准, the pre-v2 size in the elder modes).
    assert.match(declaration.value, /^(?:var\(--text-(?:caption|fact|body|reading|card|section|title|h1|display)\)|var\(--fs-(?:badge|meta|body|reading|card|card-lg|section|title|display|keep-\d+)\)|[\d.]+rem|max\(var\(--text-caption\), \d+%\)|clamp\(.*\))$/, where);
    if (declaration.value.startsWith('clamp(')) {
      const clamp = /^clamp\((?:([\d.]+)rem|max\([\d.]+rem, var\(--text-floor\)\)), (.*), [\d.]+rem\)$/.exec(declaration.value);
      assert.ok(clamp, `${where}: clamp(rem floor, …, rem cap)`);
      assert.ok(!clamp[1] || Number(clamp[1]) >= 1, `${where}: a floor under 1rem keeps the 简洁显示 text floor, max(floor, var(--text-floor))`);
      assert.doesNotMatch(clamp[2].replace(/calc\([\d.]+(?:cqw|cqi|vw) \* var\(--fluid-scale\)\)/g, ''), /\d(?:cqw|cqi|vw)\b/, `${where}: a width term grows with Aa through --fluid-scale`);
    }
    const rem = [...declaration.value.matchAll(/([\d.]+)rem/g)].map(match => Number(match[1]));
    if (rem.length) assert.ok(Math.min(...rem) >= .8125, `${(declaration.parent as postcss.Rule).selector}: never below 13px`);
  });
  // The weight budget (N03): 400 and 600 only, written or as --fw-regular / --fw-strong.
  postcss.parse(css).walkDecls('font-weight', declaration => assert.ok(['400', '600', 'var(--fw-regular)', 'var(--fw-strong)'].includes(declaration.value), declaration.value));
  const outsideTokens = css.replace(/:root\s*\{[^}]*\}/, '');
  assert.doesNotMatch(outsideTokens, /#[\da-f]{3,8}\b/i, 'colours outside the token block come from tokens');
});

test('a cover keeps its own category colour: no neighbour rotation (N08)', () => {
  const view = wrap(<><EventTypeCover event={fleetWeek} today={today} /><EventTypeCover event={fleetWeek} today={today} tone="food" /></>);
  const [first, second] = view.container.querySelectorAll('[data-cover="type"]');
  assert.deepEqual([first.getAttribute('data-tone'), second.getAttribute('data-tone')], ['family', 'family']);
  cleanup();
  const bare = wrap(<TypeCover tone="culture" label="文化活动" title="社区讲座" ratio="16:9" />);
  assert.equal(bare.container.querySelector('[data-cover="type"]')?.getAttribute('data-ratio'), '16:9');
});

test('the palette lives in tokens.css: ui.css defines no global names, and every name it reads exists', () => {
  // TOKENS-B moved the WEB-UI token block (TypeCover pairs, status colours, badge, highlight, scrims) into tokens.css.
  // ui.css loads lazily after tokens.css at the same specificity, so a :root name here would override the site-wide value
  // once a primitive mounts; it may only set element-scoped layout variables.
  postcss.parse(css).walkRules(':root', rule => assert.fail(`ui.css has a :root block again (${rule.toString().slice(0, 60)}…): palette names belong in src/tokens.css`));
  postcss.parse(css).walkDecls(declaration => {
    if (declaration.prop.startsWith('--')) assert.match(declaration.prop, /^--(?:ui-cover-ratio|ui-feed-cols|ui-feed-ratio|tc-fg|tc-deep|tc-badge-room)$/, `${declaration.prop} (${(declaration.parent as postcss.Rule).selector})`);
  });
  const globalNames = new Set<string>();
  postcss.parse(tokens).walkRules(':root', rule => rule.walkDecls(declaration => { globalNames.add(declaration.prop); }));
  for (const name of ['--tc-family-bg', '--tc-free-fg', '--color-success', '--color-highlight', '--color-badge-bg', '--color-backdrop', '--scrim-photo']) assert.ok(globalNames.has(name), `tokens.css defines ${name}`);
  const local = new Set(['--ui-cover-ratio', '--ui-feed-cols', '--ui-feed-ratio', '--ui-lqip', '--ui-img-ratio', '--tc-fg', '--tc-deep', '--tc-badge-room', '--tb-from', '--tb-span']);
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

test('no cover drawings: the 21 art files and their mask rules are gone, and a cover loads no image of its own (G3)', async () => {
  const { existsSync } = await import('node:fs');
  assert.equal(existsSync('public/default-covers/art'), false);
  assert.doesNotMatch(css, /default-covers\/art|data-art|url\(/, 'the cover sheets draw with CSS only');
  for (const family of ['event', 'offer', 'opening', 'guide'] as const) {
    const view = wrap(<TypeCover tone="family" family={family} label="标签" title="先打 800-510-2020" value={family === 'offer' ? '免费' : undefined} seed="x" />);
    assert.equal(view.container.querySelector('img,[data-art]'), null, family);
    cleanup();
  }
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

test('a home guide card keeps its family and mark in every language: the rail keys them by the slug and topic, not the title', async () => {
  const { GuideRail } = await import('../src/features/home/GuideRail');
  const { guides } = await import('../src/lib/home-catalog');
  const rail = guides.slice(0, 8);
  const covers = rail.map(() => ({ tier: 'type' as const, label: { zh: 'BAYLINK 信息卡', en: 'Info card' }, reason: 'no-image' as const }));
  const marks = (list: typeof rail) => {
    const view = wrap(<GuideRail intent="weekend" onIntent={() => {}} guides={list} covers={covers} guideCount={141} />);
    const found = [...view.container.querySelectorAll('[data-cover="type"]')].map(node => `${node.getAttribute('data-family')}/${node.getAttribute('data-mark')}`);
    cleanup();
    return found;
  };
  const chinese = marks(rail);
  assert.equal(chinese.length, rail.length);
  assert.deepEqual(marks(rail.map(guide => ({ ...guide, title: `${guide.slug} in English` }))), chinese);
});

test('the offer rail names the info card only for tickets every layout shows (three after a wide ticket)', async () => {
  const { OfferTickets } = await import('../src/features/home/OfferTickets');
  const { HOME_OFFERS } = await import('../src/lib/home-catalog');
  const offers = HOME_OFFERS.slice(0, 6);
  const photo = { tier: 'official' as const, key: 'k', image: { src: '/x.webp', width: 1440, height: 900, alt: '', kind: 'photo' as const, credit: '官方' }, label: { zh: '官方图', en: 'Official' }, fit: 'cover' as const, focal: [50, 40] as const };
  const typeCover = { tier: 'type' as const, label: { zh: 'BAYLINK 信息卡', en: 'Info card' }, reason: 'no-image' as const };
  const rail = (typedAt: number) => {
    const view = wrap(<OfferTickets offers={offers} covers={offers.map((_, index) => index === typedAt ? typeCover : photo)} today={today} />);
    const section = view.container.querySelector('.home-offers')!;
    const result = { wide: section.querySelector('li[data-wide]') !== null, credit: section.hasAttribute('data-cover-credit'), line: section.querySelector('.ui-cover-credit') !== null };
    cleanup();
    return result;
  };
  assert.deepEqual(rail(2), { wide: true, credit: true, line: true });
  assert.deepEqual(rail(4), { wide: true, credit: false, line: false }, 'a narrow desktop hides the fifth ticket');
});
