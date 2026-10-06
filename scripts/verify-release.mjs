import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
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
for(const locale of ['', 'en/', 'zh-Hant/']) for(const page of ['index','guides','calendar','plan','opus-bay','events/san-francisco-fleet-week-2026']) {
  const path=`dist/${locale}${page}.html`; const html=await readFile(path,'utf8');
  if(!html.includes('rel="canonical"') || !html.includes('hreflang="zh-Hans"') || !html.includes('hreflang="en"')) throw new Error(`Missing language metadata: ${path}`);
  if(!html.includes('rel="modulepreload"')) throw new Error(`Missing route preload: ${path}`);
  if(page.startsWith('events/')&&!html.includes('"@type":"Event"')) throw new Error(`Wrong event schema: ${path}`);
  if(locale==='en/'&&!html.includes('<html lang="en"')) throw new Error(`Wrong document language: ${path}`);
  if((html.match(/property="og:image:alt"/g)||[]).length!==1) throw new Error(`Ambiguous social image description: ${path}`);
  if(locale==='en/'&&/[\u3400-\u9fff]/.test(html.match(/property="og:image:alt" content="([^"]*)"/)?.[1]||'')) throw new Error(`Untranslated social image description: ${path}`);
}
const release=JSON.parse(await readFile('dist/release.json','utf8'));if(!/^[a-f0-9]{40}$/.test(release.commit))throw new Error('Release commit missing');
console.log(`Release verified: shell ${(shell/1024).toFixed(1)} KiB, homepage route graph ${(total/1024).toFixed(1)} KiB; English homepage with dictionaries ${(englishTotal/1024).toFixed(1)} KiB gzip; translated prerenders and Event schema present.`);
