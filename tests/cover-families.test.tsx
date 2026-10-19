// UI9-C: the cover system. Seven families chosen by content and fixed by the item id (src/lib/cover-family.ts), every type
// cover prints one fact from the record that is not the caption title (N19), the 6–24 h bar draws the record's own window
// (G20), the one card date/time line (eventWhenLine, G18 / N06), the one status map (N08), the guide hooks' lime phrases
// (G19), the detail hero and the cover sheet's rules (N02 / N22 / G6).
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
const { render, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { EventTypeCover, OfferTypeCover, OpeningTypeCover, GuideTypeCover, CoverImage, StatusChip, statusLook } = await import('../src/components/ui');
const { setLocale, translateText } = await import('../src/i18n/locale');
const { chooseCover } = await import('../src/lib/cover-family');
const { TOPIC_MARKS, topicMark } = await import('../src/components/ui/cover-guide');
const { eventTimeWindow, eventWhenLine } = await import('../src/lib/event-facts');
const { GUIDE_HOOK_HIGHLIGHTS, guideCardHook, hookHighlight, splitTitleHook } = await import('../src/lib/guide-hook-highlight');
const { splitGuideTitle } = await import('../src/features/guides/guide-facts');
const { guideTopicOf } = await import('../src/data/guide-topics');
const { GUIDE_COVER_ANSWERS } = await import('../src/data/guide-editorial/answers');
const { DetailHero } = await import('../src/features/detail/DetailHero');
const { LEGACY_STATUS_TONES } = await import('../src/components/ui/Badges');

afterEach(async () => { cleanup(); await act(async () => { await setLocale('zh-Hans', false); }); });
const wrap = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);
const today = '2026-10-19';
const typeCover = { tier: 'type', reason: 'no-image', label: { zh: 'BAYLINK 信息卡', en: 'Info card' } } as const;
type Locale = 'zh-Hans' | 'zh-Hant' | 'en';
const LOCALES: Locale[] = ['zh-Hans', 'zh-Hant', 'en'];
const eventsIndex = JSON.parse(readFileSync('src/data/generated/events-index.json', 'utf8'));
const guidesIndex = JSON.parse(readFileSync('src/data/generated/guides-index.json', 'utf8'));
const homeCatalog = JSON.parse(readFileSync('src/data/generated/home-catalog.json', 'utf8'));
const attributes = (root: Element | null) => root ? ['data-cover', 'data-family', 'data-kind', 'data-mark'].map(name => root.getAttribute(name)).join('|') : 'none';

test('the chooser: a photo or poster always wins, the type families follow the listing kind, and nothing depends on position', () => {
  const photo = { tier: 'official' as const, fit: 'cover' as const }, poster = { tier: 'photo' as const, fit: 'contain' as const }, type = { tier: 'type' as const };
  assert.equal(chooseCover('event', photo, { id: 'a', date: '10/17' }).family, 'photo');
  assert.equal(chooseCover('offer', poster, { id: 'a', value: '免费' }).family, 'poster');
  assert.deepEqual(chooseCover('event', type, { id: 'a', date: '周六 10/17', time: '11:00–16:00' }), { family: 'date', keyFact: '周六 10/17 · 11:00–16:00', mark: 'calendar' });
  assert.deepEqual(chooseCover('offer', type, { id: 'a', value: '免费' }), { family: 'ticket', keyFact: '免费', mark: 'ticket' });
  assert.deepEqual(chooseCover('opening', type, { id: 'a', sells: '拉面', opened: '10/11 开业' }), { family: 'shop', keyFact: '拉面 · 10/11 开业', mark: 'shopfront' });
  assert.deepEqual(chooseCover('guide', type, { id: 'a', hook: '先打 800-510-2020', phone: true, mark: topicMark('elders') }), { family: 'number', keyFact: '先打 800-510-2020', mark: 'plate' });
  assert.equal(chooseCover('guide', type, { id: 'a', hook: '押金：搬出后 21 天', mark: topicMark('housing') }).family, 'headline');
  // One mark per topic (G3): the item's own facts decide it, never its id's position or a neighbour.
  for (const [topic, mark] of Object.entries(TOPIC_MARKS)) for (const id of ['x', 'bay-area-commute-guide', 'yy']) {
    assert.equal(chooseCover('guide', type, { id, hook: 'h', mark: topicMark(topic) }).mark, mark);
  }
  assert.equal(chooseCover('guide', type, { id: 'x', hook: 'h' }).mark, 'slide');
});

