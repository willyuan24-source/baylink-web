import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShoppingDirectory } from '../src/components/ShoppingDirectory';
import { SHOPPING_PLACES, shoppingGuides } from '../src/data/guides-shopping';
import { SHOPPING_KINDS, SHOPPING_REGIONS } from '../src/data/shopping-types';
import { guideBlockText } from '../src/lib/guide-content';
import { getGuideMedia } from '../src/data/guide-media';
import { guides } from '../src/data/guides';
import { searchGuides } from '../src/lib/guide-search';
import { loadLocale, setLocale, translateEditorial } from '../src/i18n/locale';

const dom = new JSDOM('<!doctype html><html><body></body></html>',{url:'https://www.baylink.us/guides',pretendToBeVisual:true});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const {render,fireEvent,cleanup} = await import('@testing-library/react');
afterEach(async()=>{cleanup();await setLocale('zh-Hans',false);});
after(()=>dom.window.close());
const guide = shoppingGuides[0];
const component = <ShoppingDirectory places={SHOPPING_PLACES} title="购物地点目录" text="说明" />;

test('shopping coverage includes 32 unique destinations, six outlets and all five regions with usable official entry points',()=>{
  assert.equal(SHOPPING_PLACES.length,32);
  assert.equal(new Set(SHOPPING_PLACES.map(place=>place.id)).size,32);
  assert.equal(SHOPPING_PLACES.filter(place=>place.kind==='outlet').length,6);
  assert.equal(new Set(SHOPPING_PLACES.map(place=>place.region)).size,5);
  for(const place of SHOPPING_PLACES){
    assert.match(place.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(place.kind in SHOPPING_KINDS);
    assert.ok(place.region in SHOPPING_REGIONS);
    assert.equal(place.verifiedAt,'2026-10-02');
    for(const field of ['description','bestFor','address','plan','transport','caution'] as const) assert.ok(place[field].trim(),`${place.name}: ${field}`);
    for(const field of ['url','directoryUrl','visitUrl'] as const) assert.equal(new URL(place[field]).protocol,'https:');
  }
  assert.equal(SHOPPING_PLACES.find(place=>place.name==='San Francisco Premium Outlets')?.city,'Livermore');
  assert.match(SHOPPING_PLACES.find(place=>place.name==='Great Mall')!.description,/室内/);
  assert.ok(!SHOPPING_PLACES.some(place=>/Tanforan|Northgate|San Francisco Centre/.test(place.name)));
});

test('server-rendered shopping cards retain every description, official directory and safely encoded map lookup',()=>{
  const parsed = new JSDOM(renderToStaticMarkup(component));
  assert.equal(parsed.window.document.querySelectorAll('article.shopping-place').length,32);
  for(const place of SHOPPING_PLACES){
    const card = parsed.window.document.getElementById(`shopping-${place.id}`)!;
    assert.ok(card.textContent?.includes(place.description));
    assert.ok([...card.querySelectorAll('a')].some(link=>link.getAttribute('href')===place.directoryUrl));
    const map = [...card.querySelectorAll('a')].find(link=>link.href.startsWith('https://www.google.com/maps/search/'))!;
    assert.equal(new URL(map.href).searchParams.get('query'),`${place.name} ${place.address}`);
  }
  parsed.window.close();
});

test('region, type and text filters combine and clear without losing destinations',()=>{
  const view = render(component);
  fireEvent.change(view.getByLabelText('按购物类型筛选'),{target:{value:'outlet'}});
  assert.equal(view.container.querySelectorAll('.shopping-place').length,6);
  fireEvent.change(view.getByLabelText('按地区筛选'),{target:{value:'South Bay'}});
  assert.equal(view.container.querySelectorAll('.shopping-place').length,2);
  fireEvent.change(view.getByRole('searchbox'),{target:{value:'Great Mall'}});
  assert.equal(view.container.querySelectorAll('.shopping-place').length,1);
  assert.ok(view.getByRole('heading',{name:'Great Mall'}));
  fireEvent.change(view.getByRole('searchbox'),{target:{value:'no-such-shopping-place'}});
  assert.equal(view.container.querySelectorAll('.shopping-place').length,0);
  assert.ok(view.getByText(/没有匹配的购物地点/));
  fireEvent.click(view.getByRole('button',{name:'清除筛选'}));
  assert.equal(view.container.querySelectorAll('.shopping-place').length,32);
  fireEvent.change(view.getByRole('searchbox'),{target:{value:'圣何塞'}});
  assert.ok(view.container.textContent?.includes('Valley Fair'));
  fireEvent.change(view.getByRole('searchbox'),{target:{value:'Valley Fair 停车'}});
  assert.ok(view.container.textContent?.includes('Valley Fair'));
  fireEvent.change(view.getByRole('searchbox'),{target:{value:'Livermore 奥特莱斯'}});
  assert.ok(view.container.textContent?.includes('San Francisco Premium Outlets'));
  fireEvent.change(view.getByRole('searchbox'),{target:{value:'BART'}});
  assert.ok(view.container.textContent?.includes('Great Mall'));
});

test('English translates the whole article, descriptions, source notes and credited media',async()=>{
  await loadLocale('en');
  const translated = translateEditorial({guide,media:getGuideMedia(guide)},'en');
  assert.doesNotMatch(JSON.stringify(translated),/\p{Script=Han}/u);
  assert.doesNotMatch(translated.guide.blocks.map(guideBlockText).join('\n'),/\p{Script=Han}/u);
  await setLocale('en',false);
  const view = render(<ShoppingDirectory places={SHOPPING_PLACES} title="Shopping directory" text="" />);
  assert.ok(view.getByRole('searchbox',{name:'Search shopping destinations'}));
  fireEvent.change(view.getByRole('searchbox'),{target:{value:'indoor'}});
  assert.ok(view.container.textContent?.includes('Great Mall'));
  assert.doesNotMatch(view.container.textContent || '',/\p{Script=Han}/u);
});

test('full-text search and the published catalog text preserve late-listed shopping destinations and practical details',()=>{
  const content = guide.blocks.map(guideBlockText).join('\n\n');
  for(const place of SHOPPING_PLACES){
    assert.ok(content.includes(place.name));
    assert.ok(content.includes(place.transport));
    assert.ok(content.includes(place.directoryUrl));
  }
  for(const query of ['Outlet','Solano Town Center','Gilroy','Coddingtown','Final Sale']) assert.ok(searchGuides(guides,{query}).some(result=>result.guide.slug===guide.slug),query);
  assert.match(content,/Tanforan/);
  assert.match(content,/San Francisco Centre/);
});
