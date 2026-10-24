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
const { render, cleanup } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { EventCover, OfferCover, Cover } = await import('../src/components/ui');
cssHook.deregister();
const { setLocale } = await import('../src/i18n/locale');
const { getCover, createCoverPage } = await import('../src/lib/cover');
const { GUIDE_IMAGES } = await import('../src/data/guide-media');

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
const today = '2026-10-08';
const fleetWeek = {
  id: 'fleet', title: 'Fleet Week 蓝天使航展：海军舰艇开放与飞行表演', startDate: '2026-10-10', endDate: '2026-10-11', occurrenceDates: undefined,
  city: 'San Francisco', category: 'family' as const, cost: 'free' as const, audience: ['家庭'], iconKey: 'plane',
};
const wrap = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

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
  // An AI illustration the owner has not approved (src/data/ai-cover-approvals.json) is skipped for the next candidate
  // (UI9-IMAGES ④). ('settling' is not among the owner's 2026-10-21 approvals.)
  const next = getCover({ kind: 'event', id: 'fleet', imageKeys: ['settling', 'dvids-blue-angels-sffw-2024'] }, { images: GUIDE_IMAGES, today });
  assert.equal(next.tier !== 'type' && next.key, 'dvids-blue-angels-sffw-2024', 'the unapproved AI candidate moves on to the next one');
  // UI9-IMAGES DECISIONS 21: with no candidate left (which report:covers keeps at 0 for every listed record) the frame keeps
  // its LQIP colour: never a date board, ticket, shop sign or title plate.
  const typed = wrap(<EventCover event={fleetWeek} today={today} cover={getCover({ kind: 'event', id: 'fleet', imageKey: 'settling' }, { images: GUIDE_IMAGES, today })} />);
  assert.equal(typed.container.querySelector('[data-cover="type"]'), null);
  assert.ok(typed.container.querySelector('[data-cover="lqip"][aria-hidden="true"]'));
  assert.equal(typed.container.querySelector('img'), null);
  cleanup();
  // Captain 10-22 02:50: a card whose only picture another card on the page already claimed shows it again (the resolver
  // still reports the slot, report:covers counts it) rather than an empty frame.
  const page = createCoverPage();
  getCover({ kind: 'event', id: 'first', imageKey: 'dvids-blue-angels-sffw-2024' }, { images: GUIDE_IMAGES, today, page });
  const second = getCover({ kind: 'event', id: 'fleet', imageKey: 'dvids-blue-angels-sffw-2024' }, { images: GUIDE_IMAGES, today, page });
  assert.ok(second.tier === 'type' && second.reason === 'duplicate' && second.repeat, 'the resolver still reports the duplicate');
  const repeated = wrap(<EventCover event={fleetWeek} today={today} cover={second} />);
  assert.equal(repeated.container.querySelector('[data-cover="lqip"]'), null);
  assert.equal(repeated.container.querySelector('img')?.getAttribute('src'), GUIDE_IMAGES['dvids-blue-angels-sffw-2024'].src);
  assert.equal(repeated.container.querySelector('[data-provenance]')?.textContent, '资料图 · 2024');
  cleanup();
  const offer = wrap(<OfferCover offer={{ brand: 'IKEA', title: '免费咖啡', availability: 'ongoing' }} today={today} cover={{ tier: 'type', reason: 'no-image', label: { zh: 'BAYLINK 信息卡', en: 'Info card' } }} />);
  assert.equal(offer.container.textContent, '', 'no brand, value or deadline drawn on a cover');
  assert.equal(offer.container.querySelector('[data-cover="lqip"]')?.getAttribute('data-ratio'), '1:1');
});

