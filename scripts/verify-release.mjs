import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { verifyStaticLinks } from './verify-static-links.mjs';
import { formatRouteBudgets, measureRouteBudgets } from './route-budgets.mjs';
import { tsImport } from 'tsx/esm/api';
import { checkLegacyUrls, LEGACY_URLS } from './hosting-routes.mjs';
// The route table (src/app/route-table.ts) names the prerendered pages to check (`release`) and each page's module.
const { ROUTES, PAGE_MODULES, matchRoute } = await tsImport('../src/app/route-table.ts', import.meta.url);
const RELEASE_PAGES=[...ROUTES.filter(route=>route.release).map(route=>route.path==='/'?'index':route.path.slice(1)),'events/san-francisco-fleet-week-2026'];

// Per-route JS budgets, KiB gzip: the shell plus the page's static module graph,
// plus opencc for zh-Hant and the route's English scopes for en. Ceilings are the
// 10/08 measurements + 2% and only ratchet down (plan §3.0 rule 8): lower a
// ceiling when a PR makes a route smaller; raising one needs the owner's approval.
// Home zh-Hans keeps the 220 KiB gate below. /events took over /this-week's row (same ceilings).
const ROUTE_JS_BUDGETS = [
  { route: '/', module: 'src/pages/HomePage.tsx', kib: { 'zh-Hans': 220.0, 'zh-Hant': 731.6, en: 365.3 } },
  { route: '/calendar', module: 'src/pages/CalendarPage.tsx', kib: { 'zh-Hans': 993.9, 'zh-Hant': 1504.5, en: 1635.1 } },
  { route: '/guides', module: 'src/pages/GuidesPage.tsx', kib: { 'zh-Hans': 1036.4, 'zh-Hant': 1547.0, en: 2207.3 } },
  { route: '/guides/bay-area-chinese-senior-services-referral-guide', module: 'src/pages/GuideDetailPage.tsx', kib: { 'zh-Hans': 1063.3, 'zh-Hant': 1573.9, en: 1361.3 } },
  { route: '/events/san-francisco-fleet-week-2026', module: 'src/pages/LocalDiscoveryPage.tsx', kib: { 'zh-Hans': 1023.3, 'zh-Hant': 1533.8, en: 1664.4 } },
  { route: '/events', module: 'src/pages/EventsPage.tsx', kib: { 'zh-Hans': 993.8, 'zh-Hant': 1504.3, en: 1634.9 } },
];
const manifest=JSON.parse(await readFile('dist/.vite/manifest.json','utf8'));
const files=new Set();
function visit(key) { const item=manifest[key]; if(!item) throw new Error(`Missing build module ${key}`); if(files.has(item.file))return;files.add(item.file);for(const dependency of item.imports||[]) visit(dependency); }
visit('index.html');
const initialFiles=[...files];
visit('src/pages/HomePage.tsx');
const bytes=await Promise.all([...files].map(async file=>({file,gzip:gzipSync(await readFile(`dist/${file}`)).length})));
const total=bytes.reduce((sum,item)=>sum+item.gzip,0);
const shell=bytes.filter(item=>initialFiles.includes(item.file)).reduce((sum,item)=>sum+item.gzip,0);
// A route graph budget includes the real homepage, not just a tiny loader that imports a large bundle.
if(total>220*1024) throw new Error(`Homepage JS exceeds 220 KiB gzip: ${(total/1024).toFixed(1)} KiB`);
for(const scope of ['ui','home']) visit(`src/data/generated/english-scopes/${scope}.json`);
const englishTotal=(await Promise.all([...files].map(async file=>gzipSync(await readFile(`dist/${file}`)).length))).reduce((sum,value)=>sum+value,0);
if(englishTotal>360*1024) throw new Error(`English homepage including dictionaries exceeds 360 KiB gzip: ${(englishTotal/1024).toFixed(1)} KiB`);
if(initialFiles.some(file=>file === manifest['src/data/generated/english.json']?.file)) throw new Error('Full English editorial dictionary entered the initial shell');
const routeBudgets=await measureRouteBudgets(ROUTE_JS_BUDGETS,{manifest});
console.log(`Per-route JS (gzip):
${formatRouteBudgets(routeBudgets)}`);
const overBudget=routeBudgets.filter(row=>row.over);
if(overBudget.length) throw new Error(`Route JS exceeds its budget: ${overBudget.map(row=>`${row.route} ${row.locale} ${row.kib.toFixed(1)} KiB > ${row.ceiling.toFixed(1)} KiB`).join('; ')}`);
/** Stylesheets of a page module's static graph (what the app appends when the route chunk loads). */
function routeStyles(key,seen=new Set(),styles=new Set()) { const item=manifest[key]; if(!item||seen.has(key)) return styles; seen.add(key); for(const css of item.css||[]) styles.add(css); for(const dependency of item.imports||[]) routeStyles(dependency,seen,styles); return styles; }
for(const locale of ['', 'en/', 'zh-Hant/']) for(const page of RELEASE_PAGES) {
  const path=`dist/${locale}${page}.html`; const html=await readFile(path,'utf8');
  const route=matchRoute(page==='index'?'/':`/${page}`);
  // RC-6: a prerendered page links its route CSS, or <main> paints unstyled until the chunk loads.
  if(!route?.bare) for(const css of routeStyles(PAGE_MODULES[route.page])) if(!html.includes(`href="/${css}"`)) throw new Error(`Route stylesheet /${css} is not linked: ${path}`);
  if(!html.includes('rel="canonical"') || !html.includes('hreflang="zh-Hans"') || !html.includes('hreflang="en"')) throw new Error(`Missing language metadata: ${path}`);
  if(!html.includes('rel="modulepreload"')) throw new Error(`Missing route preload: ${path}`);
  if(page.startsWith('events/')&&!html.includes('"@type":"Event"')) throw new Error(`Wrong event schema: ${path}`);
  if(locale==='en/'&&!html.includes('<html lang="en"')) throw new Error(`Wrong document language: ${path}`);
  if((html.match(/property="og:image:alt"/g)||[]).length!==1) throw new Error(`Ambiguous social image description: ${path}`);
  if(locale==='en/'&&/[\u3400-\u9fff]/.test(html.match(/property="og:image:alt" content="([^"]*)"/)?.[1]||'')) throw new Error(`Untranslated social image description: ${path}`);
  if (page !== 'opus-bay') {
    // Article heroes can have their own header/footer. Check the outer page
    // navigation: the first header and the final footer surround the article.
    const shell = [html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)?.[1], [...html.matchAll(/<footer\b[^>]*>([\s\S]*?)<\/footer>/g)].at(-1)?.[1]].filter(Boolean);
    if (shell.length !== 2) throw new Error(`Missing anonymous navigation shell: ${path}`);
    if (locale === 'en/' && shell.some(markup => /[\u3400-\u9fff]/.test(markup))) throw new Error(`Untranslated first-paint navigation: ${path}`);
    if (locale && shell.some(markup => [...markup.matchAll(/href="(\/[^"]*)"/g)].some(match => !match[1].startsWith(`/${locale.slice(0, -1)}`)))) throw new Error(`First-paint navigation loses its language: ${path}`);
  }
}
// Legacy and shared URLs (QR codes, the 3D game, old shares) resolve on the host as the route table says, onto built pages.
const legacyProblems=checkLegacyUrls(JSON.parse(await readFile('vercel.json','utf8')).routes);
if(legacyProblems.length) throw new Error(`Legacy URLs: ${legacyProblems.join('; ')}`);
for(const item of LEGACY_URLS.filter(entry=>entry.page)) await readFile(`dist${item.page}`).catch(()=>{ throw new Error(`${item.url} is served by dist${item.page}, which the build did not write`); });
const release=JSON.parse(await readFile('dist/release.json','utf8'));if(!/^[a-f0-9]{40}$/.test(release.commit))throw new Error('Release commit missing');
await verifyStaticLinks();
console.log(`Release verified: shell ${(shell/1024).toFixed(1)} KiB, homepage route graph ${(total/1024).toFixed(1)} KiB; English homepage with dictionaries ${(englishTotal/1024).toFixed(1)} KiB gzip; ${routeBudgets.length} route × locale JS budgets hold; translated prerenders, route stylesheets and Event schema present; ${LEGACY_URLS.length} legacy URLs resolve.`);
