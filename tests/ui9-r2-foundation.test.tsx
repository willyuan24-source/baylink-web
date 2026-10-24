import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// UI9-R2-FOUNDATION (cold review round 2: R2-01, R2-03, R2-11, R2-18, N05, N06, N08, N10, N13, N24, N25, followup 14):
// one picture frame, one label, the card meta, the status family, two ♡ forms, the press at pointerdown and the type step.
registerHooks({ resolve: (specifier, context, next) => /\.css$/.test(specifier) ? { url: 'data:text/javascript,', shortCircuit: true } : next(specifier, context) });
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
const globals = globalThis as unknown as Record<string, unknown>;
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLImageElement', 'Node', 'Event', 'MouseEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  if (!(key in globals)) Object.defineProperty(globals, key, { configurable: true, writable: true, value: (dom.window as unknown as Record<string, unknown>)[key] });
}
const { render, cleanup, fireEvent } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { CoverImage } = await import('../src/components/ui/CoverImage');
const { ProvenanceBadge } = await import('../src/components/ui/Badges');
const { FeedCard, RowCard } = await import('../src/components/ui/Card');
const { HeroCard } = await import('../src/components/ui/HeroCard');
const { TIER_LABELS, keptLabel } = await import('../src/lib/cover-labels');
const { eventPriceChip, eventTimeLabel, eventWhenLine } = await import('../src/lib/event-facts');
afterEach(cleanup);

const read = (file: string) => readFileSync(file, 'utf8');
/** A rule's declarations ({prop: value}); `media`: the at-rule params it sits in ('' for a top-level rule). */
const decls = (file: string, selector: string, media = '') => {
  const found: Record<string, string> = {};
  postcss.parse(read(file)).walkRules(rule => {
    const at = rule.parent?.type === 'atrule' ? (rule.parent as postcss.AtRule).params : '';
    if (rule.selector === selector && at === media) rule.walkDecls(declaration => { found[declaration.prop] = declaration.value + (declaration.important ? '!important' : ''); });
  });
  return found;
};
const COVERS = 'src/components/ui/covers.css', CARDS = 'src/components/ui/cards.css', UI = 'src/components/ui/ui.css', TOKENS = 'src/tokens.css';
const wrap = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);
const photo = { src: '/guides/test/p.webp', alt: '', width: 1200, height: 800 };

