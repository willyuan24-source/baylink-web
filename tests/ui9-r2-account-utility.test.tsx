// UI9-R2-ACCOUNT-UTILITY (cold review round 2, R2-15 + N01 / N04 / N06 / N09 / N14 / N16, and NAV PR B per DECISIONS 41):
// the /me and /together photo band (approved ③ records, label and credit), /my-week's picture strip, gutter, meta glue and
// Select, /tools' list, /about's columns, the 404 side card, and the spacing / type / disabled rules of the lane's sheets.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import postcss, { type AtRule } from 'postcss';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://www.baylink.us/me', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element,
  Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup } = await import('@testing-library/react');
const { AccountBand } = await import('../src/components/AccountBand');
const { BAND_PHOTOS } = await import('../src/lib/account-band-photos');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

const read = (file: string) => readFileSync(file, 'utf8');
const STEPS = new Set([4, 8, 12, 16, 24, 32, 48, 64, 96]);
const SPACING = /^(?:padding|margin|gap|row-gap|column-gap)(?:-[a-z-]+)?$/;
/** Every padding / margin / gap length outside var() in px (rem x 16), as code-measure.mjs (UI9-P4 r2) counts N14. */
const spacingLengths = (file: string) => {
  const out: Array<{ px: number; where: string }> = [];
  postcss.parse(read(file)).walkDecls(decl => {
    if (!SPACING.test(decl.prop)) return;
    let rest = decl.value, before; do { before = rest; rest = rest.replace(/var\([^()]*\)/g, ''); } while (rest !== before);
    for (const match of rest.matchAll(/(?<![\w.-])-?(\d*\.?\d+)(px|rem)\b/g)) out.push({ px: Number(match[1]) * (match[2] === 'px' ? 1 : 16), where: `${(decl.parent as { selector?: string }).selector} { ${decl.prop}: ${decl.value} }` });
  });
  return out;
};
const rule = (file: string, selector: string, media = '') => {
  let props: Record<string, string> | undefined;
  postcss.parse(read(file)).walkRules(found => {
    const at = found.parent?.type === 'atrule' ? (found.parent as AtRule).params : '';
    if (found.selector === selector && at === media) { props = {}; found.walkDecls(decl => { props![decl.prop] = decl.value; }); }
  });
  assert.ok(props, `${file}: ${selector} ${media}`);
  return props!;
};

test('R2-15: the band photos are approved ③ records, copied field for field, with the image ladder\'s rungs as their srcset', () => {
  const registry = new Map((JSON.parse(read('src/data/category-stock-photos.json')) as Array<Record<string, unknown>>).map(record => [record.key, record]));
  for (const photo of Object.values(BAND_PHOTOS)) {
    const record = registry.get(photo.key);
    assert.ok(record, `${photo.key} is in the approved category stock library (UI9-IMG-B1b), so no new download`);
    for (const field of ['src', 'width', 'height', 'alt', 'credit', 'creditUrl', 'licenseUrl'] as const) assert.equal(photo[field], record[field], `${photo.key}.${field}`);
    assert.equal((record.rights as { basis: string }).basis, 'stock');
    // The srcset names exactly the files the ladder wrote (480 / 800 / 1200; the original only when there is no 1200).
    const base = photo.src.replace(/\.webp$/, '');
    const rungs: string[] = [];
    if (existsSync(`public${base}-small.webp`)) rungs.push(`${base}-small.webp 480w`);
    if (existsSync(`public${base}-800.webp`)) rungs.push(`${base}-800.webp 800w`);
    if (existsSync(`public${base}-1200.webp`)) rungs.push(`${base}-1200.webp 1200w`);
    else rungs.push(`${photo.src} ${photo.width}w`);
    assert.equal(photo.srcSet, rungs.join(', '), photo.key);
    for (const candidate of photo.srcSet.split(', ')) assert.ok(existsSync(`public${candidate.split(' ')[0]}`), candidate);
  }
});

test('R2-15: the band shows its ③ label on the picture and its credit under it, in three languages', async () => {
  for (const [locale, label, licence] of [['zh-Hans', '示意图', '许可'], ['zh-Hant', '示意圖', '許可'], ['en', 'Illustrative photo', 'License']] as const) {
    await setLocale(locale, false);
    const view = render(<AccountBand photo={BAND_PHOTOS.together} />);
    const figure = view.container.querySelector('figure.account-band')!;
    const cover = figure.querySelector('.ui-cover.account-band__picture[data-tier=stock]')!;
    assert.ok(cover, 'a ③ tier cover');
    assert.equal(cover.querySelector('.ui-provenance')?.textContent, label, 'the one label on the picture (DECISIONS 23)');
    assert.equal(cover.querySelector('img')?.getAttribute('alt'), '', 'decorative: the H1 names the page');
    assert.equal(cover.querySelector('img')?.getAttribute('loading'), 'lazy');
    const links = [...figure.querySelectorAll('figcaption a')];
    assert.equal(links[0].getAttribute('href'), BAND_PHOTOS.together.creditUrl);
    assert.match(links[0].textContent ?? '', /Gray Clary \/ Unsplash/);
    assert.equal(links[1].getAttribute('href'), 'https://unsplash.com/license');
    assert.equal(links[1].textContent, licence);
    assert.doesNotMatch(figure.querySelector('figcaption')?.textContent ?? '', / · /, 'no " · " in the credit row, so no line starts with one (N06)');
    cleanup();
  }
  assert.match(read('src/features/profile/ProfileView.tsx'), /<AccountBand photo=\{BAND_PHOTOS\.me\} \/>[\s\S]*<AccountBand photo=\{BAND_PHOTOS\.me\} \/>/, '/me signed in and signed out');
  assert.match(read('src/features/outings/OutingsHub.tsx'), /<AccountBand photo=\{BAND_PHOTOS\.together\}/);
  assert.equal(rule('src/components/account-band.css', '.account-band>.account-band__picture.ui-cover')['aspect-ratio'], '3 / 1');
  assert.equal(rule('src/components/account-band.css', '.account-band>.account-band__picture.ui-cover', '(min-width:768px)')['aspect-ratio'], '6 / 1');
});

