// The cover system after UI9-IMAGES (DECISIONS 21): every listing cover is a picture (①–④), the one card date/time line
// (eventWhenLine, G18 / N06), the one status map (N08), the guide hooks' lime phrases (G19, the guide pages' answers), the
// detail hero and the cover sheet's rules (N02 / N22 / G6). The seven UI9-C families (date board, ticket, shop sign, title
// and number plates) are gone.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
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
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, cleanup, act, fireEvent } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { CoverImage, StatusChip, statusLook, COVER_SIZES } = await import('../src/components/ui');
const { setLocale, translateText } = await import('../src/i18n/locale');
const { eventWhenLine } = await import('../src/lib/event-facts');
const { GUIDE_HOOK_HIGHLIGHTS, hookHighlight, splitTitleHook } = await import('../src/lib/guide-hook-highlight');
const { splitGuideTitle } = await import('../src/features/guides/guide-facts');
const { GUIDE_COVER_ANSWERS } = await import('../src/data/guide-editorial/answers');
const { DetailHero } = await import('../src/features/detail/DetailHero');
const { LEGACY_STATUS_TONES } = await import('../src/components/ui/Badges');
const { getCover } = await import('../src/lib/cover');
const { GUIDE_IMAGES } = await import('../src/data/guide-media');

afterEach(async () => { cleanup(); await act(async () => { await setLocale('zh-Hans', false); }); });
const wrap = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);
/** A top-level rule's declarations, as written ('a:b; c:d'). */
const postcssRule = (css: string, selector: string) => { let found = ''; postcss.parse(css).walkRules(rule => { if (rule.parent?.type === 'root' && rule.selector === selector) found = rule.nodes.map(node => node.toString()).join('; '); }); return found; };
const today = '2026-10-19';
const guidesIndex = JSON.parse(readFileSync('src/data/generated/guides-index.json', 'utf8'));

test('eventWhenLine: one date pattern and one time pattern, "周六 10/17 · 11:00–16:00" / "Sat, Oct 17 · 11am–4pm"', () => {
  const event = { startDate: '2026-10-17', endDate: '2026-10-17', occurrenceDates: undefined, sessions: [{ date: '2026-10-17', start: '11:00', end: '16:00' }] };
  assert.deepEqual(eventWhenLine(event, '2026-10-12'), { zh: '周六 10/17 · 11:00–16:00', en: 'Sat, Oct 17 · 11am–4pm' });
  assert.deepEqual(eventWhenLine({ ...event, sessions: [{ date: '2026-10-17', start: '9:30', end: '12:15' }] }, '2026-10-12'), { zh: '周六 10/17 · 9:30–12:15', en: 'Sat, Oct 17 · 9:30am–12:15pm' });
  assert.deepEqual(eventWhenLine({ ...event, sessions: undefined }, '2026-10-12'), { zh: '周六 10/17', en: 'Sat, Oct 17' });
  assert.deepEqual(eventWhenLine({ ...event, endDate: '2026-10-18', sessions: undefined }, '2026-10-12'), { zh: '10/17–18 周六–周日', en: 'Oct 17–18 · Sat–Sun' });
  assert.deepEqual(eventWhenLine({ ...event, sessions: [{ date: '2026-10-17', start: '10:00' }, { date: '2026-10-17', start: '14:00' }] }, '2026-10-12'), { zh: '周六 10/17 · 10:00、14:00', en: 'Sat, Oct 17 · 10am, 2pm' });
  // A weekly schedule with one window on the shown day.
  const weekly = { startDate: '2026-10-01', endDate: '2026-11-30', occurrenceDates: undefined, planning: { schedule: { sourceUrl: 'https://example.org', verifiedAt: '2026-10-01', weekly: { 6: [{ open: '10:00', close: '17:00' }] } } } };
  assert.deepEqual(eventWhenLine(weekly as never, '2026-10-12', ['2026-10-17']), { zh: '周六 10/17 · 10:00–17:00', en: 'Sat, Oct 17 · 10am–5pm' });
});