test('the same item gets the same family and mark in zh-Hans, zh-Hant and en, and reordering a list changes nothing', async () => {
  const events = eventsIndex.events.slice(0, 24), offers = eventsIndex.offers.slice(0, 16), openings = eventsIndex.openings.slice(0, 12);
  const draw = (list: { events: typeof events; offers: typeof offers; openings: typeof openings }) => {
    const view = wrap(<>
      {list.events.map((event: { id: string }) => <div key={event.id} data-id={event.id}><EventTypeCover event={event as never} today={today} /></div>)}
      {list.offers.map((offer: { id: string }) => <div key={offer.id} data-id={offer.id}><OfferTypeCover offer={offer as never} today={today} /></div>)}
      {list.openings.map((shop: { id: string }) => <div key={shop.id} data-id={shop.id}><OpeningTypeCover opening={shop as never} today={today} /></div>)}
    </>);
    const found = Object.fromEntries([...view.container.querySelectorAll('[data-id]')].map(node => [node.getAttribute('data-id'), attributes(node.firstElementChild)]));
    cleanup();
    return found;
  };
  const results: Record<string, string>[] = [];
  for (const locale of LOCALES) {
    await act(async () => { await setLocale(locale, false); });
    results.push(draw({ events, offers, openings }));
    results.push(draw({ events: [...events].reverse(), offers: [...offers].reverse(), openings: [...openings].reverse() }));
  }
  for (const result of results.slice(1)) assert.deepEqual(result, results[0]);
});

test('every type cover built from events-index.json, guides-index.json and home-catalog.json prints a key fact that is not the caption title', async () => {
  for (const locale of ['zh-Hans', 'en'] as const) {
    await act(async () => { await setLocale(locale, false); });
    const failures: string[] = [];
    const check = (node: React.ReactNode, caption: string, id: string) => {
      const view = wrap(node);
      const root = view.container.querySelector('[data-cover="type"]');
      const key = root?.getAttribute('data-key')?.trim() ?? '';
      if (!key) failures.push(`${id}: empty key`);
      else if (caption && (key === caption.trim() || caption.includes(key) && key.length > 8)) failures.push(`${id}: key repeats the caption "${caption}"`);
      cleanup();
    };
    for (const event of eventsIndex.events.slice(0, 160)) check(<EventTypeCover event={event} today={today} />, translateText(event.title, locale), event.id);
    for (const offer of eventsIndex.offers.slice(0, 120)) check(<OfferTypeCover offer={offer} today={today} />, translateText(offer.title, locale), offer.id);
    for (const shop of eventsIndex.openings) check(<OpeningTypeCover opening={shop} today={today} />, shop.name, shop.id);
    for (const guide of [...guidesIndex.guides, ...homeCatalog.guides]) {
      const title = translateText(guide.title, locale);
      const { hook, hi, caption } = guideCardHook(guide, title, locale, (zh: string) => translateText(zh, locale));
      check(<GuideTypeCover slug={guide.slug} topic={guide.topic ?? guideTopicOf(guide)} topicLabel="topic" hook={hook} hi={hi} />, caption === undefined ? title : caption, guide.slug);
    }
    assert.deepEqual(failures, [], locale);
  }
});

