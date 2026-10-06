// W9-E part b · /opus-bay's own page (review 2026-10-01 R§5 #3): until now vercel.json sent /opus-bay to the homepage's
// prerendered index.html, so every visitor first saw (and could click) the BAYLINK homepage for 1–5 s, and every link
// preview showed the homepage's card with the app icon. Now scripts/prerender.tsx writes dist/opus-bay.html — its own
// title / description / canonical / hreflang / og + twitter card (the key art's 1200 × 630 crop) and a static first paint
// that looks like the title (src/components/OpusBayShell.tsx), which App.tsx keeps on screen until the game's route chunk
// is in. The browser proof (no homepage DOM at any speed) is in docs/opus-bay/sf-w9-E.md part b.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OpusBayShell } from '../src/components/OpusBayShell';
import { OPUS_BAY_ART, OPUS_BAY_OG, opusBayHeadExtras, opusBayInHalloween, opusBayMetadata, opusBayOgImage } from '../src/lib/opus-bay-metadata';
import { renderMetadataHtml } from '../src/lib/seo';
import { generateSitemap } from '../scripts/generate-sitemap';

test('W9-E shell: the static first paint is the title (key art, 湾区小旅 · Little Bay Trip, 准备中, a guides link) and nothing of the homepage', () => {
  for (const halloween of [false, true]) {
    const html = renderToStaticMarkup(createElement(OpusBayShell, { halloween }));
    const art = halloween ? OPUS_BAY_ART.halloween : OPUS_BAY_ART.key;
    for (const s of ['id="opus-bay-shell"', 'translate="no"', '湾区小旅', 'Little Bay Trip', '准备中', 'Loading', '小小湾区 · BAYLINK', 'href="/guides"', art.wide, art.tallSrcSet.split(' ')[0]]) assert.ok(html.includes(s), `${halloween}: ${s}`);
    for (const s of ['湾区的日常', 'home-discovery', 'site-sidebar', 'BayBay 聊聊', '<script', 'Opus Bay']) assert.ok(!html.includes(s), `${halloween}: no "${s}"`);
    // the CSS goes out raw (a <style> child is not HTML-escaped: no &gt; / &quot; that would break the rules)
    assert.doesNotMatch(html.match(/<style>([\s\S]*?)<\/style>/)![1], /&(?:gt|lt|quot|#39|amp);/, 'raw CSS');
  }
  const SHELL_CSS = renderToStaticMarkup(createElement(OpusBayShell, { halloween: false })).match(/<style>([\s\S]*?)<\/style>/)![1];
  assert.match(SHELL_CSS, /\.obs\{[^}]*position:fixed;inset:0/);
  assert.match(SHELL_CSS, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(SHELL_CSS, /@media \(max-width:820px\) and \(max-aspect-ratio:5\/4\)/, 'the portrait phone layout (the title\'s own rule)');
});

test('W9-E shell: the art is the title\'s own (src/opus-bay/data/assets.ts KEY_ART / KEY_ART_HALLOWEEN)', async () => {
  const { KEY_ART, KEY_ART_HALLOWEEN } = await import('../src/opus-bay/data/assets');
  for (const [mine, theirs] of [[OPUS_BAY_ART.key, KEY_ART], [OPUS_BAY_ART.halloween, KEY_ART_HALLOWEEN]] as const) {
    assert.equal(mine.wide, theirs.wide);
    assert.equal(mine.wideSrcSet, theirs.wideSrcSet);
    assert.equal(mine.tallSrcSet, theirs.tallSrcSet);
    for (const u of [mine.wide, ...mine.wideSrcSet.split(', ').map(x => x.split(' ')[0]), ...mine.tallSrcSet.split(', ').map(x => x.split(' ')[0])]) assert.ok(fs.existsSync(path.join('public', u)), u);
  }
});

test('W9-E shell: the Halloween dress follows the title\'s rule (titleInHalloween + keyArtFor), dates on the Bay\'s clock and the ?halloween= / ?world= previews', async () => {
  const { titleInHalloween } = await import('../src/opus-bay/data/assets');
  const dates = ['2026-09-30T23:59:00-07:00', '2026-10-01T00:00:00-07:00', '2026-10-01T06:30:00Z', '2026-10-31T23:30:00-07:00', '2026-11-01T06:30:00Z', '2026-11-01T08:00:00Z', '2026-12-25T12:00:00-08:00', '2027-10-15T12:00:00-07:00'];
  const searches = ['', '?halloween=1', '?halloween=night', '?halloween=season', '?halloween=muertos', '?halloween=off', '?halloween=0', '?halloween=maybe', '?lang=en&halloween=1'];
  for (const d of dates) for (const s of searches) assert.equal(opusBayInHalloween(new Date(d), s), titleInHalloween(new Date(d), s), `${d} ${s}`);
  assert.equal(opusBayInHalloween(new Date('2026-10-15T12:00:00-07:00'), '?world=district'), false, 'district mode keeps the plain art (keyArtFor)');
  assert.equal(opusBayInHalloween(new Date('2026-10-15T12:00:00-07:00'), '?world=district&halloween=1'), false);
  assert.equal(opusBayOgImage(new Date('2026-10-02T09:00:00-07:00')), 'https://www.baylink.us/opus-bay/og-halloween.jpg');
  assert.equal(opusBayOgImage(new Date('2026-11-02T09:00:00-08:00')), 'https://www.baylink.us/opus-bay/og-key.jpg');
});

/** width × height of a baseline or progressive JPEG (its SOF0 / SOF2 segment) */
function jpegSize(buf: Buffer): [number, number] | null {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (marker === 0xc0 || marker === 0xc2) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return null;
}

test('W9-E shell: the share card — own title / description / canonical / hreflang, a 1200 × 630 key-art crop under 150 KB, summary_large_image', () => {
  for (const f of [OPUS_BAY_OG.key, OPUS_BAY_OG.halloween]) {
    const buf = fs.readFileSync(path.join('public', f));
    assert.deepEqual(jpegSize(buf), [1200, 630], f);
    assert.ok(buf.length < 150_000, `${f}: ${buf.length} B`);
  }
  const head = renderMetadataHtml({ ...opusBayMetadata(new Date('2026-10-02T09:00:00-07:00')), locale: 'zh_CN' }) + opusBayHeadExtras();
  for (const s of ['<title>湾区小旅 · 跟 BAYBAY 逛旧金山｜BAYLINK</title>', '<link rel="canonical" href="https://www.baylink.us/opus-bay" />', 'content="https://www.baylink.us/opus-bay/og-halloween.jpg"',
    '<meta name="twitter:card" content="summary_large_image" />', '<meta property="og:url" content="https://www.baylink.us/opus-bay" />', '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:alt"']) assert.ok(head.includes(s), s);
  assert.ok(!head.includes('baylink-app-icon'), 'not the site icon');
  assert.ok(!head.includes('Opus Bay'), 'no user-visible "Opus Bay" (review §10.1)');
  // Each language now has its own prefixed page and canonical. The former ?lang alternates remain invalid.
  for (const [language, url] of [['zh-Hans', '/opus-bay'], ['zh-Hant', '/zh-Hant/opus-bay'], ['en', '/en/opus-bay'], ['x-default', '/opus-bay']]) {
    assert.ok(head.includes(`<link rel="alternate" hreflang="${language}" href="https://www.baylink.us${url}" data-baylink-language />`), language);
  }
  assert.doesNotMatch(head, /href="[^"]*\?lang=/, 'language alternates use their own canonical paths');
  for (const [locale, prefix, lang] of [['zh_CN', '', 'zh'], ['zh_TW', '/zh-Hant', 'zh'], ['en_US', '/en', 'en']] as const) {
    const edition = renderMetadataHtml({ ...opusBayMetadata(new Date('2026-10-02T09:00:00-07:00'), lang), locale }) + opusBayHeadExtras(locale);
    assert.equal((edition.match(/property="og:image:alt"/g) || []).length, 1, 'one unambiguous image description');
    assert.ok(!edition.includes(`<meta property="og:locale:alternate" content="${locale}"`), 'an edition does not list itself as an alternate');
    if (lang === 'en') assert.ok(edition.includes(OPUS_BAY_OG.alt.en), 'English share cards use English image descriptions');
    assert.ok(edition.includes(`<link rel="canonical" href="https://www.baylink.us${prefix}/opus-bay" />`), locale);
    assert.ok(edition.includes(`<meta property="og:url" content="https://www.baylink.us${prefix}/opus-bay" />`), locale);
    assert.ok(edition.includes(`<meta property="og:locale" content="${locale}" />`), locale);
  }
});

test('W9-E shell: the wiring — vercel.json serves /opus-bay.html (not the homepage), prerender writes it, App shows the same shell while the route chunk loads, OpusBayPage keeps the share image', () => {
  const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8')) as { routes: { src?: string; dest?: string; handle?: string }[] };
  const first = (p: string) => vercel.routes.find(r => r.src && r.dest && new RegExp(r.src).test(p));
  for (const p of ['/opus-bay', '/opus-bay/']) assert.equal(first(p)!.dest!.replace('$1', 'opus-bay'), '/opus-bay.html', p);
  assert.ok(!vercel.routes.some(r => r.dest === '/index.html' && r.src && new RegExp(r.src).test('/opus-bay')), 'no index.html fallback for /opus-bay any more');
  const prerender = fs.readFileSync('scripts/prerender.tsx', 'utf8');
  assert.match(prerender, /writeFile\(join\(outputDir, 'opus-bay\.html'\), opusBayDocument\(opusBayMetadata\(buildDate\)\)\)/);
  assert.match(prerender, /<OpusBayShell halloween=\{opusBayInHalloween\(buildDate\)\} \/>/);
  assert.match(prerender, /generateSitemap\(\)/, 'prerender uses the shared sitemap generator');
  assert.ok(generateSitemap().paths.includes('/opus-bay'), 'the generated sitemap lists it');
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  assert.match(app, /<Route path="\/opus-bay" element=\{<Suspense fallback=\{<OpusBayShell halloween=\{opusBayInHalloween\(new Date\(\), location\.search\)\} \/>\}><OpusBayPage \/><\/Suspense>\} \/>/);
  const page = fs.readFileSync('src/opus-bay/OpusBayPage.tsx', 'utf8');
  assert.equal((page.match(/image: /g) || []).length, 2, 'both worlds set the share image (the city: opusBayOgImage, the district: the plain crop)');
  assert.ok(fs.readFileSync('public/sitemap.xml', 'utf8').includes('<loc>https://www.baylink.us/opus-bay</loc>'));
});

test('W9-E names (sf-w9-lead.md §6, review §10.1): the game\'s title shows no "Opus Bay" — its eyebrow is 小小湾区 · BAYLINK / Little Bay · BAYLINK, as the static shell', () => {
  const src = fs.readFileSync('src/opus-bay/ui/TitleScreen.tsx', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  assert.doesNotMatch(src, /Opus Bay/i, 'no user-visible "Opus Bay" on the title');
  assert.match(src, /<span className="ob-title-mark">\{t\('小小湾区 · BAYLINK', 'Little Bay · BAYLINK'\)\}<\/span>/);
  assert.ok(renderToStaticMarkup(createElement(OpusBayShell, { halloween: false })).includes('小小湾区 · BAYLINK'), 'the shell says the same');
});