test('the status map: each status has exactly one look, 14 px, wrapping; none is amber or indigo', () => {
  const css = readFileSync('src/components/ui/covers.css', 'utf8');
  const looks = new Map<string, string>();
  postcss.parse(css).walkRules(rule => {
    const tone = /^\.ui-status\[data-tone=([a-z]+)\]$/.exec(rule.selector)?.[1];
    if (!tone) return;
    assert.ok(!looks.has(tone), `${tone}: one rule`);
    looks.set(tone, rule.nodes.map(node => node.toString()).join(';'));
  });
  assert.deepEqual([...looks.keys()].sort(), ['ended', 'free', 'open', 'partial', 'soon', 'urgent']);
  assert.equal(new Set(looks.values()).size, looks.size, 'no two statuses share a look');
  for (const [tone, look] of looks) assert.doesNotMatch(look, /--color-(?:warning|info)|--tc-(?:food|culture)|apricot|indigo/, `${tone} uses no amber or indigo`);
  const base = postcss.parse(css).nodes.find(node => node.type === 'rule' && node.selector === '.ui-status') as postcss.Rule;
  const decls = Object.fromEntries(base.nodes.filter(node => node.type === 'decl').map(node => [(node as postcss.Declaration).prop, (node as postcss.Declaration).value]));
  assert.equal(decls['font-size'], 'var(--fs-meta)');
  assert.equal(decls['white-space'], 'normal');
  assert.equal(decls['text-overflow'], undefined, 'never an ellipsis');
  // The words decide the look, whatever tone a caller passes; the old tone names still map.
  const cases: [string, string][] = [['免费', 'free'], ['免費', 'free'], ['Free', 'free'], ['部分免费', 'partial'], ['Partly free', 'partial'], ['还剩 3 天', 'soon'], ['3 days left', 'soon'],
    ['今天截止', 'urgent'], ['明天截止', 'urgent'], ['售罄', 'urgent'], ['已售罄', 'urgent'], ['Sold out', 'urgent'], ['已开业', 'open'], ['10/11 已开业', 'open'], ['Opened Oct 11', 'open'],
    ['已结束', 'ended'], ['已结束 · 10/18', 'ended'], ['Ended', 'ended'], ['安排草案', 'neutral'], ['待核实', 'neutral'], ['还需补充', 'neutral'], ['日期待定', 'neutral'],
    // The old success tone was given to more than 已开业: an offer that runs on, a soft opening, a saved plan stay neutral.
    ['长期有效', 'neutral'], ['Ongoing', 'neutral'], ['9/4 起试营业', 'neutral'], ['Soft open', 'neutral'], ['已保存到行程', 'neutral']];
  for (const [words, look] of cases) for (const tone of look === 'neutral' ? ['neutral', 'success', 'warning', 'info'] as const : ['neutral', 'success', 'warning', 'info', 'danger'] as const) assert.equal(statusLook(tone, words), look, `${words} (${tone})`);
  assert.deepEqual(LEGACY_STATUS_TONES, { success: 'neutral', info: 'neutral', warning: 'neutral', danger: 'urgent' });
  const view = wrap(<StatusChip tone="warning">日期待定</StatusChip>);
  assert.equal(view.container.querySelector('.ui-status')?.getAttribute('data-tone'), 'neutral', 'no amber for a pending fact');
});

