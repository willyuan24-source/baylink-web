import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { listSources, measureStyle } from '../scripts/check-style-ratchet.mjs';
import { getCover, type CoverAsset, type ImageCover } from '../src/lib/cover';

// UI9-R1-BUTTONS (cold review round 1 follow-ups 25, 27, 28, 29): one family of buttons (the ratchet's buttonLooks ≤ 6),
// one selected look and one navigation-current look, the cover badge's short words decoupled from `sizes`, and the
// Medi‑Cal title kept whole. The signed-in pages are not visible to a guest capture, so their buttons are proven here
// from the CSS itself, rule by rule, as the ratchet reads them.
const read = (file: string) => readFileSync(file, 'utf8');
const decls = (file: string, selector: string, media = '') => {
  const found: Record<string, string> = {};
  postcss.parse(read(file)).walkRules(rule => {
    const at = rule.parent?.type === 'atrule' ? (rule.parent as postcss.AtRule).params : '';
    if (rule.selector === selector && at === media) rule.walkDecls(declaration => { found[declaration.prop] = declaration.value; });
  });
  return found;
};

const PRIMARY = 'var(--color-brand) | var(--color-surface) | var(--color-brand)';
const SECONDARY = 'var(--color-surface) | var(--color-ink) | 1px solid var(--color-line-control)';
// Counted by the ratchet but not one of this lane's buttons: the guide article's "next step" panel is a <section> whose
// class ends in -cta, and the /explore outing stop arrows live in attractions.css (UI9-R1-POLISH-2's file this round).
const KNOWN_OTHERS = new Set(['var(--color-surface-2) | var(--color-ink) | -', 'var(--color-surface) | var(--color-ink-2) | 1px solid var(--color-line-control)']);

test('follow-up 28: every button look the ratchet counts is primary or secondary (≤ 6 site-wide, was 26)', () => {
  const sources = (listSources(process.cwd(), { extensions: /\.css$/ }) as string[]).map(file => ({ file, text: read(file) }));
  const { kinds } = measureStyle(sources) as { kinds: { button: Map<string, string> } };
  const looks = [...kinds.button.keys()];
  assert.ok(looks.length <= 6, looks.join('\n'));
  assert.ok(looks.includes(PRIMARY) && looks.includes(SECONDARY), looks.join('\n'));
  for (const look of looks) assert.ok(look === PRIMARY || look === SECONDARY || KNOWN_OTHERS.has(look), `${look} at ${kinds.button.get(look)}`);
  assert.ok(JSON.parse(read('scripts/style-ratchet.baseline.json')).counts.buttonLooks <= 6, 'the committed baseline holds the new count');
});