test('the 6–24 h bar: only one day with one structured window, placed and sized by that window', () => {
  const base = { id: 'x', title: '讲座', startDate: '2026-10-24', endDate: '2026-10-24', occurrenceDates: undefined, city: 'Oakland', category: 'culture' as const, cost: 'free' as const, audience: [] };
  const one = { ...base, sessions: [{ date: '2026-10-24', start: '10:30', end: '11:30' }] };
  assert.deepEqual(eventTimeWindow(one, '2026-10-24'), { open: 630, close: 690 });
  const view = wrap(<EventTypeCover event={one} today={today} />);
  const bar = view.container.querySelector('.tc-bar') as HTMLElement;
  assert.ok(bar, 'a one-day event with a window draws the bar');
  assert.equal(bar.style.getPropertyValue('--tb-from'), '25.0%', '(10:30 − 6:00) / 18 h');
  assert.equal(bar.style.getPropertyValue('--tb-span'), '5.6%', '1 h / 18 h');
  assert.equal(view.container.querySelector('.tc-cal__time')?.textContent, '10:30–11:30');
  cleanup();
  for (const [name, event] of [
    ['no window', base],
    ['an open end', { ...base, sessions: [{ date: '2026-10-24', start: '10:30' }] }],
    ['two sessions', { ...base, sessions: [{ date: '2026-10-24', start: '10:00', end: '11:00' }, { date: '2026-10-24', start: '14:00', end: '15:00' }] }],
    ['a two-day run', { ...base, endDate: '2026-10-25', sessions: undefined }],
  ] as const) {
    const other = wrap(<EventTypeCover event={event as never} today={today} />);
    assert.equal(other.container.querySelector('.tc-bar'), null, name);
    cleanup();
  }
  const late = wrap(<EventTypeCover event={{ ...base, sessions: [{ date: '2026-10-24', start: '19:00', end: '01:00' }] }} today={today} />);
  const lateBar = late.container.querySelector('.tc-bar') as HTMLElement;
  assert.equal(lateBar.style.getPropertyValue('--tb-from'), '72.2%');
  assert.equal(lateBar.style.getPropertyValue('--tb-span'), '27.8%', 'past midnight runs to 24:00');
});

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
  // Answers that are a phone number print on the plate and carry no lime phrase.
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
  // The cover renders exactly one lime phrase.
  const view = wrap(<GuideTypeCover slug="california-tenant-deposit-rights-help-guide" topic="housing" topicLabel="住房" hook="押金：搬出后 21 天" hi="21 天" />);
  assert.deepEqual([...view.container.querySelectorAll('.tc-hook em')].map(node => node.textContent), ['21 天']);
});

test('answered guide cards carry their hook from the generator; /guides no longer imports answers.ts', () => {
  const answered = guidesIndex.guides.filter((guide: { hook?: unknown }) => guide.hook);
  assert.equal(answered.length, Object.keys(GUIDE_COVER_ANSWERS).filter(slug => guidesIndex.guides.some((guide: { slug: string }) => guide.slug === slug)).length);
  for (const guide of answered) assert.deepEqual(guide.hook, GUIDE_COVER_ANSWERS[guide.slug]);
  assert.doesNotMatch(readFileSync('src/components/GuidesHome.tsx', 'utf8'), /guide-editorial\/answers/);
  const titled = guidesIndex.guides.find((guide: { hook?: unknown; title: string }) => !guide.hook && /[：:]/.test(guide.title));
  const { hook, caption } = guideCardHook(titled, titled.title, 'zh-Hans', (zh: string) => zh);
  assert.equal(`${caption}${titled.title.slice(caption!.length, titled.title.length - hook.length)}${hook}`, titled.title, 'head on the caption, the rest on the cover');
});