test('each lime phrase is a substring of its answer in zh, zh-Hant and en; a hook without one takes its first number, fee or clause', async () => {
  for (const [slug, phrase] of Object.entries(GUIDE_HOOK_HIGHLIGHTS)) {
    const answer = GUIDE_COVER_ANSWERS[slug];
    assert.ok(answer, `${slug} has an answer`);
    assert.ok(answer.zh.includes(phrase.zh), `${slug}: "${phrase.zh}" in "${answer.zh}"`);
    assert.ok(answer.en.includes(phrase.en), `${slug}: "${phrase.en}" in "${answer.en}"`);
    assert.ok(translateText(answer.zh, 'zh-Hant').includes(translateText(phrase.zh, 'zh-Hant')), `${slug}: zh-Hant`);
  }
  // Answers that are a phone number carry no lime phrase.
  for (const [slug, answer] of Object.entries(GUIDE_COVER_ANSWERS)) if (!Object.hasOwn(GUIDE_HOOK_HIGHLIGHTS, slug)) assert.match(answer.zh, /\d{3}-\d{3}-\d{4}/, `${slug} needs a lime phrase`);
  assert.equal(hookHighlight('看房、转账、签合同前先检查什么'), '看房');
  assert.equal(hookHighlight('押金最多一个月房租，搬出后 21 天退还'), '21 天');
  assert.equal(hookHighlight('首次申请费 $46'), '$46');
  assert.equal(hookHighlight('先打 800‑510‑2020'), '800‑510‑2020');
  // The title split is guide-facts' splitGuideTitle (the home does not load that module, so the regex is kept twice).
  for (const guide of guidesIndex.guides) {
    const ours = splitTitleHook(guide.title), theirs = splitGuideTitle(guide.title);
    assert.deepEqual([ours.head, ours.rest], [theirs.head, theirs.rest], guide.slug);
  }
});

test('answered guide cards carry their hook from the generator; /guides no longer imports answers.ts', () => {
  const answered = guidesIndex.guides.filter((guide: { hook?: unknown }) => guide.hook);
  assert.equal(answered.length, Object.keys(GUIDE_COVER_ANSWERS).filter(slug => guidesIndex.guides.some((guide: { slug: string }) => guide.slug === slug)).length);
  for (const guide of answered) assert.deepEqual(guide.hook, GUIDE_COVER_ANSWERS[guide.slug]);
  assert.doesNotMatch(readFileSync('src/components/GuidesHome.tsx', 'utf8'), /guide-editorial\/answers/);
});

test('DetailHero: always a picture in the 16:9 frame with its badge and credit line (UI9-IMAGES DECISIONS 21)', async () => {
  const event = { id: 'e', title: '中秋书法纸灯笼', startDate: '2026-10-25', endDate: '2026-10-25', city: 'Portola Valley', venueShort: 'Portola Valley 图书馆', category: 'culture', cost: 'free', audience: ['长者'], sessions: [{ date: '2026-10-25', start: '10:30', end: '11:30' }] };
  const stock = Object.keys(GUIDE_IMAGES).find(key => key.startsWith('stock-library-'))!;
  const cover = getCover({ kind: 'event', id: 'e', imageKeys: [stock] }, { images: GUIDE_IMAGES, today });
  assert.equal(cover.tier, 'stock');
  const view = wrap(<DetailHero record={{ item: { kind: 'event', event } } as never} cover={cover} today={today} ended={false} />);
  const figure = view.container.querySelector('figure.detail-hero')!;
  const root = figure.querySelector('[data-cover="image"]')!;
  assert.deepEqual(['data-ratio', 'data-ratio-lock', 'data-tier'].map(name => root.getAttribute(name)), ['16:9', '', 'stock']);
  const img = root.querySelector('img')!;
  assert.equal(img.getAttribute('loading'), 'eager', 'the LCP image');
  assert.equal(img.getAttribute('fetchpriority'), 'high');
  assert.equal(root.querySelector('[data-provenance]')?.textContent, '示意图');
  // G13 (captain 10-22 02:50): the badge says 示意图 once; the credit starts with the credit itself. C P08 / N25
  // (UI9-R2-DETAIL): it is plain text on the picture, not a line under it.
  const credit = root.querySelector('.detail-photo-credit')?.textContent ?? '';
  assert.match(credit, /^摄影 /);
  assert.doesNotMatch(credit, /示意图/);
  assert.equal(figure.querySelector('figcaption'), null);
  assert.equal(view.container.querySelector('[data-cover="type"],.tc-cal,.tc-ticket,.tc-sign'), null);
});

