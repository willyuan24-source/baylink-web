import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { UnifiedBaySceneProps } from '../src/features/little-bay/UnifiedBayScene';
import { BAY_FERRY_ROUTES, bayCanMove, baySegmentCanMove, baySpawn, getUnifiedPlace, type BayPoint } from '../src/features/little-bay/unified-bay-world';
import { emptyBayJourney } from '../src/features/little-bay/bay-journey';

const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://www.baylink.us/play?lang=en',pretendToBeVisual:true});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Node:dom.window.Node,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
Object.defineProperty(window,'matchMedia',{value:(query:string)=>({matches:false,media:query,addEventListener(){},removeEventListener(){}})});
const sceneState=globalThis as typeof globalThis&{__bayNavigationScene?:UnifiedBaySceneProps};
// Exercise the real HUD and its lazy scene boundary without creating WebGL in
// jsdom. The test double reports only callbacks an actual scene can produce.
const sceneHook=registerHooks({load(url,context,next){
  if(url.endsWith('/UnifiedBayScene.tsx'))return {format:'module',shortCircuit:true,source:`
    import React from 'react';
    export default function Scene(props){
      React.useLayoutEffect(()=>{globalThis.__bayNavigationScene=props;});
      React.useEffect(()=>{props.onReady();},[props.onReady]);
      return React.createElement('canvas',{'aria-label':'Navigation scene fixture',tabIndex:0});
    }
  `};
  return next(url,context);
}});
const {render,fireEvent,cleanup,act,waitFor}=await import('@testing-library/react');
const {MemoryRouter}=await import('react-router-dom');
const {setLocale}=await import('../src/i18n/locale');
const {default:UnifiedBayExplorer}=await import('../src/features/little-bay/UnifiedBayExplorer');
afterEach(()=>{cleanup();window.localStorage.clear();delete sceneState.__bayNavigationScene;});
after(()=>sceneHook.deregister());
const scene=()=>{assert.ok(sceneState.__bayNavigationScene);return sceneState.__bayNavigationScene;};
async function fixture(){
  await setLocale('en',false);
  const visits:string[]=[];
  const view=render(React.createElement(MemoryRouter,null,React.createElement(UnifiedBayExplorer,{
    date:'2026-09-25',journey:emptyBayJourney(),persistent:true,addedPlaceIds:[],
    onVisit:(region,id)=>visits.push(`${region}:${id}`),onShowList(){},
  })));
  await waitFor(()=>assert.ok(sceneState.__bayNavigationScene));
  return {view,visits};
}
function report(point:BayPoint,water=false){
  act(()=>scene().onProgress?.({x:point[0],z:point[1],heading:0,speed:0,region:null,remaining:10,travelMode:water?'ferry':'land'}));
}
function select(key:string){act(()=>scene().onSelect(key));}

test('preview and quick travel do not award visits, and the next route starts from the new spawn immediately',async()=>{
  const {view,visits}=await fixture();
  select('south-bay:tech');
  assert.equal(scene().mode,'overview');assert.deepEqual(visits,[]);
  fireEvent.click(view.getByRole('button',{name:'Quick travel'}));
  assert.equal(scene().spawnCommand?.key,'south-bay:tech');assert.equal(scene().mode,'walk');assert.deepEqual(visits,[]);
  // Do not emit onProgress: this reproduces a route request before the next
  // throttled frame report following a quick-travel command.
  select('east-bay:berkeley');fireEvent.click(view.getByRole('button',{name:'Route',exact:true}));
  const spawn=baySpawn('south-bay:tech');
  assert.deepEqual(scene().navigation?.points[0],[spawn.x,spawn.z]);
  assert.deepEqual(visits,[]);
  act(()=>scene().onVisit?.('south-bay:tech'));
  assert.deepEqual(visits,['south-bay:tech'],'only the physical scene visit callback records arrival');
});

