import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { CITY_EXPLORATIONS, cityExplorationGuides } from '../src/data/guides-city-exploration';
import { cityExplorationKey, cityExplorationUrl } from '../src/data/city-exploration-types';
import { UTILITY_CITIES } from '../src/data/guides-utilities';
import { guides } from '../src/data/guides';
import { getGuideMedia } from '../src/data/guide-media';
import { guideBlockText } from '../src/lib/guide-content';
import { cityExplorationMatches } from '../src/lib/city-exploration';
import { searchGuides } from '../src/lib/guide-search';
import { loadLocale, setLocale, translateEditorial } from '../src/i18n/locale';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/guides', pretendToBeVisual: true });
Object.assign(globalThis, { window:dom.window, document:dom.window.document, HTMLElement:dom.window.HTMLElement, Node:dom.window.Node, IS_REACT_ACT_ENVIRONMENT:true });
Object.defineProperty(globalThis, 'navigator', { configurable:true, value:dom.window.navigator });
const { MemoryRouter, useLocation } = await import('react-router-dom');
const { CityExplorationDirectory } = await import('../src/components/CityExplorationDirectory');
const { render, fireEvent, cleanup } = await import('@testing-library/react');
afterEach(async()=>{ cleanup(); await setLocale('zh-Hans',false); });
after(()=>dom.window.close());
const guide = cityExplorationGuides[0];
const component = <CityExplorationDirectory cities={CITY_EXPLORATIONS} title="城市资料库" text="" />;
function Harness() { const location=useLocation(); return <><output data-testid="location">{location.search}</output>{component}</>; }

test('every incorporated city has a distinct, sourced profile and practical advice for three reader groups',()=>{
  assert.equal(CITY_EXPLORATIONS.length,101);
  const identity=(items:{city:string;county:string}[])=>items.map(city=>`${city.county}/${city.city}`).sort();
  assert.deepEqual(identity(CITY_EXPLORATIONS),identity(UTILITY_CITIES));
  assert.equal(new Set(CITY_EXPLORATIONS.map(city=>cityExplorationKey(city.city))).size,101);
  assert.equal(new Set(CITY_EXPLORATIONS.map(city=>city.summary)).size,101);
  assert.equal(new Set(CITY_EXPLORATIONS.map(city=>city.halfDay)).size,101);
  for(const city of CITY_EXPLORATIONS){
    assert.ok(city.places.length>=3,city.city);
    assert.ok(city.places.some(place=>place.scope==='city'),`${city.city}: include a genuine in-city place`);
    for(const field of ['summary','halfDay','arrival','residentTip','transport','checks'] as const) assert.ok(city[field].length>=15,`${city.city}: ${field}`);
    assert.match(city.verifiedAt,/^2026-10-(02|05)$/);
    assert.ok(city.resources.some(resource=>resource.kind==='city'),city.city);
    assert.ok(city.resources.some(resource=>resource.kind!=='city'),city.city);
    for(const place of city.places){
      assert.ok(['city','nearby','cross-boundary'].includes(place.scope));
      assert.equal(new URL(place.url).protocol,'https:');
      assert.ok(place.description.trim() && place.mapQuery.trim());
    }
    for(const resource of city.resources) assert.equal(new URL(resource.url).protocol,'https:');
  }
});

test('SSR retains all 101 cards, place boundaries, practical details and exact map destinations',()=>{
  const html=renderToStaticMarkup(<MemoryRouter>{component}</MemoryRouter>);
  const parsed=new JSDOM(html);
  assert.equal(parsed.window.document.querySelectorAll('details.city-exploration-card').length,101);
  assert.equal(parsed.window.document.querySelectorAll('details[open]').length,0);
  for(const city of CITY_EXPLORATIONS){
    const card=parsed.window.document.getElementById(`city-${cityExplorationKey(city.city)}`)!;
    assert.ok(card.textContent?.includes(city.halfDay));
    assert.ok(card.textContent?.includes(city.checks));
    const maps=[...card.querySelectorAll('a')].filter(link=>link.href.startsWith('https://www.google.com/maps/search/'));
    assert.deepEqual(maps.map(link=>new URL(link.href).searchParams.get('query')),city.places.map(place=>place.mapQuery));
    assert.ok([...card.querySelectorAll('a')].some(link=>link.getAttribute('href')===cityExplorationUrl(city.city)));
  }
  assert.match(html,/附近延伸 · 不在本市/);
  parsed.window.close();
});

