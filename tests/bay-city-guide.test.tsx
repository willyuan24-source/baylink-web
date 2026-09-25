import assert from 'node:assert/strict';
import test, {afterEach} from 'node:test';
import React from 'react';
import {JSDOM} from 'jsdom';
import {BAY_CITIES} from '../src/features/little-bay/bay-cities';
import {PLANNER_EVENTS} from '../src/data/planner-catalog';
import {cityEventCounts,cityEventMapUrl,cityEventUrl,cityGuideAiPrompt,cityGuideMonths,cityGuidePlaces,eventsForBayCity} from '../src/features/little-bay/bay-city-guide';
import type {PlannerEvent} from '../src/lib/planner';

const sf=BAY_CITIES.find(city=>city.id==='san-francisco')!;
const sample=(patch:Partial<PlannerEvent>):PlannerEvent=>({...PLANNER_EVENTS[0],id:'fixture',city:'San Francisco',region:'sf',startDate:'2026-09-01',endDate:'2026-10-31',...patch});
test('city month windows use remaining local dates and roll into the next year',()=>{
  assert.deepEqual(cityGuideMonths('2026-12-28').map(m=>[m.key,m.start,m.end]),[['2026-12','2026-12-28','2026-12-31'],['2027-01','2027-01-01','2027-01-31']]);
  assert.deepEqual(cityGuideMonths('2026-02-30'),[]);
});
test('event listings honor occurrence days, expired sessions, city affiliation and selected month',()=>{
  const events=[sample({id:'expired',endDate:'2026-09-24'}),sample({id:'specific',occurrenceDates:['2026-09-05','2026-10-12']}),sample({id:'empty',occurrenceDates:[]}),sample({id:'other-city',city:'San Jose'}),sample({id:'multi-city',city:'San Francisco / Oakland'}),sample({id:'wrong-region',region:'east-bay'}),sample({id:'valid',occurrenceDates:['2026-09-26','2026-09-28','2026-10-04']})];
  assert.deepEqual(eventsForBayCity(events,sf,'2026-09','2026-09-25').map(item=>[item.event.id,item.dates]),[['valid',['2026-09-26','2026-09-28']]]);
  assert.deepEqual(eventsForBayCity(events,sf,'2026-10','2026-09-25').map(item=>[item.event.id,item.nextDate]),[['valid','2026-10-04'],['specific','2026-10-12']]);
  assert.deepEqual(eventsForBayCity(events,sf,'2026-11','2026-09-25'),[]);
  assert.equal(cityEventCounts([events.at(-1)!],'2026-09-25')[sf.id],1,'a cross-month program is not counted twice');
});
test('real address links never silently substitute a city centre and social links target the participation section',()=>{
  const event=sample({venue:'Hall & Garden, 12 Main St',city:'San Jose',location:{lat:37.33,lng:-121.89,label:'city centre',sourceUrl:'https://example.org',precision:'area'}});
  assert.equal(new URL(cityEventMapUrl(event)).searchParams.get('query'),'Hall & Garden, 12 Main St, San Jose, California');
  event.location!.precision='venue';assert.equal(new URL(cityEventMapUrl(event)).searchParams.get('query'),'37.33,-121.89');
  assert.equal(cityEventUrl('a/b','en',true),'/events/a%2Fb?lang=en#event-participation');
});
test('city AI prompts keep source limits inside the existing 500-character assistant handoff',()=>{
  for(const city of BAY_CITIES){const events=eventsForBayCity(PLANNER_EVENTS,city,'2026-10','2026-09-25');for(const locale of ['en','zh-Hans']){const prompt=cityGuideAiPrompt(city,'2026-10',events,locale);assert.ok(prompt.length<=500);assert.match(prompt,/do not invent|不编造/);}}
  assert.ok(cityGuidePlaces(sf).every(place=>place.region==='sf'));
  const city=BAY_CITIES.find(c=>c.id==='san-mateo')!;
  const prompt=cityGuideAiPrompt(city,'2026-10',eventsForBayCity(PLANNER_EVENTS,city,'2026-10','2026-09-25'),'en');
  assert.match(prompt,/NOT chosen a date or event/);
  assert.match(prompt,/san-mateo-boos-brews-2026/);
  assert.ok(!prompt.includes('2026-10-24'),'an optional event date is not passed as a user-selected travel day');
});

const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://www.baylink.us/play',pretendToBeVisual:true});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const {render,fireEvent,cleanup}=await import('@testing-library/react');
const {default:BayCityGuide}=await import('../src/features/little-bay/BayCityGuide');
const {setLocale}=await import('../src/i18n/locale');
afterEach(cleanup);
test('city drawer separates previews, game routes, current/next month events and contextual AI',async()=>{
  await setLocale('en',false);const city=BAY_CITIES.find(c=>c.id==='cupertino')!,preview:string[]=[],route:string[]=[],asks:string[]=[];
  const view=render(<BayCityGuide city={city} today="2026-09-25" locale="en" onClose={()=>{}} onPreview={key=>preview.push(key)} onNavigate={key=>route.push(key)} onAsk={q=>asks.push(q)}/>);
  fireEvent.click(view.getAllByRole('button',{name:'Preview',exact:true})[0]);assert.equal(preview.length,1);assert.equal(route.length,0);
  fireEvent.click(view.getAllByRole('button',{name:'Route here',exact:true})[0]);assert.equal(route.length,1);
  fireEvent.click(view.getByRole('button',{name:/September/}));
  assert.ok(view.getByText('2026-09-26'));assert.ok(view.getByRole('link',{name:'Real directions'}));
  assert.match(view.getByRole('link',{name:'Plan this day'}).getAttribute('href')||'',/date=2026-09-26/);
  fireEvent.click(view.getByRole('button',{name:/October/}));fireEvent.click(view.getByRole('button',{name:'Ask BAYBAY'}));
  assert.match(asks[0],/Cupertino.*2026-10/);
});