test('R2-01 (OD1): one full-bleed frame — a poster sits whole on a blurred copy of the same file, no mat, keyline or shadow', () => {
  const css = read(COVERS);
  assert.doesNotMatch(css, /\.ui-cover\[data-fit=contain\] \{/, 'no board around a poster');
  postcss.parse(css).walkRules(rule => {
    if (rule.selector.includes('data-fit=contain')) rule.walkDecls(declaration => assert.doesNotMatch(`${declaration.prop}:${declaration.value}`, /^(?:padding|box-shadow)|surface-2|--color-surface\)/, `${rule.selector}: no mat, keyline or shadow`));
  });
  assert.equal(decls(COVERS, '.ui-cover[data-fit=contain] .ui-cover__img')['object-fit'], 'contain', 'never cropped');
  const backdrop = decls(COVERS, '.ui-cover[data-fit=contain]::before');
  assert.equal(backdrop.background, 'var(--ui-backdrop, none) 50% 50% / cover no-repeat');
  assert.match(backdrop.filter, /^blur\(/);
  assert.equal(backdrop.opacity, '0', 'drawn once the picture has decoded');
  const view = wrap(<CoverImage image={{ ...photo, width: 800, height: 1200 }} label="官方图" fit="contain" kind="event" />);
  const frame = view.container.querySelector<HTMLElement>('[data-cover="image"]')!;
  assert.equal(frame.querySelectorAll('img').length, 1, 'the backdrop is CSS, not a second picture');
  fireEvent.load(frame.querySelector('img')!);
  assert.equal(frame.style.getPropertyValue('--ui-backdrop'), 'url("https://www.baylink.us/guides/test/p.webp")', 'the same file: no request more');
  assert.equal(frame.hasAttribute('data-loaded'), true);
});

test('R2-18 / DECISIONS 23: a label the client finds decoding fades in; prerendered HTML and pages without JS keep every label', () => {
  assert.equal(decls(COVERS, '.ui-cover[data-pending]>.ui-provenance[data-chip]').opacity, '0');
  assert.doesNotMatch(read(COVERS), /:not\(\[data-loaded\]\)>\.ui-provenance/, 'never hidden for want of a client-only attribute');
  const html = renderToStaticMarkup(<MemoryRouter><CoverImage image={photo} label="示意图" tier="stock" kind="event" /></MemoryRouter>);
  assert.doesNotMatch(html, /data-pending/, 'the prerendered cover carries no mark: its label shows before (or without) the script');
  const view = wrap(<CoverImage image={photo} label="示意图" tier="stock" kind="event" />);
  const frame = view.container.querySelector<HTMLElement>('[data-cover="image"]')!;
  assert.equal(frame.hasAttribute('data-pending'), true, 'mounted on the client before the picture decodes');
  fireEvent.load(frame.querySelector('img')!);
  assert.equal(frame.hasAttribute('data-pending'), false);
  assert.equal(frame.hasAttribute('data-loaded'), true);
  assert.equal(frame.style.getPropertyValue('--ui-backdrop'), '', 'a cropped photo needs none');
  cleanup();
  // A stand-in (the cover's own file failed) carries the ③ words, full and short.
  const stand = wrap(<CoverImage image={photo} label="官方图" shortLabel="官方图" tier="official" kind="event" fallback={{ src: '/stock.webp' }} fallbackLabel={['Illustrative photo', 'Stock photo']} />);
  fireEvent.error(stand.container.querySelector('img')!);
  const badge = stand.container.querySelector('[data-chip]')!;
  assert.deepEqual([badge.textContent, badge.getAttribute('data-short'), badge.getAttribute('data-tier')], ['Illustrative photo', 'Stock photo', 'stock']);
});

test('R2-03: one label component, bottom-left inside the picture at every size, one line; short words only where the full ones cannot fit', () => {
  const chip = decls(COVERS, '.ui-cover>.ui-provenance[data-chip]');
  assert.deepEqual([chip.top, chip.bottom, chip.left, chip['max-width'], chip['white-space']], ['auto', 'var(--sp-2)', 'var(--sp-2)', '75%', 'nowrap']);
  // ≤ 160 px (DECISIONS 23's 88 px words): every label with short words draws them; ≤ 200 px only the long ones (data-long).
  assert.equal(decls(COVERS, '.ui-cover>[data-chip][data-short]', 'ui-cover (max-width:160px)')['font-size'], '0');
  assert.equal(decls(COVERS, '.ui-cover>[data-chip][data-short]::after', 'ui-cover (max-width:160px)').content, 'attr(data-short) / ""');
  assert.deepEqual(decls(COVERS, '.ui-cover>[data-chip][data-short]', 'ui-cover (max-width:200px)'), {}, 'a 2-up card keeps the full words');
  assert.equal(decls(COVERS, '.ui-cover>[data-chip][data-long]::after', 'ui-cover (max-width:200px)').content, 'attr(data-short) / ""');
  assert.equal(decls(COVERS, '.ui-cover>.ui-provenance[data-chip]', 'ui-cover (max-width:160px)')['font-size'], 'var(--fs-label-tiny)');
  assert.match(renderToStaticMarkup(<ProvenanceBadge label="Official image · 2025 edition" short="Official 2025" tier="official" />), /data-short="Official 2025" data-long="">/);
  assert.doesNotMatch(renderToStaticMarkup(<ProvenanceBadge label="官方图 · 2025 往届" short="2025 往届" tier="official" />), /data-long/, '13 characters fit a 2-up card');
  assert.doesNotMatch(read(CARDS), /\.ui-row-card__thumb \.ui-provenance/, 'no strip variant');
  assert.doesNotMatch(read(COVERS), /:has\(\.ui-row-card__credit\)/, 'no rule trades the label for a text line');
  // Every picture but a 3D postcard takes the chip: a guide's or detail page's title picture too (no top-left badge).
  const titlePicture = renderToStaticMarkup(<MemoryRouter><CoverImage image={photo} label="示意图" tier="stock" sizes="800px" /></MemoryRouter>);
  assert.match(titlePicture, /data-chip=""/);
  const postcard = renderToStaticMarkup(<MemoryRouter><CoverImage image={{ ...photo, scene3d: true }} label="3D 场景插图" /></MemoryRouter>);
  assert.doesNotMatch(postcard, /data-chip|data-short/, 'the 3D postcards keep their badge (DECISIONS 1)');
  // The words: the full ones are the text, the short ones the drawn copy on a small picture.
  assert.match(renderToStaticMarkup(<ProvenanceBadge label="官方图 · 2025 往届" short="2025 往届" tier="official" />), /data-short="2025 往届">官方图 · 2025 往届</);
  assert.deepEqual([TIER_LABELS.officialEdition('2025').zhShort, TIER_LABELS.officialEdition('2025').enShort, TIER_LABELS.venue(2024).zhShort, TIER_LABELS.venue(2024).enShort, TIER_LABELS.stock.enShort],
    ['2025 往届', 'Official 2025', '场馆照 · 2024', 'Venue 2024', 'Stock photo']);
  assert.deepEqual([keptLabel('资料图 · 2019').zhShort, keptLabel('照片 · 2014').zhShort, keptLabel('BAYLINK 实拍 · 10/12').zhShort, keptLabel('Archive photo · 2019').enShort, keptLabel('BAYLINK photo · Oct 12').enShort],
    ['资料图 · 2019', '照片 · 2014', '实拍 · 10/12', 'Archive 2019', 'BAYLINK · Oct 12']);
});

test('DECISIONS 23: a short label never loses the year, and keeps the tier word (往届 for a past edition in Chinese)', () => {
  const labels = [TIER_LABELS.official, TIER_LABELS.officialEdition('2025'), TIER_LABELS.officialProduct, TIER_LABELS.venue(2021), TIER_LABELS.venue(), TIER_LABELS.stock, TIER_LABELS.ai,
    keptLabel('照片 · 2019'), keptLabel('资料图 · 2017'), keptLabel('Archive photo · 2017'), keptLabel('Photo · 2014'), keptLabel('BAYLINK 实拍 · 10/03'), keptLabel('BAYLINK photo · Oct 3')];
  for (const label of labels) for (const [full, short] of [[label.zh, label.zhShort], [label.zhHant, label.zhHantShort], [label.en, label.enShort]]) {
    for (const date of full.match(/\d{4}|\d+\/\d+|[A-Z][a-z]{2} \d+/g) ?? []) assert.ok(short.includes(date), `${full} → ${short}: keeps ${date}`);
    if (/^官方/.test(full)) assert.match(short, /官方|往[届屆]/, `${full} → ${short}`);
    if (/^Official/.test(full)) assert.match(short, /^Official/, `${full} → ${short}`);
  }
});

test('R2-11: ≤ 3 lines under a card title — when, one status · place line, the quiet ✓ line; only that line has a ✓', () => {
  const meta = decls(CARDS, ':is(.ui-feed-card__meta,.ui-feed-card>.ui-feed-card__trust>span)');
  assert.deepEqual([meta['white-space'], meta['text-overflow'], meta.overflow], ['nowrap', 'ellipsis', 'hidden'], 'the status · place and ✓ words: one line each');
  const trust = decls(CARDS, ':is(.ui-feed-card__trust,.ui-hero-card__trust)');
  assert.deepEqual([trust['font-size'], trust.color], ['var(--text-caption)', 'var(--color-ink-3)'], 'caption size, the lightest ink at ≥ 4.5:1');
  assert.equal(decls(CARDS, ':is(.ui-feed-card__trust,.ui-hero-card__trust)>svg').color, undefined, 'its ✓ in the same ink');
  assert.doesNotMatch(read(COVERS), /content:"✓"/, '已开业 has no ✓ of its own');
  for (const line of ['.ui-card-when', '.ui-hero-card__meta']) assert.equal(decls(COVERS, line)['line-height'], 'var(--lh-ui)', `${line}: the body ladder (N05)`);
});

test('R2-11: a feed card’s when line holds one line and ends in a visible "…" at a word break; rows and heroes wrap it whole', () => {
  const when = decls(CARDS, '.ui-feed-card__when');
  assert.deepEqual([when.display, when['-webkit-box-orient'], when['-webkit-line-clamp'], when.overflow, when['text-wrap']], ['-webkit-box', 'vertical', '1', 'hidden', 'wrap'],
    '"周六 10/24 · 10:30、…" / "Sun, Oct 25 · 10:30am–…": the cut shows (pretty wrapping would move words down)');
  assert.doesNotMatch(read(CARDS), /ui-when-piece|__when[^{]*\{[^}]*white-space:(?:pre|nowrap)/, 'no unbreakable when line anywhere: a row, a rail or a hero wraps it');
  const card = wrap(<FeedCard title="Storytime" to="/events/x" cover={null} when="Sun, Oct 25 · 10:30am–11am" trust="News report · checked Sep 28" />).container;
  assert.equal(card.querySelector('.ui-feed-card__when')!.innerHTML, 'Sun, Oct 25 · 10:30am–11am', 'plain text: the whole line stays in the DOM');
  assert.equal(card.querySelector('.ui-feed-card__trust>span')!.textContent, 'News report · checked Sep 28');
  cleanup();
  const row = wrap(<RowCard title="Storytime" to="/events/x" thumb={null} when="周六 10/24 · 10:30、11:30、13:00" />).container;
  assert.equal(row.querySelector('.ui-row-card__date')!.innerHTML, '周六 10/24 · 10:30、11:30、13:00', 'a row prints the when line as words that wrap');
  cleanup();
  const hero = wrap(<HeroCard title="Storytime" to="/events/x" cover={null} when="Sat, Oct 24 · 10:30am, 11:30am" />).container;
  assert.equal(hero.querySelector('.ui-card-when')!.innerHTML, 'Sat, Oct 24 · 10:30am, 11:30am', 'a hero too');
  assert.equal(decls(COVERS, '.ui-card-when')['font-variant-numeric'], undefined, 'proportional figures: 周六 10/24 · 10:30、11:30 fits 173 px');
});

test('N21: a cover-fit picture asks for the width it is drawn at (a 3:2 file in a 173 px square: 260px); 3D postcards keep theirs', () => {
  const box = HTMLImageElement.prototype.getBoundingClientRect;
  HTMLImageElement.prototype.getBoundingClientRect = function () { return { width: 173, height: 173, top: 0, left: 0, right: 173, bottom: 173, x: 0, y: 0, toJSON: () => ({}) } as DOMRect; };
  // jsdom has no `loading` IDL attribute; browsers reflect the content attribute (default "eager").
  if (!('loading' in HTMLImageElement.prototype)) Object.defineProperty(HTMLImageElement.prototype, 'loading', { configurable: true, get(this: HTMLImageElement) { return this.getAttribute('loading') || 'eager'; } });
  try {
    const srcSet = '/p-small.webp 480w, /p-800.webp 800w, /p.webp 1200w';
    const img = (node: React.ReactNode) => wrap(node).container.querySelector('img')!;
    assert.equal(img(<CoverImage image={{ ...photo, srcSet }} ratio="1:1" sizes="88px" />).getAttribute('sizes'), '260px', 'before the browser picks a file');
    cleanup();
    assert.equal(img(<CoverImage image={{ ...photo, width: 800, height: 1200, srcSet }} fit="contain" ratio="1:1" />).getAttribute('sizes'), '116px', 'a tall poster is drawn frame height × its aspect wide');
    cleanup();
    assert.equal(img(<CoverImage image={{ ...photo, srcSet, scene3d: true } as never} sizes="88px" />).getAttribute('sizes'), '88px', 'DECISIONS 1: frozen');
    cleanup();
    assert.equal(img(<CoverImage image={{ ...photo, srcSet }} ratio="1:1" sizes="88px" priority />).getAttribute('sizes'), 'calc(88px * 1.50)', 'an eager picture is already being fetched: no second request while it loads');
    cleanup();
    // The prerendered sizes already include the crop (a picture that loads before the script runs is the right file).
    const html = renderToStaticMarkup(<MemoryRouter><CoverImage image={{ ...photo, srcSet }} ratio="1:1" /></MemoryRouter>);
    assert.match(html, /sizes="\(max-width: 767px\) calc\(calc\(50vw - 22px\) \* 1\.50\), \(max-width: 1023px\) calc\(calc\(33vw - 24px\) \* 1\.50\), calc\(286px \* 1\.50\)"/);
    assert.match(renderToStaticMarkup(<MemoryRouter><CoverImage image={{ ...photo, srcSet }} /></MemoryRouter>), /sizes="\(max-width: 767px\) calc\(50vw - 22px\), \(max-width: 1023px\) calc\(33vw - 24px\), 286px"/, 'a 3:2 frame: as is');
    cleanup();
  } finally { HTMLImageElement.prototype.getBoundingClientRect = box; }
  const code = read('src/components/ui/CoverImage.tsx');
  assert.match(code, /img\.complete \? drawn > img\.naturalWidth \* 1\.3 : img\.loading == 'lazy'\)\) img\.sizes = sizes/, 'a lazy picture not yet loaded takes the drawn width; a loaded one only when its slot was over 1.3× too narrow (a second download)');
  assert.match(code, /img\.sizes !== sizes/, 'set only when it changes: setting sizes re-runs the source pick');
});