test('DetailHero: with no photo the family cover fills the 16:9 frame, with the day, the time bar and the labels', async () => {
  const event = { id: 'e', title: '中秋书法纸灯笼', startDate: '2026-10-25', endDate: '2026-10-25', city: 'Portola Valley', venueShort: 'Portola Valley 图书馆', category: 'culture', cost: 'free', audience: ['长者'], sessions: [{ date: '2026-10-25', start: '10:30', end: '11:30' }] };
  const view = wrap(<DetailHero record={{ item: { kind: 'event', event } } as never} cover={typeCover} today={today} ended={false} />);
  const figure = view.container.querySelector('figure.detail-hero')!;
  assert.equal(figure.hasAttribute('data-compact'), false, 'no band');
  assert.equal(figure.hasAttribute('data-slim'), false);
  const root = figure.querySelector('[data-cover="type"]')!;
  assert.deepEqual(['data-family', 'data-ratio', 'data-ratio-lock'].map(name => root.getAttribute(name)), ['date', '16:9', '']);
  assert.equal(root.querySelector('.tc-cal__top')?.textContent, '周日');
  assert.equal(root.querySelector('.tc-cal__day')?.textContent, '10/25');
  assert.ok(root.querySelector('.tc-bar'), 'the time bar');
  assert.deepEqual([...root.querySelectorAll('.tc-bar__ticks span')].map(node => node.textContent), ['6', '12', '18', '24']);
  assert.equal(root.querySelector('[data-provenance]')?.textContent, 'BAYLINK 信息卡');
  cleanup();
  const offer = wrap(<DetailHero record={{ item: { kind: 'offer', offer: { id: 'o', brand: 'IKEA', title: '会员咖啡半价', endDate: '2026-10-26', availability: 'dated' } } } as never} cover={typeCover} today={today} ended={false} />);
  const ticket = offer.container.querySelector('[data-cover="type"]')!;
  assert.deepEqual([ticket.getAttribute('data-family'), ticket.querySelector('.tc-ticket__value')?.textContent, ticket.querySelector('.tc-ticket__stub')?.textContent], ['ticket', '半价', '10/26截止']);
  cleanup();
  const shop = wrap(<DetailHero record={{ item: { kind: 'opening', shop: { id: 's', name: 'Marufuku', city: 'Burlingame', status: 'open', openedOn: '2026-10-11', openingType: 'new-restaurant', category: '拉面' } } } as never} cover={typeCover} today={today} ended={false} />);
  assert.equal(shop.container.querySelector('.tc-sign')?.textContent, '拉面10/11 开业');
});