test('a picture whose file fails becomes its ③ fallback, then the LQIP colour (UI9-IMAGES DECISIONS 21 onError)', async () => {
  const { fireEvent } = await import('@testing-library/react');
  const stock = Object.entries(GUIDE_IMAGES).filter(([key]) => key.startsWith('stock-family-outdoor-')).map(([key]) => key);
  assert.ok(stock.length >= 2);
  const cover = getCover({ kind: 'event', id: 'fleet', imageKeys: ['dvids-blue-angels-sffw-2024', ...stock] }, { images: GUIDE_IMAGES, today });
  assert.ok(cover.tier !== 'type' && cover.fallback, 'a ①② picture carries its next ③ picture');
  const view = wrap(<EventCover event={fleetWeek} today={today} cover={cover} />);
  assert.equal(view.container.querySelector('[data-provenance]')?.textContent, '资料图 · 2024');
  fireEvent.error(view.container.querySelector('img')!);
  assert.equal(view.container.querySelector('img')?.getAttribute('src'), GUIDE_IMAGES[stock[0]].src);
  // The stand-in is a ③ picture: its own badge words and tier, never the failed picture's ① / ② words (DECISIONS 23/24).
  assert.equal(view.container.querySelector('[data-provenance]')?.textContent, '示意图');
  assert.equal(view.container.querySelector('[data-cover="image"]')?.getAttribute('data-tier'), 'stock');
  assert.equal(view.container.querySelector('[data-cover="image"]')?.getAttribute('data-fit'), 'cover');
  fireEvent.error(view.container.querySelector('img')!);
  assert.equal(view.container.querySelector('img'), null, 'the LQIP colour shows');
  assert.ok(view.container.querySelector('[data-cover="image"]'), 'the same frame stays (CLS 0)');
  // The same mounted card given another picture starts again from that picture (the failure belongs to the failed file).
  const other = getCover({ kind: 'event', id: 'fleet', imageKeys: [stock[1]] }, { images: GUIDE_IMAGES, today });
  view.rerender(<MemoryRouter><EventCover event={fleetWeek} today={today} cover={other} /></MemoryRouter>);
  assert.equal(view.container.querySelector('img')?.getAttribute('src'), GUIDE_IMAGES[stock[1]].src);
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

test('every category tone pair and status pair is at least 4.5:1', () => {
  const pairs: [string, string][] = ['family', 'culture', 'outdoors', 'food', 'seniors', 'free'].map(tone => [`--tc-${tone}-fg`, `--tc-${tone}-bg`]);
  pairs.push(['--color-success', '--color-success-tint'], ['--color-warning', '--color-warning-tint'], ['--color-danger', '--color-danger-tint'], ['--color-info', '--color-info-tint'], ['--color-brand-deep', '--color-highlight']);
  for (const [fg, bg] of pairs) assert.ok(contrast(fg, bg) >= 4.5, `${fg} on ${bg}: ${contrast(fg, bg).toFixed(2)}:1`);
});

test('cover and card text scales with Aa once: every size is a text token, a rem, a clamp() between rem bounds, or a share of its parent never below the caption size', () => {
  postcss.parse(css).walkDecls('font-size', declaration => {
    const where = `${(declaration.parent as postcss.Rule).selector}: ${declaration.value}`;
    // Root Aa (html[data-reading], WEB-TOKENS-A) scales every rem: a second --reading-scale would double-scale, px never grows.
    assert.doesNotMatch(declaration.value, /--reading-scale|\d(?:\.\d+)?px\b/, where);
    // A bare .47em under a 22px value floor was 10.3px; the small date/value part now keeps the caption size as its floor.
    // Tokens v2 (UI9-F): the --fs-* ladder steps are text tokens too (the --text-* names alias them), and so are the kept
    // steps (--fs-keep-<px>: the ladder step at 标准, the pre-v2 size in the elder modes).
    assert.match(declaration.value, /^(?:var\(--text-(?:caption|fact|body|reading|card|section|title|h1|display)\)|var\(--fs-(?:badge|meta|body|reading|card|card-lg|section|title|display|keep-\d+|label-thumb|label-tiny)\)|[\d.]+rem|0|max\(var\(--text-caption\), \d+%\)|clamp\(.*\))$/, where);
    if (declaration.value.startsWith('clamp(')) {
      // UI9-R2-FOUNDATION (N01): a bound may be a ladder token (var(--fs-keep-20), var(--text-h1)) instead of a rem literal.
      const clamp = /^clamp\((?:([\d.]+)rem|max\([\d.]+rem, var\(--text-floor\)\)|var\(--(?:fs|text)-[a-z0-9-]+\)), (.*), (?:[\d.]+rem|var\(--(?:fs|text)-[a-z0-9-]+\))\)$/.exec(declaration.value);
      assert.ok(clamp, `${where}: clamp(rem floor, …, rem cap)`);
      assert.ok(!clamp[1] || Number(clamp[1]) >= 1, `${where}: a floor under 1rem keeps the 简洁显示 text floor, max(floor, var(--text-floor))`);
      assert.doesNotMatch(clamp[2].replace(/calc\([\d.]+(?:cqw|cqi|vw) \* var\(--fluid-scale\)\)/g, ''), /\d(?:cqw|cqi|vw)\b/, `${where}: a width term grows with Aa through --fluid-scale`);
    }
    const rem = [...declaration.value.matchAll(/([\d.]+)rem/g)].map(match => Number(match[1]));
    if (rem.length) assert.ok(Math.min(...rem) >= .8125, `${(declaration.parent as postcss.Rule).selector}: never below 13px`);
  });
  // The weight budget (N03): 400 and 600, written or as --fw-regular / --fw-strong, and --fw-medium (500) for feed and row
  // card titles (D3, UI9-R1-AFTER-A1-CARD-SYSTEM).
  postcss.parse(css).walkDecls('font-weight', declaration => assert.ok(['400', '600', 'var(--fw-regular)', 'var(--fw-medium)', 'var(--fw-strong)'].includes(declaration.value), declaration.value));
  const outsideTokens = css.replace(/:root\s*\{[^}]*\}/, '');
  assert.doesNotMatch(outsideTokens, /#[\da-f]{3,8}\b/i, 'colours outside the token block come from tokens');
});

test('the palette lives in tokens.css: ui.css defines no global names, and every name it reads exists', () => {
  // TOKENS-B moved the WEB-UI token block (TypeCover pairs, status colours, badge, highlight, scrims) into tokens.css.
  // ui.css loads lazily after tokens.css at the same specificity, so a :root name here would override the site-wide value
  // once a primitive mounts; it may only set element-scoped layout variables.
  postcss.parse(css).walkRules(':root', rule => assert.fail(`ui.css has a :root block again (${rule.toString().slice(0, 60)}…): palette names belong in src/tokens.css`));
  postcss.parse(css).walkDecls(declaration => {
    if (declaration.prop.startsWith('--')) assert.match(declaration.prop, /^--(?:ui-cover-ratio|ui-feed-cols|ui-feed-ratio)$/, `${declaration.prop} (${(declaration.parent as postcss.Rule).selector})`);
  });
  const globalNames = new Set<string>();
  postcss.parse(tokens).walkRules(':root', rule => rule.walkDecls(declaration => { globalNames.add(declaration.prop); }));
  for (const name of ['--tc-family-bg', '--tc-free-fg', '--color-success', '--color-highlight', '--color-badge-bg', '--color-backdrop', '--scrim-photo']) assert.ok(globalNames.has(name), `tokens.css defines ${name}`);
  const local = new Set(['--ui-cover-ratio', '--ui-feed-cols', '--ui-feed-ratio', '--ui-lqip', '--ui-img-ratio']);
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

test('no information cards: the family modules, their rules and the drawings are gone (UI9-IMAGES DECISIONS 21)', async () => {
  const { existsSync } = await import('node:fs');
  assert.equal(existsSync('public/default-covers/art'), false);
  for (const file of ['TypeCover.tsx', 'cover-date.tsx', 'cover-date-face.tsx', 'cover-ticket.tsx', 'cover-shop.tsx', 'cover-guide.tsx', 'cover-frame.tsx', 'cover-defer.tsx']) {
    assert.equal(existsSync(`src/components/ui/${file}`), false, file);
  }
  assert.equal(existsSync('src/lib/cover-family.ts'), false);
  assert.doesNotMatch(css, /default-covers\/art|data-art|url\(|ui-type-cover|\.tc-|ui-cover-credit/, 'the cover sheets draw pictures only');
  const view = wrap(<Cover cover={{ tier: 'type', reason: 'no-image', label: { zh: 'BAYLINK 信息卡', en: 'Info card' } }} />);
  assert.equal(view.container.querySelector('img,[data-art],[data-cover="type"]'), null);
});

test('no list names an information card any more: FeedGrid prints no 没有照片的条目 line', async () => {
  const { FeedGrid, FeedItem, FeedCard } = await import('../src/components/ui');
  const photo = getCover({ kind: 'event', id: 'fleet', imageKey: 'dvids-blue-angels-sffw-2024' }, { images: GUIDE_IMAGES, today });
  const view = wrap(<FeedGrid label="本周末活动">
    <FeedItem><FeedCard title="社区讲座" to="/events/a" cover={<EventCover event={fleetWeek} today={today} cover={photo} />} trust="官网核对 10/7" /></FeedItem>
  </FeedGrid>);
  assert.equal(view.container.querySelector('.ui-cover-credit,[data-cover-credit]'), null);
  assert.doesNotMatch(view.container.textContent ?? '', /BAYLINK 信息卡/);
});

test('the offer rail opens wide on a landscape photo and prints no info-card line', async () => {
  const { OfferTickets } = await import('../src/features/home/OfferTickets');
  const { HOME_OFFERS } = await import('../src/lib/home-catalog');
  const offers = HOME_OFFERS.slice(0, 6);
  const photo = { tier: 'official' as const, key: 'k', image: { src: '/x.webp', width: 1440, height: 900, alt: '', kind: 'photo' as const, credit: '官方', caption: '' }, label: { zh: '官方图', en: 'Official' }, fit: 'cover' as const, focal: [50, 40] as const };
  const view = wrap(<OfferTickets offers={offers} covers={offers.map(() => photo)} today={today} />);
  const section = view.container.querySelector('.home-offers')!;
  assert.ok(section.querySelector('li[data-wide]'));
  assert.equal(section.querySelector('.ui-cover-credit'), null);
  assert.equal(section.hasAttribute('data-cover-credit'), false);
  for (const item of section.querySelectorAll('li')) assert.equal(item.querySelectorAll('[data-cover="image"] img').length, 1);
});