test('the cover sheet: no uppercase, nothing larger than the page H1, tokens only; a picture has at most two overlays and the 3D postcards keep their badge', () => {
  const css = readFileSync('src/components/ui/covers.css', 'utf8');
  assert.doesNotMatch(css, /text-transform:\s*uppercase/);
  assert.doesNotMatch(css, /letter-spacing:\s*[\d.]+(?:em|px)/, 'no letter-spaced caps (G6)');
  postcss.parse(css).walkDecls('font-size', declaration => assert.match(declaration.value, /^(?:var\(--(?:fs-(?:badge|meta|body|card|card-lg|section|title|label-thumb|label-tiny)|text-caption)\)|0)$/, `${(declaration.parent as postcss.Rule).selector}: ${declaration.value}`));
  const size = css.replace(/\r\n/g, '\n').length; // the content, not the checkout's line endings (a Windows clone has CRLF)
  assert.ok(size <= 8 * 1024, `covers.css ${size} B ≤ 8 KB (the information-card families are gone)`);
  assert.doesNotMatch(css, /ui-type-cover|\.tc-|@container tc/, 'no information-card rules');
  assert.doesNotMatch(css.replace(/\.ui-provenance \{[^}]*\}/, ''), /#[\da-f]{3,8}\b|\d+ms\b/i, 'no colour or duration literal');
  // A listing picture: the image and the chip, nothing else (the ♡ is the card's).
  const photo = { src: '/p.webp', alt: '', width: 1200, height: 900 };
  const view = wrap(<CoverImage image={photo} label="官方图" tier="official" kind="event" />);
  const cover = view.container.querySelector('[data-cover="image"]')!;
  assert.equal(cover.children.length, 2);
  assert.deepEqual(['data-family', 'data-kind', 'data-tier'].map(name => cover.getAttribute(name)), ['photo', 'event', 'official']);
  assert.equal(cover.querySelector('[data-chip]')?.textContent, '官方图');
  cleanup();
  const poster = wrap(<CoverImage image={photo} label="官方图" fit="contain" kind="event" />);
  assert.equal(poster.container.querySelectorAll('img').length, 1, 'the backdrop is CSS, not a second img');
  assert.equal(poster.container.querySelector('[data-cover]')?.getAttribute('data-family'), 'poster');
  cleanup();
  // A picture outside the listing feeds (no kind: /explore's attraction cards, a guide's or a detail page's title picture)
  // takes the same bottom-left chip since R2-03 (one label component at every size); only the 3D postcards keep their badge.
  const outside = wrap(<CoverImage image={photo} label="资料图 · 2024" />);
  assert.equal(outside.container.querySelector('[data-cover="image"]')?.hasAttribute('data-family'), false);
  assert.equal(outside.container.querySelector('[data-provenance]')?.hasAttribute('data-chip'), true);
  cleanup();
  // The 3D postcards: the same markup as before UI9-C (no family, no chip attribute) and the same badge rule.
  const postcard = wrap(<CoverImage image={{ ...photo, scene3d: true }} label="3D 场景插图" ratio="16:9" ratioLock kind="place" />);
  const card = postcard.container.querySelector('[data-cover="image"]')!;
  assert.equal(card.outerHTML.replace(/\s(?:src|srcset|sizes|alt|width|height|decoding|loading|style)="[^"]*"/g, ''),
    '<div class="ui-cover" data-cover="image" data-fit="cover" data-ratio="16:9" data-ratio-lock=""><img class="ui-cover__img"><span class="ui-provenance" data-provenance="true">3D 场景插图</span></div>');
  assert.match(css, /\.ui-provenance \{ position:absolute; top:8px; left:8px; z-index:1; max-width:calc\(100% - 56px\); overflow:hidden; padding:3px 8px; border-radius:var\(--r-sm\); background:var\(--color-badge-bg\); color:var\(--color-surface\); font-size:var\(--text-caption\); line-height:1\.385; font-weight:400; white-space:nowrap; text-overflow:ellipsis; pointer-events:none; \}/);
  postcss.parse(css).walkRules(rule => { if (rule.selector.includes('.ui-provenance') && rule.selector !== '.ui-provenance') assert.match(rule.selector, /\[data-chip\]/, `${rule.selector} excludes the 3D postcards`); });
});