test('the cover sheet: no uppercase, nothing larger than the page H1, tokens only; a photo has at most two overlays and the 3D postcards keep their badge', () => {
  const css = readFileSync('src/components/ui/covers.css', 'utf8');
  assert.doesNotMatch(css, /text-transform:\s*uppercase/);
  assert.doesNotMatch(css, /letter-spacing:\s*[\d.]+(?:em|px)/, 'no letter-spaced caps (G6)');
  postcss.parse(css).walkDecls('font-size', declaration => assert.match(declaration.value, /^var\(--(?:fs-(?:badge|meta|body|card|card-lg|section|title)|text-caption)\)$/, `${(declaration.parent as postcss.Rule).selector}: ${declaration.value}`));
  assert.ok(css.length <= 15 * 1024, `covers.css ${css.length} B ≤ 15 KB`);
  assert.doesNotMatch(css.replace(/\.ui-provenance \{[^}]*\}/, ''), /#[\da-f]{3,8}\b|\d+ms\b/i, 'no colour or duration literal');
  // A listing photo: the image and the chip, nothing else (the ♡ is the card's).
  const photo = { src: '/p.webp', alt: '', width: 1200, height: 900 };
  const view = wrap(<CoverImage image={photo} label="官方图" kind="event" />);
  const cover = view.container.querySelector('[data-cover="image"]')!;
  assert.equal(cover.children.length, 2);
  assert.deepEqual(['data-family', 'data-kind', 'data-mark'].map(name => cover.getAttribute(name)), ['photo', 'event', 'focal']);
  assert.equal(cover.querySelector('[data-chip]')?.textContent, '官方图');
  cleanup();
  const poster = wrap(<CoverImage image={photo} label="官方图" fit="contain" kind="event" />);
  assert.equal(poster.container.querySelectorAll('img').length, 1, 'no blurred backdrop');
  assert.equal(poster.container.querySelector('[data-cover]')?.getAttribute('data-family'), 'poster');
  cleanup();
  // A picture outside the listing feeds (no kind: /explore, plan stops) keeps its badge as it was.
  const outside = wrap(<CoverImage image={photo} label="资料图 · 2024" />);
  assert.equal(outside.container.querySelector('[data-cover="image"]')?.hasAttribute('data-family'), false);
  assert.equal(outside.container.querySelector('[data-provenance]')?.hasAttribute('data-chip'), false);
  cleanup();
  // The 3D postcards: the same markup as before UI9-C (no family, no chip attribute) and the same badge rule.
  const postcard = wrap(<CoverImage image={{ ...photo, scene3d: true }} label="3D 场景插图" ratio="16:9" ratioLock kind="place" />);
  const card = postcard.container.querySelector('[data-cover="image"]')!;
  assert.equal(card.outerHTML.replace(/\s(?:src|srcset|sizes|alt|width|height|decoding|loading|style)="[^"]*"/g, ''),
    '<div class="ui-cover" data-cover="image" data-fit="cover" data-ratio="16:9" data-ratio-lock=""><img class="ui-cover__img"><span class="ui-provenance" data-provenance="true">3D 场景插图</span></div>');
  assert.match(css, /\.ui-provenance \{ position:absolute; top:8px; left:8px; z-index:1; max-width:calc\(100% - 56px\); overflow:hidden; padding:3px 8px; border-radius:var\(--r-sm\); background:var\(--color-badge-bg\); color:var\(--color-surface\); font-size:var\(--text-caption\); line-height:1\.385; font-weight:400; white-space:nowrap; text-overflow:ellipsis; pointer-events:none; \}/);
  postcss.parse(css).walkRules(rule => { if (rule.selector.includes('.ui-provenance') && rule.selector !== '.ui-provenance') assert.match(rule.selector, /\[data-chip\]/, `${rule.selector} excludes the 3D postcards`); });
});

test('a number plate prints the number on one line in every mode, and a thumbnail never prints it', () => {
  const view = wrap(<GuideTypeCover slug="bay-area-medicare-hicap-medi-cal-guide" topic="health" topicLabel="医疗保险" hook="免费 1-800-434-0222" />);
  const plate = view.container.querySelector('.tc-plate')!;
  assert.equal(plate.classList.contains('ui-plate'), true, 'the shared plate class');
  assert.equal(plate.querySelector('[data-phone]')?.textContent, '1‑800‑434‑0222', 'non-breaking hyphens');
  assert.equal(plate.textContent, '免费1‑800‑434‑0222');
  assert.match(readFileSync('src/components/ui/covers.css', 'utf8'), /\.tc-plate \[data-phone\] \{[^}]*white-space:nowrap/);
  cleanup();
  const thumb = wrap(<GuideTypeCover slug="bay-area-medicare-hicap-medi-cal-guide" topic="health" topicLabel="医疗保险" hook="免费 1-800-434-0222" size="mini" />);
  assert.doesNotMatch(thumb.container.textContent ?? '', /\d{3}/, 'a thumb never prints a phone number');
  assert.ok(thumb.container.querySelector('.tc-mark svg'), 'it shows the topic mark');
});