test('N08: one 免费 look, 部分免费 in the same lime family, deadlines are ink words after a red dot (no solid red)', () => {
  assert.deepEqual(decls(COVERS, '.ui-status[data-tone=free]'), { background: 'var(--color-highlight)', color: 'var(--color-brand-deep)' });
  assert.equal(decls(COVERS, '.ui-status[data-tone=partial]').background, 'rgb(var(--color-highlight-rgb) / .45)');
  for (const tone of ['soon', 'urgent']) {
    const look = decls(COVERS, `.ui-status[data-tone=${tone}]`);
    assert.equal(look.color, 'var(--color-ink)', tone);
    assert.notEqual(look.background, 'var(--color-danger)', `${tone}: solid red is for errors`);
  }
  assert.equal(decls(COVERS, '.ui-status:is([data-tone=soon],[data-tone=urgent])::before').background, 'var(--color-danger)', 'the small red dot');
  assert.doesNotMatch(read(CARDS), /\.ui-feed-card__meta strong/, 'no second, brand-text 免费 look');
});

test('N06: one zh time pattern on cards and details (H:MM–H:MM), dollars through Intl', () => {
  const planning = (open: string, close?: string) => ({ schedule: { sourceUrl: 'https://example.org', verifiedAt: '2026-10-01', dates: { '2026-10-10': [{ open, close }] } } });
  assert.equal(eventTimeLabel({ planning: planning('11:00', '19:00') } as never, '2026-10-10', false), '11:00–19:00');
  assert.equal(eventTimeLabel({ planning: planning('19:00') } as never, '2026-10-10', false), '19:00 起');
  assert.equal(eventTimeLabel({ planning: planning('09:30', '12:00') } as never, '2026-10-10', false), '9:30–12:00');
  assert.equal(eventTimeLabel({ sessions: [{ date: '2026-10-10', start: '09:00' }, { date: '2026-10-10', start: '14:00' }] } as never, '2026-10-10', false), '9:00、14:00');
  const day = { startDate: '2026-10-10', endDate: '2026-10-10', sessions: [{ date: '2026-10-10', start: '09:00', end: '17:00' }] };
  assert.equal(eventWhenLine(day as never, '2026-10-01').zh, '周六 10/10 · 9:00–17:00');
  assert.deepEqual(eventPriceChip({ cost: 'paid', planning: { admissionUsd: 1200 } } as never)?.text, { zh: '$1,200', en: '$1,200' });
  assert.deepEqual(eventPriceChip({ cost: 'paid', price: { min: 8.5, max: 12 } } as never)?.text, { zh: '$8.50–$12.00', en: '$8.50–$12.00' });
});