test('review fixes: a poster sits whole on a blurred copy of itself in a full-bleed frame; the feed default is 3:2; every picture takes the chip; 简洁 rows drop the ♡; skeletons reserve the 3:2 cover', async () => {
  const late = { id: 'l', title: '夜市', startDate: '2026-10-24', endDate: '2026-10-24', city: 'Fremont', category: 'food', cost: 'free', audience: [], sessions: [{ date: '2026-10-24', start: '19:00', end: '01:00' }] };
  // The card's line prints the record's own close past midnight.
  assert.deepEqual(eventWhenLine(late as never, today), { zh: '周六 10/24 · 19:00–1:00', en: 'Sat, Oct 24 · 7pm–1am' });
  const sheet = readFileSync('src/components/ui/covers.css', 'utf8');
  // DECISIONS 32 OD1 (R2-01): one full-bleed frame — no mat, padding, white keyline or shadow; the flyer is contained (never
  // cropped) over a blurred copy of the decoded file (--ui-backdrop = its currentSrc, set once it has loaded).
  assert.doesNotMatch(sheet, /\.ui-cover\[data-fit=contain\] \{/, 'no board rule: the frame is the plain cover');
  assert.equal(postcssRule(sheet, '.ui-cover[data-fit=contain] .ui-cover__img'), 'object-fit:contain');
  assert.match(postcssRule(sheet, '.ui-cover[data-fit=contain]::before'), /^content:""; position:absolute; inset:-12%; background:var\(--ui-backdrop, none\) 50% 50% \/ cover no-repeat; filter:blur\(18px\)/);
  assert.equal(postcssRule(sheet, '.ui-cover[data-fit=contain][data-loaded]::before'), 'opacity:1');
  const flyer = wrap(<CoverImage image={{ src: '/f.webp', alt: '', width: 1200, height: 400 }} label="官方图" fit="contain" kind="event" />);
  const frame = flyer.container.querySelector<HTMLElement>('[data-cover="image"]')!;
  assert.equal(frame.hasAttribute('data-loaded'), false, 'no backdrop before the picture decodes');
  assert.equal(frame.hasAttribute('data-pending'), true, 'and its label waits (a client-mounted cover)');
  assert.equal(frame.style.getPropertyValue('--ui-backdrop'), '');
  const flyerImg = frame.querySelector('img')!;
  assert.equal(flyerImg.getAttribute('style'), null, 'a poster has no crop position');
  fireEvent.load(flyerImg);
  assert.equal(frame.hasAttribute('data-loaded'), true);
  assert.equal(frame.style.getPropertyValue('--ui-backdrop'), `url("${flyerImg.src}")`, 'the backdrop is the same file');
  cleanup();
  assert.match(sheet, /aspect-ratio:var\(--ui-feed-ratio, var\(--ui-cover-ratio, 3 \/ 2\)\)/, 'the feed default is 3:2 (decision 20)');
  const photo = { src: '/p.webp', alt: '', width: 1200, height: 900 };
  const thumb = wrap(<CoverImage image={photo} label="官方图 · 照片" />);
  assert.equal(thumb.container.querySelector('[data-provenance]')?.hasAttribute('data-chip'), true);
  cleanup();
  const postcardThumb = wrap(<CoverImage image={{ ...photo, scene3d: true }} label="3D 场景插图" sizes={COVER_SIZES.thumb} />);
  assert.equal(postcardThumb.container.querySelector('[data-provenance]')?.hasAttribute('data-chip'), false);
  cleanup();
  const rules = new Map<string, string>();
  postcss.parse(sheet).walkRules(rule => { if (rule.parent?.type === 'root') rules.set(rule.selector, rule.nodes.map(node => node.toString()).join('; ')); });
  assert.equal(rules.get('[data-simple] .ui-row-card__trailing:not(#saved *) :is(.ui-save,.planner-heart)'), 'display:none');
  assert.equal(rules.get('.ui-skeleton-card>[data-shape=cover]'), 'aspect-ratio:var(--ui-feed-ratio, var(--ui-cover-ratio, 3 / 2))');
  assert.ok(sheet.indexOf('.ui-skeleton-card>[data-shape=cover]') > sheet.indexOf('.ui-cover {'));
});