test('review fixes: the stated close past midnight, families after the page drawn in one pass in Node, legacy thumbnails, short thumbnail facts, terms on a value-less ticket, one-clause hooks', async () => {
  const late = { id: 'l', title: '夜市', startDate: '2026-10-24', endDate: '2026-10-24', city: 'Fremont', category: 'food', cost: 'free', audience: [], sessions: [{ date: '2026-10-24', start: '19:00', end: '01:00' }] };
  // The card's line prints the record's own close; only the bar runs to 24:00.
  assert.deepEqual(eventWhenLine(late as never, today), { zh: '周六 10/24 · 19:00–1:00', en: 'Sat, Oct 24 · 7pm–1am' });
  assert.deepEqual(eventTimeWindow(late as never, '2026-10-24'), { open: 1140, close: 1440 });
  // A label-only legacy thumbnail (a plan stop, a saved place) prints its words, never an empty tile.
  const { TypeCover } = await import('../src/components/ui');
  const legacy = wrap(<TypeCover tone="outdoors" label="景点" size="mini" />);
  assert.equal(legacy.container.querySelector('.tc-thumb')?.textContent, '景点');
  cleanup();
  // A BayBay guide card's legacy cover prints the title after its colon, not the caption's title.
  const baybay = wrap(<TypeCover tone="culture" label="指南" title="湾区新手第一个月：先办这 3 件事" />);
  assert.equal(baybay.container.querySelector('.tc-hook')?.textContent, '先办这 3 件事');
  cleanup();
  // A date thumbnail without a time prints a short venue, else the city (never a long venue that clips at 特大).
  const noTime = { ...late, sessions: undefined, venueShort: 'Library / Parks and Recreation Center' };
  const thumb = wrap(<EventTypeCover event={noTime as never} today={today} days={['2026-10-24']} size="mini" />);
  assert.equal(thumb.container.querySelector('.tc-thumb')?.textContent, translateText('Fremont', 'zh-Hans'));
  cleanup();
  const shortVenue = wrap(<EventTypeCover event={{ ...noTime, venueShort: 'SFMOMA' } as never} today={today} days={['2026-10-24']} size="mini" />);
  assert.equal(shortVenue.container.querySelector('.tc-thumb')?.textContent, 'SFMOMA');
  cleanup();
  // The families a page draws after its first screen render in one pass in Node, so the prerendered HTML carries them.
  const { DeferredGuideTypeCover, DeferredOfferCover } = await import('../src/components/ui/cover-defer');
  const guide = wrap(<DeferredGuideTypeCover slug="california-tenant-deposit-rights-help-guide" topic="housing" topicLabel="住房" hook="押金：搬出后 21 天" />);
  assert.equal(guide.container.querySelector('[data-cover="type"]')?.getAttribute('data-family'), 'headline');
  assert.equal(guide.container.querySelector('.tc-hook em')?.textContent, '21 天');
  cleanup();
  // An offer without a stated value leads with what it asks of you; the stub keeps the deadline day.
  const terms = wrap(<DeferredOfferCover offer={{ id: 'o', brand: 'IKEA', title: '会员咖啡', kind: 'purchase', endDate: '2026-10-26', availability: 'dated' } as never} cover={typeCover as never} today={today} />);
  const ticket = terms.container.querySelector('[data-cover="type"]')!;
  assert.deepEqual([ticket.getAttribute('data-family'), ticket.querySelector('.tc-ticket__value')?.textContent, ticket.querySelector('.tc-ticket__stub')?.textContent], ['ticket', '需消费', '10/26截止']);
  cleanup();
  // A hook that is one clause gets no lime phrase rather than a lime hook from end to end.
  assert.equal(hookHighlight('合租前先讲清楚这些事'), '');
  const plain = wrap(<GuideTypeCover slug="x" topic="housing" topicLabel="住房" hook="合租前先讲清楚这些事" />);
  assert.equal(plain.container.querySelector('.tc-hook em'), null);
  assert.equal(plain.container.querySelector('.tc-hook')?.textContent, '合租前先讲清楚这些事');
  cleanup();
  // A poster keeps its own shape on the board: the image is sized by max-width / max-height, so the mat is even.
  const sheet = readFileSync('src/components/ui/covers.css', 'utf8');
  assert.match(sheet, /\.ui-cover\[data-fit=contain\] \.ui-cover__img \{[^}]*width:auto; height:auto; max-width:100%; max-height:100%/);
  assert.match(sheet, /aspect-ratio:var\(--ui-feed-ratio, var\(--ui-cover-ratio, 3 \/ 2\)\)/, 'the feed default is 3:2 (decision 20)');
});
