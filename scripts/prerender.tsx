import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import '../src/i18n/router';
import '../src/i18n/metadata';
import { checkSiteTraditional, setLocale, translateText } from '../src/i18n/locale';
import { languagePath, languagePrefix, type SiteLanguage } from '../src/lib/language-path';
import { dirname, join, resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import React, { type ReactNode } from 'react';
import { guides } from '../src/data/guides';
import { quickFactsEligible } from '../src/features/guides/guide-kind';
import { ABOUT_METADATA } from '../src/lib/about-metadata';
import { ARCHIVE_METADATA } from '../src/lib/archive-metadata';
import { SLUG_TO_CATEGORY } from '../src/routing';
import { renderHtmlDocument, SITE_STRUCTURED_DATA, type PageMetadata } from '../src/lib/seo';
import { HUB_CARDS } from '../src/lib/hub-cards';
import { getGuideMetadata } from '../src/lib/guide-metadata';
import { GUIDES_METADATA } from '../src/lib/guides-metadata';
import { TOOLS_METADATA } from '../src/data/tool-catalog';
import { categoryHubMetadata, PRIVACY_METADATA, SMS_METADATA, TERMS_METADATA } from '../src/lib/hub-metadata';
import { CategoryHubPrerender, ToolsHubPrerender } from '../src/components/HubPrerender';
import NotificationTokenPage from '../src/pages/NotificationTokenPage';
import { EVENTS_METADATA, MONTHLY_METADATA } from '../src/lib/monthly-metadata';
import { matchRoute, PAGE_MODULES } from '../src/app/route-table';
import { EXPLORE_METADATA } from '../src/data/attractions';
import { allDetailRecords } from '../src/features/detail/build-detail';
import { detailBucket } from '../src/lib/english-loading';
import { generateSitemap } from './generate-sitemap';
import { discoveryShare } from '../src/data/local-discoveries';
import { getDiscoveryMetadata } from '../src/lib/discovery-metadata';
import guidesPublished from '../src/data/first-published/guides.json';
import listingsPublished from '../src/data/first-published/listings.json';
import { getBayAreaToday } from '../src/lib/monthly';

import { CALENDAR_METADATA } from '../src/lib/event-calendar';
import { PLAN_METADATA } from '../src/lib/planner';
import { OpusBayShell } from '../src/components/OpusBayShell';
import { opusBayHeadExtras, opusBayInHalloween, opusBayMetadata } from '../src/lib/opus-bay-metadata';

// The page chrome is the app's SiteChrome, which imports its own stylesheet (the build links it from the global CSS); the
// WEB-UI primitives' ui.css, the events column's events.css and the guide pages' guide-article.css / guide-library.css are
// bundled by Vite and linked per route below (RC-6). Node cannot load .css, so they load as empty modules here. Static
// imports load before this line runs, so the chrome and every page that imports CSS are imported after the hook, dynamically.
const cssAsEmptyModule = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { Shell } = await import('./prerender-shell');
const { MonthlyEdition } = await import('../src/components/MonthlyEdition');
const { EventsView } = await import('../src/components/EventsView');
const { default: CalendarPage } = await import('../src/pages/CalendarPage');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { GuidesHome } = await import('../src/components/GuidesHome');
const { LocalDiscoveryDetail } = await import('../src/components/LocalDiscoveryDetail');
// WEB-DATA-SPLIT: the deals board and the city directory are chunks the article loads with its record; load them before rendering.
const { preloadAllGuideBlocks } = await import('../src/features/guides/guide-blocks');
await preloadAllGuideBlocks();
// WEB-DATA-SPLIT: 繁體 pages render with the full opencc build; the browser's pruned phrase table must agree on every string.
const siteTraditionalMismatches = await checkSiteTraditional();
// The home sections render WEB-UI covers (ui.css), so the home is imported after the hook too (WEB-HOME).
const { HomeDiscovery } = await import('../src/components/HomeDiscovery');
// WEB-SECONDARY: these pages render the WEB-UI primitives (ui.css), so they load after the CSS hook as well.
const { TermsView } = await import('../src/components/TermsView');
const { PrivacyPolicyView } = await import('../src/components/PrivacyPolicyView');
const { SmsConsentView } = await import('../src/components/SmsConsentView');
const { AboutContent } = await import('../src/components/AboutContent');
const { default: ArchivePage } = await import('../src/pages/ArchivePage');
const { default: NotFoundPage } = await import('../src/pages/NotFoundPage');
const { AttractionExplorer } = await import('../src/components/AttractionExplorer');
const { default: AiLocalPage } = await import('../src/pages/AiLocalPage');
// WEB-PLAN: PlannerPage imports its own CSS (plan-page.css), so it loads after the CSS hook too.
const { default: PlannerPage } = await import('../src/pages/PlannerPage');
const { AccountShell } = await import('../src/components/AccountShell');
const { ACCOUNT_SHELL_FILE, withoutPageAddress } = await import('../src/app/account-shell');

// PRERENDER_OUT_DIR: QA renders a scratch build (vite build --outDir <dir>) without touching ./dist (W9-E)
const outputDir = resolve(process.env.PRERENDER_OUT_DIR || 'dist');
const template = await readFile(join(outputDir, 'index.html'), 'utf8');
const noop = () => {};
// Article datePublished: the day each guide, offer and opening first shipped (scripts/record-first-published.ts).
const GUIDES_PUBLISHED = guidesPublished as Record<string, string>, LISTINGS_PUBLISHED = listingsPublished as Record<string, string>;
const manifest = JSON.parse(await readFile(join(outputDir, '.vite/manifest.json'), 'utf8'));
// The page module comes from the route table (src/app/route-table.ts), as at boot (route-loaders.ts): /404 → NotFoundPage.
const routeModule = (path: string) => PAGE_MODULES[matchRoute(path)?.page || 'notFound'];
type ManifestChunk = { file: string; name?: string; isDynamicEntry?: boolean; imports?: string[]; css?: string[] };
/** A page that other chunks also import statically (NotFoundPage, rendered by the detail pages for a missing id) is emitted as
 * a shared chunk keyed `_Name-hash.js`, without its source path: find it by name so its stylesheets are linked too. */
const manifestEntry = (module: string): ManifestChunk | undefined => manifest[module] ?? (Object.values(manifest) as ManifestChunk[]).find(item => item.isDynamicEntry && item.name === module.split('/').pop()!.replace(/\.tsx?$/, ''));
/** WEB-DATA-SPLIT: an article also loads its own record chunk and, for a few guides, a block renderer (guide-store.ts). */
const guideModules = (path: string) => {
  const guide = guides.find(item => `/guides/${item.slug}` === path);
  if (!guide) return [];
  const uses = (type: string) => guide.blocks.some(block => block.type === type);
  // WEB-PERF-2 (for WEB-GUIDES-READ): the 3D link and the 30 秒看懂 card are block chunks too (guide-blocks.tsx blocksOf)
  const record = JSON.parse(readFileSync(`src/data/generated/guides/${guide.slug}.json`, 'utf8')) as { opus?: object; editorial?: object };
  return [`src/data/generated/guides/${guide.slug}.json`, ...(uses('freebies') ? ['src/components/FreebieBoard.tsx'] : []), ...(uses('city-exploration') ? ['src/components/CityExplorationDirectory.tsx'] : []),
    ...(record.opus ? ['src/features/guides/GuideOpusEntry.tsx'] : []), ...(quickFactsEligible(guide, !!record.editorial) ? ['src/features/guides/GuideQuickFacts.tsx'] : [])];
};
/** The page's static module graph: its JS files and every stylesheet the graph imports. */
const routeGraph = (path: string) => {
  const files = new Set<string>(); const styles = new Set<string>();
  const visit = (item: ManifestChunk) => { if (files.has(item.file)) return; files.add(item.file); for (const css of item.css || []) styles.add(css); for (const key of item.imports || []) if (manifest[key]) visit(manifest[key]); };
  const entry = manifestEntry(routeModule(path));
  if (entry) visit(entry);
  for (const key of guideModules(path)) if (manifest[key]) visit(manifest[key]);
  return { files: [...files], styles: [...styles] };
};
/** An event, offer or opening detail also preloads its generated record bucket (and, in English, its dictionary pack):
 * the page reads them before it replaces this HTML (WEB-DETAIL, ENGSEC-01; lib/english-loading.ts detailBucket). */
const DETAIL_KINDS = { events: 'event', offers: 'offer', openings: 'opening' } as const;
const detailChunks = (path: string, locale: SiteLanguage): string[] => {
  const match = /^\/(events|offers|openings)\/([^/]+)$/.exec(path);
  if (!match) return [];
  const bucket = detailBucket(DETAIL_KINDS[match[1] as keyof typeof DETAIL_KINDS], decodeURIComponent(match[2]));
  const keys = [`src/data/generated/details/bucket-${bucket}.json`, ...(locale === 'en' ? [`src/data/generated/english-scopes/detail-${bucket}.json`] : [])];
  return keys.map(key => manifest[key]?.file).filter((file): file is string => !!file);
};
/** UI9-IMG-A0: the info-card families load after the page (src/components/ui/CoverImage.tsx deferredFamily). A page whose HTML draws
 * one preloads its chunk, so the app's first render has it and never shows the empty frame. */
const FAMILY_MODULES: Readonly<Record<string, string>> = {
  date: 'src/components/ui/cover-date-face.tsx', ticket: 'src/components/ui/cover-ticket.tsx', shop: 'src/components/ui/cover-shop.tsx',
  headline: 'src/components/ui/cover-guide.tsx', number: 'src/components/ui/cover-guide.tsx',
};
const familyChunks = (body: string): string[] => [...new Set([...body.matchAll(/data-family="([a-z]+)"/g)].map(match => FAMILY_MODULES[match[1]]))]
  // The family's chunk and the chunks it imports (cover-frame.tsx's TypeFrame among them), so the frame never waits on a second trip.
  .flatMap(key => { const chunk: ManifestChunk | undefined = key ? manifest[key] : undefined; return chunk ? [chunk.file, ...(chunk.imports ?? []).map(dep => manifest[dep]?.file)] : []; })
  .filter((file): file is string => !!file);
const modulePreloads = (path: string, locale: SiteLanguage = 'zh-Hans', body = '') => [...new Set([...routeGraph(path).files, ...detailChunks(path, locale), ...familyChunks(body)])].map(file => `<link rel="modulepreload" href="/${file}" />`).join('\n');
/** RC-6: CSS that Vite splits out of the global bundle arrives with the page chunk, after first paint. Link it in the
 * prerendered head after the global stylesheet: the same cascade order as when the chunk appends it in the app. */
const withRouteStylesheets = (html: string, path: string) => {
  const links = routeGraph(path).styles.filter(file => !template.includes(`href="/${file}"`)).map(file => `<link rel="stylesheet" crossorigin href="/${file}">`).join('\n');
  const end = html.lastIndexOf('</head>');
  return links && end >= 0 ? `${html.slice(0, end)}${links}\n${html.slice(end)}` : html;
};

/** H60 (WEB-PERF-2): /events names its first pick's cover (the page's one fetchpriority="high" image, its LCP) in the head,
 * so a phone requests it with the stylesheets instead of after them. */
const LCP_PRELOAD_PATHS = new Set(['/events']);
const lcpImagePreload = (body: string): string => {
  const img = /<img\b[^>]*\bfetchpriority="high"[^>]*>/.exec(body)?.[0];
  const attr = (name: string) => img && new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(img)?.[1];
  const src = attr('src'), srcset = attr('srcSet'), sizes = attr('sizes');
  return src ? `<link rel="preload" as="image" href="${src}"${srcset ? ` imagesrcset="${srcset}"` : ''}${sizes ? ` imagesizes="${sizes}"` : ''} fetchpriority="high" />\n` : '';
};

// CW-02 stale-date guard (src/lib/date-guard.ts): every page names the Pacific day it was built for; reading-init.js compares.
const builtFor = getBayAreaToday();
const renderPage = async (metadata: PageMetadata, content: ReactNode, filename?: string) => {
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as SiteLanguage[]) {
    await setLocale(locale, false);
    const path = languagePath(metadata.path, locale);
    const body = renderToStaticMarkup(<StaticRouter basename={languagePrefix(locale) || undefined} location={path}><Shell path={metadata.path}>{content}</Shell></StaticRouter>);
    const relative = filename || (metadata.path === '/' ? 'index.html' : `${metadata.path.slice(1)}.html`);
    const destination = join(outputDir, languagePrefix(locale).slice(1), relative);
    if (!destination.startsWith(outputDir + '/') && !destination.startsWith(outputDir + '\\')) throw new Error('Invalid prerender destination');
    await mkdir(dirname(destination), { recursive: true });
    const html = withRouteStylesheets(renderHtmlDocument(template, { ...metadata, path }, body).replace(/<html lang="[^"]+"/, `<html lang="${locale}" data-built-for="${builtFor}"`).replace('<!--baylink-meta-end-->', () => (LCP_PRELOAD_PATHS.has(metadata.path) ? lcpImagePreload(body) : '') + modulePreloads(metadata.path, locale, body) + '\n<!--baylink-meta-end-->'), metadata.path);
    await writeFile(destination, html);
  }
  await setLocale('zh-Hans', false);
};

const homeDescription = '湾区活动、免费福利与实用生活指南，附官方来源和核对日期。搜索下一步，或向 BayBay 提问。';
await renderPage({ title: 'BAYLINK｜湾区去哪、怎么办——有来源的中文答案', description: homeDescription, path: '/', image: HUB_CARDS.home, imageAlt: '这个周末，湾区去哪？BAYLINK 本周末精选', english: { imageAlt: 'Where to go in the Bay Area this weekend: BAYLINK picks' }, structuredData: SITE_STRUCTURED_DATA }, (
  // The same wrapper as HomePage renders, so the app's first render replaces the prerendered <main> box for box: the hero
  // image keeps its size and place, and the browser records no second, later LCP for it (PROD-W3 perf: /en 7.8 s).
  <div className="bay-home bay-home-editorial">
    <HomeDiscovery onAskBayBay={noop} onBrowseCommunity={noop} />
  </div>
));

await renderPage(GUIDES_METADATA, <GuidesHome onOpenGuide={noop} />);
await renderPage(MONTHLY_METADATA, <MonthlyEdition defaultDateFilter="all" />);
// 活动 (/events, 本周末 first). /this-week is a 301 to it on the host and in the app, so it has no page of its own.
await renderPage(EVENTS_METADATA, <EventsView />);
await renderPage(CALENDAR_METADATA, <CalendarPage />);
await renderPage(EXPLORE_METADATA, <AttractionExplorer />);
await renderPage(PLAN_METADATA, <PlannerPage />);
// W9-E (review 2026-10-01 R§5 #3): /opus-bay is its own page, no longer the homepage's HTML — its own title, description,
// canonical, hreflang and share card (the key art's 1200 × 630 crop), and a static first paint that looks like the game's
// title (OpusBayShell; App.tsx shows the same markup until the game's route chunk is in), with the same script / css tags.
const buildDate = new Date();
const opusBayDocument = (metadata: PageMetadata): string =>
  renderHtmlDocument(template, metadata, renderToStaticMarkup(<OpusBayShell halloween={opusBayInHalloween(buildDate)} />))
    .replace('<!--baylink-meta-end-->', () => `${opusBayHeadExtras(metadata.path.startsWith('/en/') ? 'en_US' : metadata.path.startsWith('/zh-Hant/') ? 'zh_TW' : 'zh_CN')}\n    <!--baylink-meta-end-->`);
await writeFile(join(outputDir, 'opus-bay.html'), opusBayDocument(opusBayMetadata(buildDate)));
for (const locale of ['en', 'zh-Hant'] as const) {
  await setLocale(locale, false); await mkdir(join(outputDir, locale), { recursive: true });
  const gameMetadata = opusBayMetadata(buildDate, locale === 'en' ? 'en' : 'zh');
  const metadata = { ...gameMetadata, title: translateText(gameMetadata.title, locale), description: translateText(gameMetadata.description, locale), imageAlt: translateText(gameMetadata.imageAlt || gameMetadata.title, locale), path: languagePath('/opus-bay', locale) };
  await writeFile(join(outputDir, locale, 'opus-bay.html'), opusBayDocument(metadata).replace(/<html lang="[^"]+"/, `<html lang="${locale}"`));
  await writeFile(join(outputDir, locale, 'play.html'), opusBayDocument(metadata).replace(/<html lang="[^"]+"/, `<html lang="${locale}"`));
}
await setLocale('zh-Hans', false);
// W9-E-switch: /play is the game now — its page is the game's shell with canonical /opus-bay (App.tsx's PlayRedirect sends
// the visitor on, keeping ?lang; an old weekend ticket goes to /plan); out of the sitemap
await writeFile(join(outputDir, 'play.html'), opusBayDocument(opusBayMetadata(buildDate)));
await renderPage({title:'湾区 AI 现场｜BAYLINK',description:'AI Week SF 与 SF Tech Week 的真实场次、报名要求、费用与第一次参加的实用准备。',path:'/ai-in-the-bay',image:HUB_CARDS.events}, <AiLocalPage />);
await renderPage(ABOUT_METADATA, <AboutContent />);
await renderPage(ARCHIVE_METADATA, <ArchivePage />);
// Hub bodies render through src/components/HubPrerender.tsx: the site's JSX runtime localizes them (I18N-SEO-02).
await renderPage(TOOLS_METADATA, <ToolsHubPrerender />);
for (const guide of guides) {
  await renderPage(getGuideMetadata(guide, GUIDES_PUBLISHED[guide.slug]), <GuideDetail slug={guide.slug} onBack={noop} onOpenGuide={noop} onNavigate={noop} onOpenPost={noop} />);
}
// Event, offer and opening details render the same generated records the app loads (src/features/detail, ENGSEC-01).
// An offer's or opening's Article datePublished (first-published/listings.json) rides in the prerendered JSON-LD only — the
// app keeps that block while it shows the same page (seo.ts) — so their metadata is built here with the day (WEB-SEO-I18N);
// the record's own metadata is the same call without it.
for (const record of new Set(allDetailRecords().values())) {
  const { item } = record;
  const metadata = item.kind === 'event' ? record.metadata : getDiscoveryMetadata(item, LISTINGS_PUBLISHED[`${item.kind}:${discoveryShare(item).id}`]);
  await renderPage(metadata, <LocalDiscoveryDetail record={record} />);
}
for (const slug of Object.keys(SLUG_TO_CATEGORY)) await renderPage(categoryHubMetadata(slug), <CategoryHubPrerender slug={slug} />);
await renderPage(TERMS_METADATA, <TermsView />);
await renderPage(PRIVACY_METADATA, <PrivacyPolicyView />);
await renderPage(SMS_METADATA, <SmsConsentView />);
await renderPage({ title: '验证邮箱｜BAYLINK', description: '确认由本人发起的邮箱验证请求。', english: { title: 'Verify your email | BAYLINK', description: 'Confirm an email verification you asked for.' }, path: '/verify-email', noindex: true }, <NotificationTokenPage purpose="verify" />);
await renderPage({ title: '取消站外通知｜BAYLINK', description: '主动取消 BAYLINK 邮件或短信提醒。', english: { title: 'Turn off email or text notices | BAYLINK', description: 'Turn off BAYLINK email or text reminders.' }, path: '/notifications/unsubscribe', noindex: true }, <NotificationTokenPage purpose="unsubscribe" />);
// G70: /me, /messages, /my-week and /together open on this neutral shell, not the homepage (src/app/account-shell.ts):
// noindex, and no canonical, og:url or hreflang, as it stands for several private pages.
await renderPage({ title: 'BAYLINK', description: homeDescription, path: '/me', noindex: true }, <AccountShell />, ACCOUNT_SHELL_FILE);
for (const locale of ['', 'en', 'zh-Hant']) {
  const file = join(outputDir, locale, ACCOUNT_SHELL_FILE);
  await writeFile(file, withoutPageAddress(await readFile(file, 'utf8')));
}
await renderPage({ title: '页面不存在｜BAYLINK', description: '没有找到这个页面。请检查链接，或返回 BAYLINK 首页。', english: { title: 'Page not found | BAYLINK', description: 'We could not find this page. Check the link, or go back to the BAYLINK home page.' }, path: '/404', noindex: true }, <NotFoundPage />, '404.html');
// RC-6 for 404.html: NotFoundPage is a shared chunk found by name (manifestEntry). If that lookup ever misses, the page would
// paint without its stylesheet, so the build stops instead.
const notFoundStyles = routeGraph('/404').styles;
const notFoundHtml = await readFile(join(outputDir, '404.html'), 'utf8');
const unlinkedNotFoundStyles = notFoundStyles.filter(file => !notFoundHtml.includes(`href="/${file}"`));
if (!notFoundStyles.length || unlinkedNotFoundStyles.length) throw new Error(`prerender: 404.html must link NotFoundPage's stylesheets (${unlinkedNotFoundStyles.join(', ') || 'none found in the Vite manifest'})`);

const { paths: sitemapPaths, xml: sitemap } = generateSitemap();
await writeFile(join(outputDir, 'sitemap.xml'), sitemap);
cssAsEmptyModule.deregister();
const mismatched = siteTraditionalMismatches();
if (mismatched.length) throw new Error(`繁體: the browser's phrase table (src/data/generated/zh-hant-phrases.json) converts ${mismatched.length} prerendered strings differently from the full opencc build, e.g. ${mismatched.slice(0, 5).join(' | ')}`);
console.log(`Prerendered ${sitemapPaths.length + 1} public HTML pages and sitemap. No authenticated or live user data was fetched.`);
