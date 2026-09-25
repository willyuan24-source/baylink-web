import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { emptySfExploration } from '../src/features/little-bay/sf-exploration';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://www.baylink.us/play'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
const {render,cleanup,fireEvent}=await import('@testing-library/react');
const {default:SfDiscoveryChallenge}=await import('../src/features/little-bay/SfDiscoveryChallenge');
const {default:SfExplorationPanel}=await import('../src/features/little-bay/SfExplorationPanel');
afterEach(()=>cleanup());
test('a light challenge requires all three beams and unlocks the local memory only after solving',()=>{
  const collected:string[]=[];const view=render(<SfExplorationPanel locale="en" progress={emptySfExploration()} currentNearId="exploratorium" initialTab="encounter" onCollect={id=>collected.push(id)} onTravel={()=>{}} onGuide={()=>{}} onStartRoute={()=>{}} onClose={()=>{}}/>);
  const keep=view.getByRole('button',{name:'Keep this virtual stamp'}) as HTMLButtonElement;
  assert.equal(keep.disabled,true);assert.equal(view.queryByRole('button',{name:'Save the light'}),null);
  fireEvent.click(view.getByRole('button',{name:'Red light'}));fireEvent.click(view.getByRole('button',{name:'Green light'}));
  assert.equal(keep.disabled,true);
  fireEvent.click(view.getByRole('button',{name:'Blue light'}));
  fireEvent.click(view.getByRole('button',{name:'Trips',exact:true}));
  fireEvent.click(view.getByRole('button',{name:'Here',exact:true}));
  assert.ok(view.getByRole('img',{name:'Three beams combine into white light'}));
  assert.equal((view.getByRole('button',{name:'Red light'}) as HTMLButtonElement).disabled,true);
  fireEvent.click(view.getByRole('button',{name:'Save the light'}));
  const readyKeep=view.getByRole('button',{name:'Keep this virtual stamp'}) as HTMLButtonElement;
  assert.equal(readyKeep.disabled,false);fireEvent.click(readyKeep);assert.deepEqual(collected,['exploratorium']);
});
test('campus code mistakes reset progress and a correct visible sequence solves once',()=>{
  let solves=0;const view=render(<SfDiscoveryChallenge kind="echo" locale="en" onSolve={()=>solves++}/>);
  const shell=view.getByRole('button',{name:'◒ Shell'}),star=view.getByRole('button',{name:'✦ Star'}),wave=view.getByRole('button',{name:'≈ Wave'});
  fireEvent.click(shell);fireEvent.click(wave);assert.equal(solves,0);assert.match(view.getByRole('status').textContent||'',/start again/);
  for(const control of [shell,star,wave,shell])fireEvent.click(control);
  assert.equal(solves,1);assert.equal((shell as HTMLButtonElement).disabled,true);
});
test('skyline follows a deterministic clue with a retry and does not solve by a single click',()=>{
  let solves=0;const view=render(<SfDiscoveryChallenge kind="skyline" locale="en" onSolve={()=>solves++}/>);
  fireEvent.click(view.getByRole('button',{name:'Dome'}));assert.equal(solves,0);
  for(const name of ['Tower','Pyramid','Dome'])fireEvent.click(view.getByRole('button',{name}));
  assert.equal(solves,1);assert.match(view.getByRole('status').textContent||'',/You found it/);
});

test('a partial skyline retains keyboard focus and repeated pieces do not advance it',()=>{
  let closes=0;
  const view=render(<SfExplorationPanel locale="en" progress={emptySfExploration()} currentNearId="city-hall" initialTab="encounter" onCollect={()=>{}} onTravel={()=>{}} onGuide={()=>{}} onStartRoute={()=>{}} onClose={()=>closes++}/>);
  const tower=view.getByRole('button',{name:'Tower',exact:true}) as HTMLButtonElement;
  tower.focus();fireEvent.click(tower);fireEvent.click(tower);
  assert.equal(document.activeElement,tower);assert.equal(tower.disabled,false);
  assert.equal(tower.getAttribute('aria-disabled'),'true');
  assert.equal(view.queryByText(/You found it!/),null);
  fireEvent.keyDown(tower,{key:'Escape'});assert.equal(closes,1);
  fireEvent.click(view.getByRole('button',{name:'Pyramid',exact:true}));
  fireEvent.click(view.getByRole('button',{name:'Dome',exact:true}));
  assert.match(view.getByRole('status').textContent||'',/You found it/);
  assert.ok((document.activeElement as HTMLElement).closest('.sf-story-choices'));
});
