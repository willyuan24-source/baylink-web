import { readdir, readFile } from 'node:fs/promises';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import { verifyStaticLinks } from './verify-static-links.mjs';
import { verifyPhoneLinks } from './verify-phone-links.mjs';
import { formatRouteBudgets, measureRouteBudgets, pageModuleKey } from './route-budgets.mjs';
import { tsImport } from 'tsx/esm/api';
import { checkLegacyUrls, LEGACY_URLS } from './hosting-routes.mjs';
// The route table (src/app/route-table.ts) names the prerendered pages to check (`release`) and each page's module.
const { ROUTES, PAGE_MODULES, matchRoute } = await tsImport('../src/app/route-table.ts', import.meta.url);
const RELEASE_PAGES=[...ROUTES.filter(route=>route.release).map(route=>route.path==='/'?'index':route.path.slice(1)),'events/san-francisco-fleet-week-2026'];

// Per-route JS budgets, KiB gzip: the shell plus the page's static module graph,
// plus opencc for zh-Hant and the route's English scopes for en. Ceilings are the
// 10/08 measurements + 2% and only ratchet down (plan §3.0 rule 8): lower a
// ceiling when a PR makes a route smaller; raising one needs the owner's approval.
// Home zh-Hans keeps the 200 KiB gate below. /events took over /this-week's row.
// /events and /calendar read the slim events index (WEB-EVENTS, RC-33). With the CNT-EVENTS overlay fields the index copies
// (shortTitle, dek, sessions, price, venueShort) and WEB-SHELL2's chrome, the integrated Wave-2 build measured /events
// 317.9 / 794.7 / 959.6 and /calendar 322.1 / 798.9 / 963.7 KiB; their ceilings are those numbers + 2% (from 993.8–1635.1).
// WEB-HOMEPREP (10/09) moved the community board, the search dictionaries and the schedule notes off the homepage
// (zh 218.4 → 167.9, English with dictionaries 357.8 → 307.4 KiB) and lowered the homepage gates to the plan's targets,
// 220 → 200 and 360 → 340, with the '/' row 20 KiB lower in every language: the rest is headroom for WEB-HOME (RC-17).
// Every other zh-Hant row lost the shell's copy of the search dictionaries (繁體 search uses the full opencc build), so
// those ceilings go down to the 10/09 measurement + 2% (e.g. /guides 1502.0 → 1532.1); the 简体 and English rows count
// the dictionaries on these searching pages and stay where they were.
// WEB-GUIDES removed the legacy guide CSS, index and reader bar: on the integrated Wave-2 build (with the CNT-EVENTS overlay)
// /guides measured 996.0 / 1472.7 / 2138.8 and the guide detail 1045.1 / 1521.8 / 1330.1 KiB, so /guides and the detail's
// zh-Hant / en rows go to measured + 2%; the detail's zh-Hans row (1066.0 at + 2%) stays at 1063.3.
// The event detail stopped importing the planner catalog and the guides corpus (W2 integration): it measured
// 548.5 / 1025.3 / 1190.1 KiB, so its ceilings go to measured + 5% (headroom for the content batches until WEB-DETAIL
// moves details to per-item data).
// WEB-DETAIL (ENGSEC-01): event, offer and opening details read one generated record bucket (features/detail) instead of
// importing every catalog, guide and image, and English details load their bucket's pack instead of the discovery and
// guide-index packs: 576.0 / 1076.6 / 1249.6 (main) → measured 220.4 / 697.1 / 342.4 + 2% (the bucket itself is a dynamic chunk,
// 6–22 KiB gzip, preloaded by the prerendered page).
// WEB-DATA-SPLIT (ENGSEC-01): /guides reads a slim generated index and an article loads only its own record (counted here
// as the row's `data`), so both guide rows went from ~1 MB to measured + 2% (/guides 224.7 / 266.9 / 357.4, the senior
// guide 232.8 / 275.0 / 346.4 KiB). 繁體 converts with the site's own opencc phrases (~45 KB) instead of the full 495 KB
// build, so every zh-Hant row dropped ~430 KiB: it is measured + 2%, except where a zh-Hans row keeps headroom for a lane
// in flight (home: WEB-HOME, RC-17), where it keeps the same headroom over its zh-Hans ceiling. English /events and /calendar
// load the events column's own pack (the slim index's text, 'events-list') instead of the discovery and guide-index packs:
// 959.2 / 963.3 → 524.8 / 529.0 KiB, so those two en rows are measured + 2% too.
// W3 integration: each cell keeps the lower of the lanes' ceilings; then every cell with more than 5% headroom on the
// integrated build (CNT-GUIDES + DETAIL + DATA-SPLIT + HOME + SEO-I18N + SECONDARY + PLAN + VISUAL-SYS) goes to measured + 5%.
// CNT-SUPPLY (10/12) slimmed the events index (no source label, cost line only on mixed-cost events, schedules without
// their source check): with its 50 new events /events measured 312.8 / 789.5 / 976.7 and /calendar 316.9 / 793.7 / 980.9,
// so their zh-Hans and zh-Hant rows go to measured + 2%; the English rows (≥ +2% already) stay.
// W4 integration: the lower of main's and CNT-SUPPLY's ceiling per cell (/calendar and /events zh-Hans take CNT-SUPPLY's).
// Then every cell with more than 5% headroom on the integrated build (+ CNT-SUPPLY, WEB-FRESH2, WEB-COMMUNITY, WEB-BB-UI-2)
// goes to measured + 5%. /plan zh-Hans and en are over their ceilings with CNT-SUPPLY's 50 events (not raised; see W4-INT).
// WEB-PLAN-DATA: /plan renders its header at once and loads a generated planner catalog (and, in English, that catalog's own
// pack) after its first paint, instead of importing every event record, every guide, the image registry and the planning,
// discovery and guide-index packs: 1132.5 / 1176.1 / 2043.2 → 270.3 / 313.9 / 372.3 KiB, so its ceilings go to measured + 5%.
// W5 integration (GUIDES-READ + LINK-2 + SEO-3 + VISUAL-2 + COMMUNITY-2 on #41): the cells verify-release says can come down
// go to measured + 2% on the integrated build: / zh-Hant and en, /guides, the senior guide en and the Fleet Week detail. /events, /calendar
// and /plan keep their ceilings (3.4–5.0% headroom) for the event batches in flight (CNT-SUPPLY-2; W4 note above).
// W5 integration restacked on CNT-SUPPLY-2 (#42, 56 events): /plan measured 271.1 / 314.9 / 372.5 KiB (CNT-SUPPLY-2 alone 272.1 /
// 315.9 / 374.0; its planner catalog loads after the first paint, so a batch adds ~0.2 KiB here), so /plan goes to measured + 2%.
// /events and /calendar hold with 0.4–3.0 KiB left (zh-Hans 315.2 / 315.6, 318.5 / 319.5): the next event batch needs WEB-PERF-2's
// split of the events list out of the route chunk first; these ceilings are not raised.
// WEB-PERF-2: /events and /calendar carry only the events of their first screens (events-index.json `near`: the build's week
// through 8–21 days after the build day, capped at 56 KiB gzip so a dense season shrinks the window instead of the budget);
// the rest loads on demand (events-later.json + its English pack). Measured 280.0 / 323.8 / 459.4 and 283.6 / 327.4 / 463.0
// KiB (from 315.2 / 359.0 / 523.0 and 318.4 / 362.3 / 526.3), so both rows go to measured + 2%. A batch of far-off events
// now adds nothing here; one inside the next three weeks shrinks the window rather than growing the route.
// W6 integration (CNT-GUIDES-2, WEB-FIX6, CNT-MEDIA-2): the events index keeps only the image fields listings read (CNT-MEDIA-2),
// so /events measured 277.6 / 321.6 / 459.4 and /calendar 281.3 / 325.3 / 463.0 KiB on the integrated build of 10-15; the four
// Chinese cells verify-release listed go to measured + 2%, the English cells keep theirs (unchanged measurement).
const ROUTE_JS_BUDGETS = [
  { route: '/', module: 'src/pages/HomePage.tsx', kib: { 'zh-Hans': 195.0, 'zh-Hant': 240.9, en: 321.1 } },
  { route: '/calendar', module: 'src/pages/CalendarPage.tsx', kib: { 'zh-Hans': 287.0, 'zh-Hant': 331.8, en: 472.3 } },
  { route: '/guides', module: 'src/pages/GuidesPage.tsx', kib: { 'zh-Hans': 221.0, 'zh-Hant': 265.5, en: 352.2 } },
  { route: '/guides/bay-area-chinese-senior-services-referral-guide', module: 'src/pages/GuideDetailPage.tsx', data: ['src/data/generated/guides/bay-area-chinese-senior-services-referral-guide.json'], kib: { 'zh-Hans': 231.0, 'zh-Hant': 276.7, en: 341.4 } },
  { route: '/events/san-francisco-fleet-week-2026', module: 'src/pages/LocalDiscoveryPage.tsx', kib: { 'zh-Hans': 218.0, 'zh-Hant': 262.5, en: 337.9 } },
  { route: '/events', module: 'src/pages/EventsPage.tsx', kib: { 'zh-Hans': 283.2, 'zh-Hant': 328.1, en: 468.6 } },
  // WEB-PLAN: /plan (行程) had no row; it measured 1104.7 / 1581.5 / 1972.1 KiB with the WEB-UI cards and covers, so measured + 2%.
  // WEB-PLAN-DATA: the planner catalog loads after the first paint (features/plan/plan-catalog.ts): measured + 5%.
  // WEB-PERF-3 (H20): the workspace is a chunk that loads with the catalog (features/plan/PlannerWorkspace.tsx); the route
  // is the header, this weekend's picks (a generated snapshot, not the home catalog) and the saved days: measured
  // 189.3 / 233.6 / 291.0 KiB on main 531f6434 (the ceilings were set at measured + 2% on the lane's first base).
  { route: '/plan', module: 'src/pages/PlannerPage.tsx', kib: { 'zh-Hans': 193.3, 'zh-Hant': 238.0, en: 296.8 } },
];
const manifest=JSON.parse(await readFile('dist/.vite/manifest.json','utf8'));
const files=new Set();
function visit(key) { const item=manifest[key]; if(!item) throw new Error(`Missing build module ${key}`); if(files.has(item.file))return;files.add(item.file);for(const dependency of item.imports||[]) visit(dependency); }
visit('index.html');
const initialFiles=[...files];
visit('src/pages/HomePage.tsx');
const homeFiles=[...files];
const bytes=await Promise.all([...files].map(async file=>({file,gzip:gzipSync(await readFile(`dist/${file}`)).length})));
const total=bytes.reduce((sum,item)=>sum+item.gzip,0);
const shell=bytes.filter(item=>initialFiles.includes(item.file)).reduce((sum,item)=>sum+item.gzip,0);
// A route graph budget includes the real homepage, not just a tiny loader that imports a large bundle.
if(total>200*1024) throw new Error(`Homepage JS exceeds 200 KiB gzip: ${(total/1024).toFixed(1)} KiB`);
for(const scope of ['ui','home']) visit(`src/data/generated/english-scopes/${scope}.json`);
const englishTotal=(await Promise.all([...files].map(async file=>gzipSync(await readFile(`dist/${file}`)).length))).reduce((sum,value)=>sum+value,0);
if(englishTotal>340*1024) throw new Error(`English homepage including dictionaries exceeds 340 KiB gzip: ${(englishTotal/1024).toFixed(1)} KiB`);
if(initialFiles.some(file=>file === manifest['src/data/generated/english.json']?.file)) throw new Error('Full English editorial dictionary entered the initial shell');
// WEB-HOMEPREP: the board, the search dictionaries and the schedule notes load when needed, never with the homepage.
for(const [key,what] of [['src/pages/CommunityBoard.tsx','The community board'],['src/i18n/search-dictionaries.ts','The search dictionaries']]) {
  if(!manifest[key]?.isDynamicEntry) throw new Error(`${what} (${key}) is no longer a chunk of its own`);
  if(homeFiles.includes(manifest[key].file)) throw new Error(`${what} (${key}) entered the homepage's static graph`);
}
const scheduleNotes=Object.values(JSON.parse(await readFile('src/data/generated/event-schedule-notes.json','utf8'))).filter(note=>note.length>=12).slice(0,5);
for(const file of homeFiles) { const source=await readFile(`dist/${file}`,'utf8'); if(scheduleNotes.some(note=>source.includes(note))) throw new Error(`The calendar's schedule notes entered the homepage's static graph: ${file}`); }
const routeBudgets=await measureRouteBudgets(ROUTE_JS_BUDGETS,{manifest});
console.log(`Per-route JS (gzip):
${formatRouteBudgets(routeBudgets)}`);
const overBudget=routeBudgets.filter(row=>row.over);
if(overBudget.length) throw new Error(`Route JS exceeds its budget: ${overBudget.map(row=>`${row.route} ${row.locale} ${row.kib.toFixed(1)} KiB > ${row.ceiling.toFixed(1)} KiB`).join('; ')}`);
/** Stylesheets of a page module's static graph (what the app appends when the route chunk loads). */
function routeStyles(key,seen=new Set(),styles=new Set()) { const item=manifest[key]; if(!item||seen.has(key)) return styles; seen.add(key); for(const css of item.css||[]) styles.add(css); for(const dependency of item.imports||[]) routeStyles(dependency,seen,styles); return styles; }
// RC-6 for a guide's block chunks (WEB-PERF-3): a sheet that loads with a block (the freebie board's, its jump link above
// the fold) is linked by every prerendered guide that renders the block (prerender guideModules), or the block paints
// unstyled until its chunk loads. And 行程's prerendered pages carry the workspace (its form): Node imports it up front
// (src/features/plan/plan-workspace-node.ts), and a prerender without it would ship /plan without the planner.
{
  const BLOCKS=[['src/components/FreebieBoard.tsx',/class="[^"]*\bbl-freebie-(?:board|jump)\b/],['src/components/CityExplorationDirectory.tsx',/class="[^"]*\bcity-exploration\b/],['src/features/guides/GuideQuickFacts.tsx',/class="[^"]*\bgd-keyfacts\b/],['src/features/guides/GuideOpusEntry.tsx',/class="[^"]*\bgd-opus\b/]];
  // A block module renamed or moved would leave its row checking nothing (routeStyles of a missing key is empty).
  for(const [key] of BLOCKS) if(!manifest[key]) throw new Error(`Block module ${key} is not in the build manifest: update BLOCKS in verify-release`);
  let checked=0;
  for(const locale of ['', 'en/', 'zh-Hant/']) for(const name of await readdir(`dist/${locale}guides`).catch(()=>[])) {
    if(!name.endsWith('.html')) continue;
    const path=`dist/${locale}guides/${name}`; const html=await readFile(path,'utf8');
    for(const [key,marker] of BLOCKS) if(marker.test(html)) for(const css of routeStyles(key)) { checked++; if(!html.includes(`href="/${css}"`)) throw new Error(`Block stylesheet /${css} (${key}) is not linked: ${path}`); }
  }
  if(!checked) throw new Error('No prerendered guide links a block stylesheet: the freebie board check found nothing to check');
  for(const locale of ['', 'en/', 'zh-Hant/']) { const path=`dist/${locale}plan.html`; if(!(await readFile(path,'utf8')).includes('class="planner-form"')) throw new Error(`行程's prerendered page has no workspace (planner-form): ${path}`); }
}
// H43 (WEB-PERF-3): the stylesheets the home page links before its first paint (the shell's, which every page links),
// brotli q11 as served: 58.2 KiB on 531f6434, 38.9 KiB after the dead-rule prune and the route moves; measured + 2%.
// UI9-F (tokens v2, the legacy aliases and the second toast deleted): 39.3 KiB measured on WEB-PERF-3, so the ceiling came
// down to 39.5; on main 58a9c05 with UI9-F (and its dead-CSS deletion) the home page measures 39.2 KiB.
// UI9-C (the cover families replace the TypeCover rules and the 21 drawing masks): 39.19 KiB measured, so the ceiling comes
// down to 39.2.
const RENDER_BLOCKING_CSS_BR_KIB=39.2;
for(const locale of ['', 'en/']) {
  const path=`dist/${locale}index.html`; const html=await readFile(path,'utf8');
  const sheets=[...new Set([...html.matchAll(/<link\b[^>]*>/g)].map(match=>match[0]).filter(tag=>/\brel="stylesheet"/.test(tag)&&!/\bmedia="print"/.test(tag)).map(tag=>/\bhref="\/([^"]+\.css)"/.exec(tag)?.[1]).filter(Boolean))];
  if(!sheets.length) throw new Error(`No render-blocking stylesheet found: ${path}`);
  const kib=(await Promise.all(sheets.map(async css=>brotliCompressSync(await readFile(`dist/${css}`),{params:{[zlibConstants.BROTLI_PARAM_QUALITY]:11}}).length))).reduce((sum,value)=>sum+value,0)/1024;
  console.log(`Render-blocking CSS on ${path}: ${kib.toFixed(1)} KiB brotli in ${sheets.length} sheets (ceiling ${RENDER_BLOCKING_CSS_BR_KIB} KiB)`);
  if(kib>RENDER_BLOCKING_CSS_BR_KIB) throw new Error(`Render-blocking CSS exceeds its budget: ${path} ${kib.toFixed(1)} KiB > ${RENDER_BLOCKING_CSS_BR_KIB} KiB brotli`);
}
for(const locale of ['', 'en/', 'zh-Hant/']) for(const page of RELEASE_PAGES) {
  const path=`dist/${locale}${page}.html`; const html=await readFile(path,'utf8');
  const route=matchRoute(page==='index'?'/':`/${page}`);
  // RC-6: a prerendered page links its route CSS, or <main> paints unstyled until the chunk loads.
  // A page chunk without a facade (PlannerPage) is found by name (pageModuleKey), so its stylesheets are checked too.
  if(!route?.bare) for(const css of routeStyles(pageModuleKey(manifest,PAGE_MODULES[route.page]))) if(!html.includes(`href="/${css}"`)) throw new Error(`Route stylesheet /${css} is not linked: ${path}`);
  // a page that asks not to be indexed (an ended event a month on, I18N-SEO-10) carries no language cluster
  const indexed=!/<meta name="robots" content="noindex/.test(html);
  if(!html.includes('rel="canonical"') || indexed && (!html.includes('hreflang="zh-Hans"') || !html.includes('hreflang="en"'))) throw new Error(`Missing language metadata: ${path}`);
  if(!html.includes('rel="modulepreload"')) throw new Error(`Missing route preload: ${path}`);
  if(page.startsWith('events/')&&!html.includes('"@type":"Event"')) throw new Error(`Wrong event schema: ${path}`);
  if(locale==='en/'&&!html.includes('<html lang="en"')) throw new Error(`Wrong document language: ${path}`);
  if((html.match(/property="og:image:alt"/g)||[]).length!==1) throw new Error(`Ambiguous social image description: ${path}`);
  if(locale==='en/'&&/[\u3400-\u9fff]/.test(html.match(/property="og:image:alt" content="([^"]*)"/)?.[1]||'')) throw new Error(`Untranslated social image description: ${path}`);
  if (page !== 'opus-bay') {
    // Article heroes can have their own header/footer. Check the outer page
    // navigation: the first header and the final footer surround the article.
    const header = html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)?.[1];
    const footer = [...html.matchAll(/<footer\b[^>]*>([\s\S]*?)<\/footer>/g)].at(-1)?.[1];
    if (!header || !footer) throw new Error(`Missing anonymous navigation shell: ${path}`);
    // WEB-SHELL2: the first paint is the app's own chrome (SiteChrome: header, footer, tab bar), not a separate static shell.
    if (!html.includes('class="site-topbar"') || !html.includes('class="site-footer"') || !html.includes('class="site-mobile-nav"')) throw new Error(`First paint is not the site chrome: ${path}`);
    const languageSwitch = header.match(/<details\b[^>]*data-lang-switch[^>]*>[\s\S]*?<\/details>/)?.[0] || '';
    if (['zh-Hans', 'zh-Hant', 'en'].some(lang => !new RegExp(`<button[^>]*lang="${lang}"`).test(languageSwitch)) || languageSwitch.includes('href=')) throw new Error(`Header language choices must be three <button>s, each with its own lang: ${path}`);
    for (const target of ['/about', '/archive', '/terms', '/privacy', '/sms-consent']) if (!footer.includes(`href="${locale ? `/${locale.slice(0, -1)}` : ''}${target}"`)) throw new Error(`Footer misses ${target}: ${path}`);
    if (!/<button[^>]*>(?:\u53cd\u9988|\u53cd\u994b|Feedback)<\/button>/.test(footer)) throw new Error(`Footer misses \u53cd\u9988: ${path}`);
    // RC-7: the language choices name each language in its own script (\u7b80\u4f53\u4e2d\u6587 \u00b7 \u7e41\u9ad4\u4e2d\u6587 \u00b7 English) and have no links, so
    // the /en and link-language checks below skip that one subtree (data-lang-switch).
    // The phone tab bar is first-paint navigation too: same checks as the header and the footer.
    const tabs = html.match(/<nav\b[^>]*class="site-mobile-nav"[^>]*>[\s\S]*?<\/nav>/)?.[0];
    if (!tabs) throw new Error(`Missing first-paint tab bar: ${path}`);
    const shell = [header.replace(languageSwitch, ''), footer, tabs];
    if (locale === 'en/' && shell.some(markup => /[\u3400-\u9fff]/.test(markup))) throw new Error(`Untranslated first-paint navigation: ${path}`);
    if (locale && shell.some(markup => [...markup.matchAll(/href="(\/[^"]*)"/g)].some(match => !match[1].startsWith(`/${locale.slice(0, -1)}`)))) throw new Error(`First-paint navigation loses its language: ${path}`);
  }
}
// PROD-W3 perf: the prerendered home opens <main> with HomePage's own wrapper, so the app's first render keeps the hero
// image's box (no late second LCP; tests/prod-w3-fixes checks the app side renders this wrapper).
for(const locale of ['', 'en/', 'zh-Hant/']) {
  const html=await readFile(`dist/${locale}index.html`,'utf8');
  if(!/<main\b[^>]*><div class="bay-home bay-home-editorial"><section class="home-discovery"/.test(html)) throw new Error(`The prerendered home is not wrapped as HomePage renders it: dist/${locale}index.html`);
}
// H60 (WEB-PERF-2): /events names its LCP cover (the page's one fetchpriority="high" image) in the head (scripts/prerender.tsx).
// A page that shows photo covers with none of them high priority is a regression of the lead card, not a pass.
for(const locale of ['', 'en/', 'zh-Hant/']) {
  const html=await readFile(`dist/${locale}events.html`,'utf8');
  const src=/<img\b[^>]*\bfetchpriority="high"[^>]*>/.exec(html)?.[0].match(/\ssrc="([^"]+)"/)?.[1];
  if(!src) {
    if(/<img\b[^>]*\bclass="ui-cover__img"/.test(html)) throw new Error(`No fetchpriority="high" cover on /events although it shows photo covers: dist/${locale}events.html`);
    console.log(`H60: dist/${locale}events.html shows no photo cover, so there is no cover to preload`);
    continue;
  }
  const head=html.slice(0,html.indexOf('</head>'));
  if(!head.includes(`<link rel="preload" as="image" href="${src}"`)) throw new Error(`The first pick's cover is not preloaded: dist/${locale}events.html`);
}
// WEB-SEO-I18N (I18N-SEO-02/-04): every built page, in each language. /en carries no Chinese and /zh-Hant no Simplified-only
// character outside markup that says so (translate="no", lang="zh…", the language switch), in the text and in the head;
// every JSON-LD block passes the schema check (scripts/structured-data-check.ts).
const { checkStructuredData, structuredDataOf } = await tsImport('./structured-data-check.ts', import.meta.url);
const { englishProblems, englishFormatProblems, englishTitleProblems, traditionalProblems, simplifiedOnlyCharacters } = await import('./i18n-html-check.mjs');
const { createRequire } = await import('node:module');
const { sep } = await import('node:path');
const openccDictionary = createRequire(import.meta.url);
const simplifiedOnly = simplifiedOnlyCharacters(openccDictionary('opencc-js/dict/STCharacters').default, openccDictionary('opencc-js/dict/TSCharacters').default);
const builtPages = (await readdir('dist', { recursive: true })).filter(file => file.endsWith('.html')).map(file => file.split(sep).join('/'));
const languageProblems = [], schemaProblems = [];
for (const file of builtPages) {
  const html = await readFile(`dist/${file}`, 'utf8');
  const language = /^en\//.test(file) ? 'en' : /^zh-Hant\//.test(file) ? 'zh-Hant' : 'zh-Hans';
  if (language === 'en') for (const problem of englishProblems(html)) languageProblems.push(`${file}: Chinese on /en: ${problem}`);
  // H41 / H46: US-style times and dates, and titles that fit a search result
  if (language === 'en') for (const problem of englishFormatProblems(html)) languageProblems.push(`${file}: 24-hour time or ISO date on /en: ${problem}`);
  if (language === 'en') for (const problem of englishTitleProblems(html)) languageProblems.push(`${file}: English <title> over 60: ${problem}`);
  if (language === 'zh-Hant') for (const problem of traditionalProblems(html, simplifiedOnly)) languageProblems.push(`${file}: Simplified on /zh-Hant: ${problem}`);
  const { blocks, problems } = structuredDataOf(html);
  schemaProblems.push(...problems.map(problem => `${file}: ${problem}`), ...checkStructuredData(blocks, { english: language === 'en', where: file }));
}
if (languageProblems.length) throw new Error(`Wrong-language text in built pages (${languageProblems.length}):\n${languageProblems.slice(0, 30).join('\n')}`);
if (schemaProblems.length) throw new Error(`Structured data problems (${schemaProblems.length}):\n${schemaProblems.slice(0, 30).join('\n')}`);
console.log(`Languages and structured data verified on ${builtPages.length} built pages.`);
// Legacy and shared URLs (QR codes, the 3D game, old shares) resolve on the host as the route table says, onto built pages.
const legacyProblems=checkLegacyUrls(JSON.parse(await readFile('vercel.json','utf8')).routes);
if(legacyProblems.length) throw new Error(`Legacy URLs: ${legacyProblems.join('; ')}`);
for(const item of LEGACY_URLS.filter(entry=>entry.page)) await readFile(`dist${item.page}`).catch(()=>{ throw new Error(`${item.url} is served by dist${item.page}, which the build did not write`); });
const release=JSON.parse(await readFile('dist/release.json','utf8'));if(!/^[a-f0-9]{40}$/.test(release.commit))throw new Error('Release commit missing');
await verifyStaticLinks();
// CW-01 (WEB-DETAIL): every phone number a prerendered page shows is tap-to-call, in all three languages.
const phoneFailures=await verifyPhoneLinks();
if(phoneFailures.length) throw new Error(`Phone numbers without a tel: link (CW-01) on ${phoneFailures.length} pages: ${phoneFailures.slice(0,12).map(item=>`${item.page} (${item.numbers.join(', ')})`).join('; ')}`);
console.log(`Release verified: shell ${(shell/1024).toFixed(1)} KiB, homepage route graph ${(total/1024).toFixed(1)} KiB; English homepage with dictionaries ${(englishTotal/1024).toFixed(1)} KiB gzip; ${routeBudgets.length} route × locale JS budgets hold; translated prerenders, route stylesheets and Event schema present; ${LEGACY_URLS.length} legacy URLs resolve.`);
