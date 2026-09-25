import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { UnifiedBaySceneProps } from '../src/features/little-bay/UnifiedBayScene';
import { BAY_FERRY_ROUTES, bayCanMove, baySegmentCanMove, baySpawn, getUnifiedPlace, type BayPoint } from '../src/features/little-bay/unified-bay-world';
import { emptyBayJourney } from '../src/features/little-bay/bay-journey';
import { BAY_CITIES } from '../src/features/little-bay/bay-cities';
import { BAY_DISCOVERIES, bayDiscoveriesKey } from '../src/features/little-bay/bay-discoveries';
import { cityGuideMonths } from '../src/features/little-bay/bay-city-guide';
import { todayInBay } from '../src/lib/planner';

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
async function fixture(onAsk?:(question:string)=>void){
  await setLocale('en',false);
  const visits:string[]=[];
  const view=render(React.createElement(MemoryRouter,null,React.createElement(UnifiedBayExplorer,{
    date:'2026-09-25',journey:emptyBayJourney(),persistent:true,addedPlaceIds:[],
    onVisit:(region,id)=>visits.push(`${region}:${id}`),onShowList(){},onAsk,
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

test('city search previews the actual city without moving BAYBAY or awarding a visit',async()=>{
  const {view,visits}=await fixture();
  const spawn=scene().spawnCommand;
  fireEvent.click(view.getByRole('button',{name:'Find a place'}));
  fireEvent.change(view.getByRole('textbox',{name:'Search all Bay Area places'}),{target:{value:'Sunnyvale'}});
  fireEvent.click(view.getByRole('button',{name:'Sunnyvale',exact:true}));
  assert.equal(scene().mode,'overview');assert.equal(scene().focusCommand?.cityId,'sunnyvale');
  assert.equal(scene().spawnCommand,spawn);assert.deepEqual(visits,[]);
  assert.ok(view.getByRole('heading',{name:'Sunnyvale',exact:true}));
  assert.equal(view.queryByText('A NEW LITTLE CHAPTER'),null);
});

test('city arrival follows physical presence and survives a paused overlay without announcing twice',async t=>{
  let now=1000;t.mock.method(Date,'now',()=>now);
  const {view}=await fixture();
  fireEvent.click(view.getByRole('button',{name:'Walk',exact:true}));
  const city=BAY_CITIES.find(item=>item.id==='stanford')!;
  report(city.position);assert.equal(view.queryByText('A NEW LITTLE CHAPTER'),null);
  now=2101;report(city.position);
  const banner=view.getByText('A NEW LITTLE CHAPTER').parentElement!;
  assert.ok(view.getByRole('heading',{name:'Stanford',exact:true}));
  fireEvent.click(view.getByRole('button',{name:'Open field notes'}));
  assert.equal(scene().running,false);now=5000;report(BAY_CITIES.find(item=>item.id==='san-jose')!.position);
  fireEvent.click(view.getByRole('button',{name:'Close field notes'}));
  report(city.position);
  assert.ok(view.getByRole('heading',{name:'Stanford',exact:true}));
  assert.equal(view.getByText('A NEW LITTLE CHAPTER').parentElement?.textContent,banner.textContent);
  fireEvent.click(view.getByRole('button',{name:'Whole bay overview'}));
  assert.equal(view.queryByText('A NEW LITTLE CHAPTER'),null);
});

test('field notes preview cannot collect remotely, while the nearby E interaction pauses and records a real arrival',async()=>{
  const {view}=await fixture();const item=BAY_DISCOVERIES.find(item=>item.id==='tea-gardener')!;
  fireEvent.click(view.getByRole('button',{name:'Open field notes'}));
  fireEvent.click(view.getByRole('button',{name:/The gardener’s little question/}));
  assert.ok(view.getByRole('button',{name:'Take me there'}));
  assert.equal(view.queryByRole('button',{name:'A little curiosity'}),null);
  fireEvent.click(view.getByRole('button',{name:'Close discovery'}));
  fireEvent.click(view.getByRole('button',{name:'Walk',exact:true}));report(item.position);
  act(()=>scene().onNearbyDiscovery?.(item.id));
  const canvas=view.getByLabelText('Navigation scene fixture');canvas.focus();fireEvent.keyDown(canvas,{key:'e'});
  assert.equal(scene().running,false);assert.ok(view.getByRole('dialog'));
  fireEvent.click(view.getByRole('button',{name:'A little curiosity'}));
  fireEvent.click(view.getByRole('button',{name:'Keep this little memory'}));
  assert.ok(view.getByText('KEPT IN YOUR FIELD NOTES'));
  assert.equal(JSON.parse(window.localStorage.getItem(bayDiscoveriesKey())!).memories[item.id].choiceId,'curiosity');
  fireEvent.click(view.getByRole('button',{name:'Close discovery'}));assert.equal(scene().running,true);
  fireEvent.click(view.getByRole('button',{name:'Whole bay overview'}));fireEvent.keyDown(canvas,{key:'e'});
  assert.equal(view.queryByRole('dialog'),null,'overview must not trigger a nearby interaction');
});

test('city guide pauses the world, releases held movement and routes from actual position without quick travel',async t=>{
  let now=1000;t.mock.method(Date,'now',()=>now);
  const {view,visits}=await fixture();
  fireEvent.click(view.getByRole('button',{name:'Walk',exact:true}));
  const city=BAY_CITIES.find(item=>item.id==='millbrae')!;
  report(city.position);now=2101;report(city.position);
  const opening=view.getByRole('button',{name:/^City guide/});
  opening.focus();
  fireEvent.keyDown(view.getByRole('button',{name:'Forward',exact:true}),{key:' '});
  assert.equal(scene().input.current.forward,true,'the held movement is active before opening the guide');
  fireEvent.click(opening);
  assert.ok(view.getByRole('dialog',{name:'Millbrae',exact:true}));
  assert.equal(scene().running,false);
  assert.deepEqual(scene().input.current,{forward:false,backward:false,left:false,right:false});
  assert.equal(document.activeElement,view.getByRole('button',{name:'Close city guide'}));
  const actual:BayPoint=[city.position[0]-9,city.position[1]+8];
  report(actual); // A final throttled scene report may arrive after the dialog opens.
  const spawn=scene().spawnCommand;
  fireEvent.click(view.getAllByRole('button',{name:'Route here',exact:true})[0]);
  assert.equal(view.queryByRole('dialog'),null);
  assert.equal(scene().mode,'drive');assert.equal(scene().running,true);assert.equal(scene().autoTravel,false);
  assert.deepEqual(scene().navigation?.points[0],actual,'city-centre preview must not replace the real route origin');
  assert.equal(scene().spawnCommand,spawn);assert.deepEqual(visits,[]);
  for(const leg of scene().navigation?.legs||[])if(leg.mode==='land')for(let index=1;index<leg.points.length;index++)
    assert.ok(baySegmentCanMove(leg.points[index-1],leg.points[index]));
});

test('contextual city Ask exits fullscreen and keeps the world paused while handing off the selected month',async()=>{
  const asks:string[]=[];
  const {view,visits}=await fixture(question=>asks.push(question));
  const stage=view.getByRole('region',{name:'Continuous Bay Area 3D world'});
  fireEvent.click(view.getByRole('button',{name:'Explore fullscreen'}));
  assert.ok(stage.classList.contains('is-expanded'));
  act(()=>scene().onCitySelect?.('cupertino'));
  fireEvent.click(view.getByRole('button',{name:'Open city guide'}));
  assert.equal(scene().running,false);
  const nextMonth=cityGuideMonths(todayInBay())[1];
  const monthName=new Intl.DateTimeFormat('en',{month:'long',timeZone:'UTC'}).format(new Date(`${nextMonth.key}-01T12:00:00Z`));
  fireEvent.click(view.getByRole('button',{name:new RegExp(`^${monthName}`)}));
  fireEvent.click(view.getByRole('button',{name:'Ask BAYBAY'}));
  assert.equal(view.queryByRole('dialog'),null);
  assert.equal(stage.classList.contains('is-expanded'),false);
  assert.notEqual(document.body.style.overflow,'hidden');
  assert.equal(scene().running,false,'closing the guide must not resume motion behind the assistant');
  assert.deepEqual(scene().input.current,{forward:false,backward:false,left:false,right:false});
  assert.equal(asks.length,1);assert.match(asks[0],/Cupertino/);assert.ok(asks[0].includes(nextMonth.key));
  assert.match(asks[0],/do not invent events or live availability/);
  assert.deepEqual(visits,[]);
  assert.ok(view.getByRole('button',{name:'Resume world'}));
});

test('routing from an overview city guide returns keyboard focus to the playable stage',async()=>{
  const {view}=await fixture();
  act(()=>scene().onCitySelect?.('cupertino'));
  const opening=view.getByRole('button',{name:'Open city guide'});
  opening.focus();fireEvent.click(opening);
  const route=view.getAllByRole('button',{name:'Route here',exact:true})[0];
  route.focus();fireEvent.click(route);
  assert.equal(view.queryByRole('dialog'),null);assert.equal(scene().mode,'drive');
  assert.ok(scene().navigation?.points.length);
  assert.equal(document.activeElement,view.getByLabelText('Navigation scene fixture'),'WASD requires focus inside the stage after the old city-card trigger is removed');
});