test('routing to the current position completes immediately instead of showing an unfinishable zero-length route',async()=>{
  const {view,visits}=await fixture();
  report(getUnifiedPlace('sf:ferry')!.position);select('sf:ferry');
  fireEvent.click(view.getByRole('button',{name:'Route',exact:true}));
  assert.equal(scene().navigation,null);assert.equal(scene().autoTravel,false);
  assert.ok(view.getByText('You have arrived. Discover this little stop.'));
  assert.equal(view.queryByRole('button',{name:'Follow the route'}),null);assert.deepEqual(visits,[]);
});

test('resuming after manual takeover recomputes a safe route from the actual new location',async()=>{
  const {view}=await fixture();
  select('east-bay:berkeley');fireEvent.click(view.getByRole('button',{name:'Route',exact:true}));
  fireEvent.click(view.getByRole('button',{name:'Follow the route'}));
  const oldId=scene().navigation!.id;assert.equal(scene().autoTravel,true);
  const detached=getUnifiedPlace('peninsula:stanford')!.position;
  report(detached);act(()=>scene().onManualInput?.());assert.equal(scene().autoTravel,false);
  fireEvent.click(view.getByRole('button',{name:'Follow the route'}));
  assert.equal(scene().autoTravel,true);assert.notEqual(scene().navigation!.id,oldId);
  assert.deepEqual(scene().navigation!.points[0],detached);
  for(const leg of scene().navigation!.legs||[])if(leg.mode==='land')for(let i=1;i<leg.points.length;i++)
    assert.ok(baySegmentCanMove(leg.points[i-1],leg.points[i]),'resumed land route does not cut through an inlet');
});

test('a ferry pause replans along its water channel, and arriving on land clears the completed route',async()=>{
  const {view}=await fixture();
  report(getUnifiedPlace('sf:ferry')!.position);select('sf:alcatraz');
  fireEvent.click(view.getByRole('button',{name:'Route',exact:true}));fireEvent.click(view.getByRole('button',{name:'Follow the route'}));
  const id=scene().navigation!.id,water=BAY_FERRY_ROUTES[0].path[1];assert.equal(bayCanMove(...water),false);
  report(water,true);act(()=>scene().onManualInput?.());
  fireEvent.click(view.getByRole('button',{name:'Follow the route'}));
  assert.equal(scene().autoTravel,true);assert.notEqual(scene().navigation!.id,id,'at sea, rejoin the ferry channel from the actual position');
  assert.deepEqual(scene().navigation!.points[0],water);assert.equal(scene().navigation!.legs?.[0].mode,'ferry');
  report(getUnifiedPlace('sf:alcatraz')!.position);act(()=>scene().onManualInput?.());
  fireEvent.click(view.getByRole('button',{name:'Follow the route'}));
  assert.equal(scene().navigation,null);assert.equal(scene().autoTravel,false);
});

test('world pause and modal overlays suspend an active route without awarding or losing it',async()=>{
  const {view,visits}=await fixture();
  select('peninsula:filoli');fireEvent.click(view.getByRole('button',{name:'Route',exact:true}));
  fireEvent.click(view.getByRole('button',{name:'Follow the route'}));const route=scene().navigation;
  fireEvent.click(view.getByRole('button',{name:'Pause world'}));
  assert.equal(scene().running,false);assert.equal(scene().navigation,route);
  fireEvent.click(view.getByRole('button',{name:'Resume world'}));assert.equal(scene().running,true);
  fireEvent.click(view.getByRole('button',{name:'Find a place'}));
  assert.equal(scene().running,false);assert.equal(scene().autoTravel,true);
  fireEvent.click(view.getByRole('button',{name:'Close place search'}));
  assert.equal(scene().running,true);assert.equal(scene().navigation,route);assert.deepEqual(visits,[]);
  fireEvent.click(view.getByRole('button',{name:'Cancel navigation'}));
  assert.equal(scene().navigation,null);assert.equal(scene().autoTravel,false);
});