test('follow-up 28: the signed-in buttons are the two looks, rule by rule (bookings, feedback, sign-in, profile, messages, together, import)', () => {
  const look = (file: string, selector: string) => { const d = decls(file, selector); return `${d.background ?? d['background-color']} | ${d.color} | ${d['border-color'] ?? d.border}`; };
  for (const [file, selector] of [
    ['src/features/bookings/bookings.css', '.booking-primary'],
    ['src/features/feedback/feedback.css', '.feedback-primary'],
    ['src/features/feedback/feedback.css', '.feedback-tester-button'],
    ['src/features/member-ui.css', '.member-primary'],
    ['src/styles/event-import.css', '.event-primary'],
    ['src/design.css', '.bay-button-dark'],
  ]) assert.equal(look(file, selector).replace(/!important/, ''), PRIMARY, `${file} ${selector}`);
  for (const [file, selector] of [
    ['src/features/bookings/bookings.css', '.booking-secondary,.booking-quick-draft button'],
    ['src/features/bookings/bookings.css', '.booking-times button'],
    ['src/features/member-ui.css', '.member-secondary'],
    ['src/features/outings/outings.css', '.together-page .outing-secondary'],
    ['src/features/profile/privacy-security.css', '.account-privacy button'],
    ['src/features/profile/profile-personality.css', '.profile-phone-verification>button'],
    ['src/features/profile/profile-personality.css', '.profile-social-intents button'],
    ['src/features/profile/profile-personality.css', '.profile-writing-prompts button'],
    ['src/styles/modern-messaging.css', '.modern-chat-welcome button'],
    ['src/styles/modern-messaging.css', '.modern-chat-reactions button'],
    ['src/components/site-chrome.css', '.site-boot-retry button'],
  ]) assert.equal(look(file, selector), SECONDARY, `${file} ${selector}`);
  // The rendered look is the same: a jsdom page with the sheets resolves one primary and one secondary fill.
  const dom = new JSDOM(`<!doctype html><style>${read('src/features/bookings/bookings.css')}${read('src/features/member-ui.css')}</style>
    <button class="booking-primary">预约</button><button class="member-primary">发布</button><button class="booking-secondary">草稿</button><button class="member-secondary">取消</button>`);
  const fill = (selector: string) => dom.window.getComputedStyle(dom.window.document.querySelector(selector)!).backgroundColor;
  assert.equal(fill('.booking-primary'), fill('.member-primary'));
  assert.equal(fill('.booking-secondary'), fill('.member-secondary'));
  // An open ⋯ menu is a state of its button (as :hover), not a look of its own.
  assert.match(read('src/styles/modern-messaging.css'), /\.modern-chat-message-actions button:is\(\[aria-expanded=true\]\)\{/);
});

test('follow-up 29: one selected look — the selected pair with its edge — on chips, segments, tabs, menu rows and the chosen day', () => {
  const SELECTED = { 'border-color': 'var(--selected-line)', background: 'var(--selected-bg)', color: 'var(--selected-fg)' };
  const pick = (d: Record<string, string>) => ({ 'border-color': d['border-color'], background: d.background, color: d.color });
  assert.deepEqual(pick(decls('src/components/ui/ui.css', '.ui-chip[aria-pressed=true],.ui-chip[aria-checked=true],.ui-chip[aria-current]')), SELECTED);
  assert.deepEqual(pick(decls('src/components/ui/ui.css', '.ui-icon-button[aria-pressed=true]')), SELECTED);
  assert.deepEqual(pick(decls('src/components/ui/cards.css', '.ui-segmented__item[aria-checked=true]')), SELECTED);
  assert.deepEqual(pick(decls('src/features/events/events.css', '.ev-tabs .ui-tabs__item[aria-current]')), SELECTED);
  assert.deepEqual(pick(decls('src/features/events/events.css', ':is(.ev-week__day,.ev-month__day)[aria-pressed=true]')), SELECTED);
  assert.deepEqual(pick(decls('src/components/site-chrome.css', '.site-app :is(.site-secondary-nav a[aria-current=page],:is(.site-language-menu,.site-language-options)>button[aria-pressed=true])')), SELECTED);
  // The checked 列表 | 地图 segment is the segment primitive exactly (no transparent-edge override).
  assert.deepEqual(decls('src/features/events/events.css', '.ev-calendar__mode .ui-segmented__item[aria-checked=true]'), { 'font-weight': '400' });
  // Choosing moves nothing: tabs, menu rows and day cells carry the 1px edge at rest, in transparent.
  assert.equal(decls('src/features/events/events.css', '.ev-tabs .ui-tabs__item').border, '1px solid transparent');
  assert.equal(decls('src/features/events/events.css', '.ev-week__day,.ev-month__day').border, '1px solid transparent');
  assert.equal(decls('src/components/site-chrome.css', '.site-app .site-language-menu>button').border, '1px solid transparent');
  assert.equal(decls('src/components/site-chrome.css', '.site-app .site-language-options>button').border, '1px solid transparent', 'the phone ••• language row too (UI9-R2)');
  assert.equal(decls('src/components/site-chrome.css', '.site-app .site-secondary-nav>:is(a,button),.site-app .site-navigation-account button').border, '1px solid transparent');
  // The chosen day's date circle no longer draws a second fill inside the cell; its words and dot turn white.
  assert.equal(decls('src/features/events/events.css', '.ev-week__day[aria-pressed=true] .ev-week__date,.ev-month__day[aria-pressed=true] .ev-month__num')['border-color'], 'transparent');
  assert.equal(decls('src/features/events/events.css', '.ev-week__day[aria-pressed=true] .ev-week__dot[data-on]').background, 'var(--selected-fg)');
  // Navigation current is ink words (the nav's underline is its ::after); the breadcrumb's current page too.
  assert.equal(decls('src/components/ui/ui.css', '.ui-page-header__crumbs [aria-current=page]').color, 'var(--role-ink)');
  // The signed-in chip-like on states take the same pair; no brand-tint "selected" fill is left on them.
  for (const [file, selector] of [
    ['src/features/bookings/bookings.css', '.booking-times button[aria-pressed=true]'],
    ['src/features/profile/me-hub.css', '.me-language button[aria-pressed=true]'],
    ['src/features/outings/outing-cover.css', '.outing-cover-modes>button[aria-pressed=true]'],
    ['src/features/profile/profile-personality.css', '.profile-social-intents button[aria-pressed=true]'],
    ['src/features/profile/profile-personal-space.css', '.profile-preference-chips button[aria-pressed=true]'],
    ['src/features/source-monitor/source-monitor-admin.css', '.source-monitor button[aria-pressed=true]'],
    ['src/styles/modern-messaging.css', '.modern-chat-reactions button[aria-pressed=true]'],
  ]) assert.deepEqual(pick(decls(file, selector)), SELECTED, `${file} ${selector}`);
});

test('follow-up 27: the short English badge is its own prop, so a wide slot can ask for a wide file and keep "Stock photo"', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage });
  const { setLocale, loadLocale } = await import('../src/i18n/locale');
  const { Cover } = await import('../src/components/ui/CoverImage');
  const { COVER_SIZES } = await import('../src/components/ui/cover-sizes');
  await loadLocale('en');
  await setLocale('en', false);
  const asset: CoverAsset = { src: '/guides/test/stock.webp', srcSet: '/guides/test/stock-480.webp 480w, /guides/test/stock-800.webp 800w', alt: 'alt', caption: '示意', credit: 'A Photographer · Unsplash',
    licenseUrl: 'https://unsplash.com/license', kind: 'photo', width: 1200, height: 800, subject: 'category', rights: { basis: 'stock' } } as CoverAsset;
  const cover = getCover({ kind: 'event', id: 'g', imageKey: 'stock' }, { images: { stock: asset }, today: '2026-10-22' }) as ImageCover;
  assert.equal(cover.tier, 'stock');
  const BAND = '(max-width: 1023px) 88px, 365px';
  // R2-03: the label carries both words and the picture's own width picks (covers.css ≤ 200 px draws data-short).
  const shown = (node: React.ReactElement) => { const html = JSDOM.fragment(renderToStaticMarkup(node)); const badge = html.querySelector('.ui-provenance')!; return { sizes: html.querySelector('img')!.getAttribute('sizes'), badge: badge.textContent, short: badge.getAttribute('data-short') }; };
  assert.deepEqual(shown(<Cover cover={cover} sizes={BAND} short decorative />), { sizes: BAND, badge: 'Illustrative photo', short: 'Stock photo' });
  assert.deepEqual(shown(<Cover cover={cover} sizes={COVER_SIZES.thumb} decorative />), { sizes: '88px', badge: 'Illustrative photo', short: 'Stock photo' });
  assert.deepEqual(shown(<Cover cover={cover} sizes={COVER_SIZES.feed} decorative />), { sizes: COVER_SIZES.feed, badge: 'Illustrative photo', short: 'Stock photo' });
  await setLocale('zh-Hans', false);
  // The /guides band passes its own sizes: 365 px cards at 大 / 特大 ask for ≥ 730 w on a 2x screen (the 800 w file).
  const home = read('src/components/GuidesHome.tsx');
  assert.match(home, /const BAND_SIZES = '\(max-width: 1023px\) 88px, 365px';/);
  assert.match(home, /className: 'gl-band__rows', sizes: BAND_SIZES \}/);
  assert.match(read('src/features/guides/GuideCover.tsx'), /short=\{mini\}/);
});

test('follow-up 25: the HICAP guide title keeps Medi‑Cal whole (U+2011) in both languages', () => {
  assert.match(read('src/data/guides-public-services.ts'), /title: '在湾区弄清 Medicare、Medi‑Cal：先找免费 HICAP 咨询',/);
  const en = JSON.parse(read('src/data/guides-public-services-en.json')) as Record<string, string>;
  assert.equal(en['在湾区弄清 Medicare、Medi‑Cal：先找免费 HICAP 咨询'], 'Understanding Medicare and Medi‑Cal in the Bay Area: start with free HICAP counseling');
});

test('follow-up 30: card-press.ts names Card.tsx as its only importer', () => {
  assert.match(read('src/components/ui/card-press.ts'), /a side-effect module that Card\.tsx imports dynamically/);
  assert.doesNotMatch(read('src/components/ui/card-press.ts'), /HeroCard/);
});
