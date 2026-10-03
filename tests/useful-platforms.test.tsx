import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { USEFUL_PLATFORMS, usefulPlatformGuides } from '../src/data/guides-useful-platforms';
import { PLATFORM_CATEGORIES } from '../src/data/useful-platform-types';
import { UsefulPlatformsDirectory } from '../src/components/UsefulPlatformsDirectory';
import { usefulPlatformMatches } from '../src/lib/useful-platforms';
import { guideBlockText } from '../src/lib/guide-content';
import { guides } from '../src/data/guides';
import { getGuideMedia } from '../src/data/guide-media';
import { searchGuides } from '../src/lib/guide-search';
import { loadLocale, setLocale, translateEditorial } from '../src/i18n/locale';

const dom = new JSDOM('<!doctype html><html><body></body></html>',{url:'https://www.baylink.us/guides',pretendToBeVisual:true});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const {render,fireEvent,cleanup}=await import('@testing-library/react');
afterEach(async()=>{cleanup();await setLocale('zh-Hans',false);});
after(()=>dom.window.close());
const guide=usefulPlatformGuides[0];
const component=<UsefulPlatformsDirectory platforms={USEFUL_PLATFORMS} title="湾区实用 App 与平台目录" text="" />;

test('the directory covers requested brands and everyday tasks with complete official evidence and local limits',()=>{
  assert.ok(USEFUL_PLATFORMS.length>=48);
  assert.equal(new Set(USEFUL_PLATFORMS.map(p=>p.id)).size,USEFUL_PLATFORMS.length);
  assert.deepEqual([...new Set(USEFUL_PLATFORMS.map(p=>p.category))].sort(),Object.keys(PLATFORM_CATEGORIES).sort());
  for(const name of ['Uber','Lyft','Uber Eats','Zillow','Redfin','Dealmoon','HungryPanda','Fantuan','Weee!','Libby','AirNow']) assert.ok(USEFUL_PLATFORMS.some(p=>p.name===name||p.name.startsWith(`${name} `)),name);
  for(const platform of USEFUL_PLATFORMS){
    assert.match(platform.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(platform.verifiedAt,'2026-10-02');
    assert.ok(['app-web','app','web'].includes(platform.format));
    for(const key of ['summary','bestFor','howTo','coverage','watchFor'] as const) assert.ok(platform[key].length>=12,`${platform.name}: ${key}`);
    assert.ok(platform.sources.length>=1);
    for(const url of [platform.url,...platform.sources.map(s=>s.url)]) assert.equal(new URL(url).protocol,'https:');
    assert.equal(new Set(platform.sources.map(s=>s.url)).size,platform.sources.length,platform.name);
  }
});

test('SSR includes every platform, practical details, official access and source links',()=>{
  const parsed=new JSDOM(renderToStaticMarkup(component));
  assert.equal(parsed.window.document.querySelectorAll('.platform-card').length,USEFUL_PLATFORMS.length);
  for(const platform of USEFUL_PLATFORMS){
    const card=parsed.window.document.getElementById(`platform-${platform.id}`)!;
    assert.ok(card.textContent?.includes(platform.howTo));
    assert.ok(card.textContent?.includes(platform.watchFor));
    assert.equal(card.querySelector('.platform-primary')?.getAttribute('href'),platform.url);
    for(const source of platform.sources) assert.ok([...card.querySelectorAll('a')].some(a=>a.href===source.url));
  }
  parsed.window.close();
});

test('category and task searches combine, cover Chinese aliases and spelling variants, and clear completely',()=>{
  const view=render(component);
  fireEvent.change(view.getByLabelText('按生活用途筛选'),{target:{value:'housing'}});
  assert.equal(view.container.querySelectorAll('.platform-card').length,4);
  fireEvent.change(view.getByRole('searchbox'),{target:{value:'Zillow'}});
  assert.equal(view.container.querySelectorAll('.platform-card').length,1);
  assert.ok(view.container.querySelector('#platform-zillow details[open]'));
  fireEvent.change(view.getByRole('searchbox'),{target:{value:'not-a-real-platform'}});
  assert.equal(view.container.querySelectorAll('.platform-card').length,0);
  assert.ok(view.getByText(/没有匹配的平台/));
  fireEvent.click(view.getByRole('button',{name:'清除筛选'}));
  assert.equal(view.container.querySelectorAll('.platform-card').length,USEFUL_PLATFORMS.length);
  for(const [query,id] of [['hungry panada','hungrypanda'],['熊貓外賣','hungrypanda'],['ubereat','uber-eats'],['飯糰','fantuan'],['省錢快報','dealmoon']]){
    fireEvent.change(view.getByRole('searchbox'),{target:{value:query}});
    assert.ok(view.container.querySelector(`#platform-${id}`),query);
  }
});

test('English translates every card, the article, source notes and media without Chinese residue',async()=>{
  await loadLocale('en');
  const translated=translateEditorial({guide,media:getGuideMedia(guide)},'en');
  assert.doesNotMatch(JSON.stringify(translated),/\p{Script=Han}/u);
  await setLocale('en',false);
  const view=render(component);
  assert.doesNotMatch(view.container.textContent||'',/\p{Script=Han}/u);
  assert.ok(view.getByRole('searchbox',{name:'Search apps, platforms or tasks'}));
  assert.ok(usefulPlatformMatches(USEFUL_PLATFORMS.find(p=>p.id==='watch-duty')!,'wildfire','en'));
});

test('search and assistant exports preserve every complete platform with its limitations and sources',()=>{
  const content=guide.blocks.map(guideBlockText).join('\n\n');
  for(const platform of USEFUL_PLATFORMS){
    const record=content.split(/\n\s*\n/).find(text=>text.startsWith(`Platform: ${platform.name} | ${platform.id}\n`));
    assert.ok(record,platform.name);
    assert.ok(record.includes(platform.watchFor));
    assert.ok(record.includes(platform.coverage));
    for(const source of platform.sources) assert.ok(record.includes(source.url));
  }
  for(const query of ['HungryPanda','Dealmoon','MyShake','hoopla','Rakuten']) assert.ok(searchGuides(guides,{query}).some(r=>r.guide.slug===guide.slug),query);
});
