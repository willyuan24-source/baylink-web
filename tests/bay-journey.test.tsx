import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import React, {useEffect} from 'react';
import { JSDOM } from 'jsdom';
import { BAY_WORLD_PLACE_IDS, bayJourneyKey, emptyBayJourney, parseBayJourney, visitBayPlace, visitedInRegion } from '../src/features/little-bay/bay-journey';
import { sfExplorationStorageKey } from '../src/features/little-bay/sf-exploration';
import { SF_LANDMARKS } from '../src/features/little-bay/sf-world';
import { REGIONAL_WORLDS } from '../src/features/little-bay/regional-world';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://www.baylink.us/play'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const {renderHook,act,cleanup,render,fireEvent}=await import('@testing-library/react');
const {useBayJourney}=await import('../src/features/little-bay/useBayJourney');
const {default:BayTravelAtlas}=await import('../src/features/little-bay/BayTravelAtlas');
afterEach(()=>{cleanup();window.localStorage.clear();});

test('passport inventory matches all four actual scene catalogs',()=>{
  assert.deepEqual([...BAY_WORLD_PLACE_IDS.sf].sort(),SF_LANDMARKS.map(place=>place.id).sort());
  for(const region of ['peninsula','south-bay','east-bay'] as const)assert.deepEqual([...BAY_WORLD_PLACE_IDS[region]].sort(),REGIONAL_WORLDS[region].places.map(place=>place.id).sort());
});
test('journey ignores unknown, corrupt and duplicated visits without counting real-world attendance',()=>{
  const empty=emptyBayJourney();const now=new Date('2026-09-25T10:00:00Z');
  const first=visitBayPlace(empty,'sf','exploratorium',now);
  assert.equal(visitBayPlace(first,'sf','exploratorium'),first);
  assert.equal(visitBayPlace(first,'sf','__proto__'),first);
  assert.equal(visitBayPlace(first,'peninsula','stanford',new Date('bad')),first);
  assert.deepEqual(visitedInRegion(first,'sf'),['exploratorium']);
  assert.equal(Object.keys(empty.visits).length,0);
  const parsed=parseBayJourney(JSON.stringify({version:1,visits:{...first.visits,'peninsula:stanford':'bad','sf:not-a-place':'2026-09-25','east-bay:berkeley:extra':'2026-09-25'}}));
  assert.deepEqual(parsed,first);
  for(const raw of ['null','[]','{','{"version":2}', 'x'.repeat(50_001)])assert.deepEqual(parseBayJourney(raw),empty);
});
test('visits persist across regions and reloads, migrate existing SF memories and isolate accounts',()=>{
  window.localStorage.setItem(sfExplorationStorageKey('one'),JSON.stringify({version:1,stamps:{pier:{choiceId:'listen',collectedAt:'2026-09-24T12:00:00Z'}},activeRouteId:null}));
  const view=renderHook(({owner}:{owner:string})=>useBayJourney(owner),{initialProps:{owner:'one'}});
  assert.equal(visitedInRegion(view.result.current.journey,'sf').length,1);
  act(()=>{view.result.current.visit('peninsula','stanford');view.result.current.visit('east-bay','berkeley');});
  assert.equal(Object.keys(view.result.current.journey.visits).length,3);
  view.rerender({owner:'two'});assert.equal(Object.keys(view.result.current.journey.visits).length,0);
  act(()=>view.result.current.visit('south-bay','tech'));
  view.rerender({owner:'one'});assert.equal(Object.keys(view.result.current.journey.visits).length,3);
  assert.equal(view.result.current.journey.visits['south-bay:tech'],undefined);
  assert.equal(Object.keys(parseBayJourney(window.localStorage.getItem(bayJourneyKey('two'))).visits).length,1);
  assert.notEqual(bayJourneyKey(),bayJourneyKey('guest'));
});
test('atlas region selection dispatches travel without inventing visit progress',()=>{
  const travels:string[]=[];const view=render(<BayTravelAtlas region="sf" onTravel={id=>travels.push(id)} journey={emptyBayJourney()} persistent/>);
  fireEvent.click(view.getByRole('button',{name:new RegExp(`中半岛.*0 / ${BAY_WORLD_PLACE_IDS.peninsula.length}`)}));
  assert.deepEqual(travels,['peninsula']);assert.equal(view.container.querySelector('.bay-atlas-progress strong')?.textContent,'0');
  fireEvent.click(view.getByRole('button',{name:/一张地图，四段小旅行/}));
  assert.ok(view.getByRole('group',{name:/旧金山、半岛、南湾与东湾/}));
  fireEvent.keyDown(view.getByRole('button',{name:'前往东湾',exact:true}),{key:'Enter'});
  assert.deepEqual(travels,['peninsula','east-bay']);
});

test('an arrival from a child effect survives initial load and account switches',()=>{
  function Arrival({visit}:{visit:ReturnType<typeof useBayJourney>['visit']}){
    useEffect(()=>{visit('sf','exploratorium');},[visit]);
    return null;
  }
  function Harness({owner}:{owner:string}){
    const {journey,visit}=useBayJourney(owner);
    return <><Arrival visit={visit}/><output>{Object.keys(journey.visits).join(',')}</output></>;
  }
  const view=render(<Harness owner="one"/>);
  assert.equal(view.getByRole('status').textContent,'sf:exploratorium');
  view.rerender(<Harness owner="two"/>);
  assert.equal(view.getByRole('status').textContent,'sf:exploratorium');
  for(const owner of ['one','two'])assert.ok(parseBayJourney(window.localStorage.getItem(bayJourneyKey(owner))).visits['sf:exploratorium']);
});