test('city links isolate and expand their city; filters preserve language and clear back to complete coverage',()=>{
  const view=render(<MemoryRouter initialEntries={[cityExplorationUrl('Rio Vista','en')]}><Harness /></MemoryRouter>);
  assert.equal(view.container.querySelectorAll('.city-exploration-card').length,1);
  assert.ok(view.container.querySelector('#city-rio-vista[open]'));
  fireEvent.click(view.getByRole('button',{name:'清除筛选'}));
  assert.equal(view.container.querySelectorAll('.city-exploration-card').length,101);
  assert.match(view.getByTestId('location').textContent||'',/lang=en/);
  fireEvent.change(view.getByLabelText('按县筛选'),{target:{value:'Marin'}});
  assert.equal(view.container.querySelectorAll('.city-exploration-card').length,11);
  fireEvent.change(view.getByRole('searchbox'),{target:{value:'zz-no-city'}});
  assert.ok(view.getByText(/没有匹配的城市/));
  assert.equal(view.container.querySelectorAll('.city-exploration-card').length,0);
  fireEvent.click(view.getByRole('button',{name:'清除筛选'}));
  fireEvent.change(view.getByRole('searchbox'),{target:{value:'半月灣'}});
  assert.ok(view.container.querySelector('#city-half-moon-bay'));
});

test('English covers the complete article and UI; translated search includes resident resources',async()=>{
  await loadLocale('en');
  const translated=translateEditorial({guide,media:getGuideMedia(guide)},'en');
  assert.doesNotMatch(JSON.stringify(translated),/\p{Script=Han}/u);
  assert.doesNotMatch(translated.guide.blocks.map(guideBlockText).join('\n\n'),/\p{Script=Han}/u);
  await setLocale('en',false);
  const view=render(<MemoryRouter><CityExplorationDirectory cities={CITY_EXPLORATIONS} title="City directory" text="" /></MemoryRouter>);
  assert.ok(view.getByRole('searchbox',{name:'Search cities, places or local resources'}));
  fireEvent.change(view.getByRole('searchbox'),{target:{value:'library'}});
  assert.ok(view.container.querySelectorAll('.city-exploration-card').length>0);
  assert.doesNotMatch(view.container.textContent||'',/\p{Script=Han}/u);
  const halfMoon= CITY_EXPLORATIONS.find(city=>city.city==='Half Moon Bay')!;
  assert.ok(cityExplorationMatches(halfMoon,'半月湾','en'));
  assert.ok(cityExplorationMatches(halfMoon,'Half Moon Bay','en'));
});

test('search and assistant exports retain complete late-city records, boundaries and official sources',()=>{
  const content=guide.blocks.map(guideBlockText).join('\n\n');
  for(const city of CITY_EXPLORATIONS){
    const record=content.split(/\n\s*\n/).find(block=>block.startsWith(`City guide: ${city.city} | ${city.county}\n`));
    assert.ok(record,city.city);
    assert.ok(record.includes(city.checks));
    assert.ok(record.includes(city.arrival));
    for(const place of city.places){ assert.ok(record.includes(place.url)); assert.ok(record.includes(`[${place.scope}]`)); }
  }
  for(const query of ['Rio Vista','Piedmont','Portola Valley','American Canyon','Cloverdale']) assert.ok(searchGuides(guides,{query}).some(result=>result.guide.slug===guide.slug),query);
});