test('N13 / N25: two ♡ forms — the 44px circle on a picture or at a row\'s right edge, the labelled cell; no 36px ♡', () => {
  assert.equal(decls(CARDS, '.ui-row-card__save')['grid-area'], 'trailing');
  assert.doesNotMatch(read(CARDS).replace(/\/\*[^]*?\*\//g, ""), /2\.25rem|36px/, "no smaller ♡ in the card sheet");
  const compact = decls('src/features/saves/saves.css', ':is(.ui-feed-card__save,.ui-hero-card__save,.ui-row-card__trailing,.ui-row-card__save) .saves-control .saves-toggle');
  assert.deepEqual([compact.width, compact.height, compact['min-height']], Array(3).fill('var(--control-height)!important'), 'the area sheets\' 36px give way');
  const row = renderToStaticMarkup(<MemoryRouter><RowCard title="T" to="/x" thumb={<span />} save={<button type="button">♡</button>} trailing={<button type="button">加入</button>} /></MemoryRouter>);
  assert.ok(row.indexOf('ui-row-card__save') > row.indexOf('ui-row-card__thumb'), 'the ♡ is a sibling after the picture, not on it');
  // ♡ + 加入 (/plan): stacked in the one right-edge column, so the text keeps its width; 简洁 drops the ♡ and the row is a
  // one-action row again.
  const both = '.ui-row-card:has(>.ui-row-card__save+.ui-row-card__trailing)';
  assert.equal(decls(CARDS, `html:not([data-simple]) ${both}`)['grid-template-areas'], '"thumb body save" "thumb body trailing"');
  assert.equal(decls(CARDS, `html:not([data-simple]) ${both}`)['grid-template-columns'], undefined, 'three tracks, as a one-action row');
  assert.equal(decls(CARDS, '.ui-row-card__save:has(+.ui-row-card__trailing)')['grid-area'], 'save');
  assert.equal(decls(CARDS, 'html[data-simple] .ui-row-card__save:not(#saved *)').display, 'none', '简洁: the base one-action row');
  assert.match(read('src/components/ui/Sheet.tsx'), /<IconButton label=\{t\('关闭', 'Close'\)\} className="ui-close" onClick=\{onClose\}><X aria-hidden="true" strokeWidth=\{1\.75\} \/><\/IconButton>/, 'Sheet draws the shared close button\'s markup (ui-close)');
});

test('N24: a pointerdown marks the pressed tab, button or in-page link at once (mouse) — not only cards', async () => {
  const page = new JSDOM('<nav><a class="ui-tabs__item" href="/events">本周末</a><button class="ui-button" id="b">去</button><a id="l" href="#about">我们怎么核对</a><button class="ui-button" id="d" disabled>x</button></nav>');
  const saved = { document: globals.document, window: globals.window };
  globals.document = page.window.document; globals.window = page.window;
  try {
    await import(`../src/components/ui/card-press.ts?press=${Date.now()}`);
    const fire = (target: Element, type: string) => { const event = new page.window.Event(type, { bubbles: true }) as Event & { pointerType: string; button: number }; Object.assign(event, { pointerType: 'mouse', button: 0 }); target.dispatchEvent(event); };
    for (const target of [page.window.document.querySelector('.ui-tabs__item')!, page.window.document.getElementById('b')!, page.window.document.getElementById('l')!]) {
      fire(target, 'pointerdown');
      assert.equal(target.hasAttribute('data-press'), true, target.textContent!);
      fire(target, 'pointerup');
      assert.equal(target.hasAttribute('data-press'), false);
    }
    fire(page.window.document.getElementById('d')!, 'pointerdown');
    assert.equal(page.window.document.getElementById('d')!.hasAttribute('data-press'), false, 'a disabled control is not pressed');
  } finally { globals.document = saved.document; globals.window = saved.window; }
  assert.match(read(UI), /\.ui-tabs__item[^{]*\):is\(:active,\[data-press\]\)/, 'tabs scale at [data-press]');
});

test('followup 14 / B P04 / N05: 14px captions (13 only for badges, credits and 3D blocks), the desktop step, the en measure, pretty everywhere', () => {
  const root = decls(TOKENS, ':root');
  assert.equal(root['--text-caption'], 'var(--fs-meta)');
  assert.equal(decls(TOKENS, ':where(.ui-provenance,.ui-cover-credit)')['--text-caption'], 'var(--fs-badge)');
  assert.equal(decls(TOKENS, ':where(.home-3d,.home-3d-strip,.xp-3d,.gd-opus)', '(max-width:1023px)')['--text-caption'], 'var(--fs-badge)', 'the 3D blocks keep their phone 13px');
  assert.equal(decls(CARDS, ':is(.ui-feed-card__title,.ui-row-card__title)', '(min-width:1024px)')['font-size'], 'var(--fs-card)');
  assert.equal(decls(CARDS, '.ui-card-when', '(min-width:1024px)')['font-size'], 'var(--fs-body)');
  assert.equal(decls(TOKENS, ':root:lang(en)')['--measure'], '50ch', '≤ 75 Latin characters a line (the /guides lede ran to 89 at 62ch)');
  assert.equal(decls(TOKENS, ':root')['text-wrap-style'], 'pretty');
  // The ladder (N05): no line-height literal left in the card and control sheets except the frozen 3D postcard badge.
  for (const file of [UI, CARDS, 'src/features/saves/saves.css']) assert.doesNotMatch(read(file), /line-height:1\.\d/, file);
  assert.equal(read(COVERS).match(/line-height:1\.\d+/g)?.length, 1, 'only .ui-provenance (the postcards\' badge) keeps 1.385');
});