test('N14 / N01 / N09: the tools sheets and the screenshot import sit on the spacing steps, read the type tokens and never fade a disabled control', () => {
  for (const file of ['src/components/tools/tools.css', 'src/components/tools/unit-price.css', 'src/components/tools/dining-calculator.css', 'src/components/tools/loan-calculator.css', 'src/styles/event-import.css']) {
    const off = spacingLengths(file).filter(length => length.px !== 0 && !STEPS.has(Math.abs(length.px)));
    assert.deepEqual(off, [], `${file}: spacing off the 4 8 12 16 24 32 48 64 96 steps`);
  }
  postcss.parse(read('src/styles/event-import.css')).walkDecls('font-size', decl => assert.match(decl.value, /^var\(--(?:text|fs-keep)-[\w-]+\)$/, `event-import.css: ${decl.value}`));
  for (const file of ['src/styles/event-import.css', 'src/features/profile/me-hub.css', 'src/features/saves/my-week.css', 'src/pages/together-page.css', 'src/components/account-band.css', 'src/components/tools/tools.css', 'src/components/about-baylink.css', 'src/components/not-found.css']) {
    postcss.parse(read(file)).walkRules(found => { if (/:disabled/.test(found.selector)) found.walkDecls('opacity', decl => assert.fail(`${file}: ${found.selector} { opacity:${decl.value} }`)); });
  }
  for (const file of ['src/components/ContactCardMessage.tsx', 'src/components/OfficialVerificationModal.tsx']) assert.doesNotMatch(read(file), /disabled:opacity-/, file);
  // N04: the tools list's line under each name is the 14px fact step.
  assert.equal(rule('src/components/tools/tools.css', '.tools-picker-text small')['font-size'], 'var(--text-fact)');
});

test('/tools: one grouped list on phones and tablets, each tool a row with its 40px icon beside its two lines', () => {
  const list = rule('src/components/tools/tools.css', '.tools-picker ul');
  assert.equal(list['grid-template-columns'], 'minmax(0,1fr)');
  assert.equal(list.border, '1px solid var(--color-line)');
  assert.equal(rule('src/components/tools/tools.css', '.tools-picker-item')['flex-direction'], 'row');
  assert.equal(rule('src/components/tools/tools.css', '.tools-picker-icon').width, '2.5rem');
  assert.equal(rule('src/components/tools/tools.css', '.tools-picker ul', '(min-width:1024px)').border, '0', 'the desktop side list has no card');
});

test('/my-week: picture strip on an empty 行程, the 24px gutter, meta separators glued, the ui Select', () => {
  const page = read('src/pages/MyWeekPage.tsx');
  assert.match(page, /const thisWeek = upcoming\.slice\(0, 6\);\n {2}const suggested = nextPlans\.length \? \[\] : upcoming\.slice\(6, 10\);/, 'the strip shows the four after the list\'s six: no event twice');
  assert.match(page, /<SuggestedEvents events=\{suggested\}/);
  assert.match(page, /<FeedGrid label=/);
  // N06: every " · " in a meta line is glued to the word before it (U+00A0), so a wrapped line never starts with "·".
  assert.match(page, /const joinMeta = \(parts: string\[\]\) => parts\.filter\(Boolean\)\.join\(' · '\)\.replace\(\/ · \/g, '\\u00a0· '\);/);
  assert.match(page, /meta=\{joinMeta\(\[/);
  assert.match(page, /<Select value=\{preferences\.travelMode\}/);
  assert.doesNotMatch(page, /<select\b/, 'no platform select (N13)');
  assert.equal(rule('src/features/saves/my-week.css', '.my-week__list', '(min-width:1024px)')['column-gap'], 'var(--grid-gutter)', 'N16: the one 24px gutter');
});

test('/about spans the frame below the head on a desktop; the 404 has its side card', () => {
  const about = read('src/components/AboutContent.tsx');
  assert.match(about, /<ol className="about-list" data-columns="2">/);
  assert.match(about, /<ul className="about-list" data-columns="3">/);
  assert.ok(about.includes('id="about-method-title"'), 'the one 我们怎么核对 anchor stays (DECISIONS 10)');
  const desktop = '(min-width:1024px)';
  assert.equal(rule('src/components/about-baylink.css', '.about-main', desktop)['grid-column'], '1 / -1');
  assert.equal(rule('src/components/about-baylink.css', '.about-head', desktop)['grid-column'], '1 / span 8');
  // Side headings: the H2 and the section's notes in columns 1-3, the rows in 4-12.
  assert.equal(rule('src/components/about-baylink.css', '.about-main>.about-section>*', desktop)['grid-column'], '1 / span 3');
  assert.equal(rule('src/components/about-baylink.css', '.about-main>.about-section>:is(.about-list,.about-labels,.about-images-more)', desktop)['grid-column'], '4 / -1');
  assert.equal(rule('src/components/not-found.css', '.nf-help', desktop)['grid-column'], '9 / span 4');
  assert.match(read('src/pages/NotFoundPage.tsx'), /<aside className="nf-help" aria-labelledby="nf-help-title">/);
});
