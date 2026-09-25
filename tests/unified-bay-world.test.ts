import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BAY_BRIDGES, BAY_LAND_AREAS, BAY_REGION_FOCI, BAY_ROADS, UNIFIED_BAY_PLACES, bayArrival, bayCanMove, bayContains,
  bayApproach, bayFerryCanMove, bayHeight, bayRegionAt, baySegmentCanMove, baySpawn, getUnifiedPlace, projectBay, unprojectBay,
} from '../src/features/little-bay/unified-bay-world';
import { routeBay, routeDistance } from '../src/features/little-bay/unified-bay-routing';
import { BAY_WORLD_PLACE_IDS } from '../src/features/little-bay/bay-journey';
import { createSfWalkerState, stepSfWalker } from '../src/features/little-bay/sf-walking';

test('one geographic projection preserves every original place and compass orientation',()=>{
  assert.equal(UNIFIED_BAY_PLACES.length,68);
  assert.equal(new Set(UNIFIED_BAY_PLACES.map(place=>place.key)).size,68);
  for(const [region,ids] of Object.entries(BAY_WORLD_PLACE_IDS))assert.deepEqual(
    new Set(UNIFIED_BAY_PLACES.filter(place=>place.region===region).map(place=>place.id)),new Set(ids));
  for(const place of UNIFIED_BAY_PLACES){
    const restored=unprojectBay(place.position);
    assert.ok(Math.abs(restored[0]-place.coordinate[0])<1e-9&&Math.abs(restored[1]-place.coordinate[1])<1e-9);
    assert.ok(place.sf||place.regional);
    assert.equal(new URL(place.sourceUrl).protocol,'https:');
  }
  assert.deepEqual(projectBay([-122.2,37.6]),[0,0]);
  assert.ok(projectBay([-122.1,37.6])[0]>0);
  assert.ok(projectBay([-122.2,37.7])[1]<0);
});

test('a single mainland joins four districts and leaves the bay and ocean as water',()=>{
  assert.equal(BAY_LAND_AREAS.filter(area=>area.id==='mainland').length,1);
  for(const coordinate of [[-122.245,37.690],[-122.220,37.625],[-122.143,37.557],[-122.060,37.481],[-122.555,37.741]]){
    const point=projectBay(coordinate);
    assert.equal(bayContains(...point),false,`water coordinate ${coordinate}`);
    assert.equal(bayCanMove(...point),false,`no water driving ${coordinate}`);
  }
  for(const coordinate of [[-122.45,37.71],[-122.36,37.6],[-122.19,37.47],[-121.97,37.39],[-121.97,37.49],[-122.10,37.63],[-122.28,37.86]])
    assert.ok(bayContains(...projectBay(coordinate)),`continuous land ${coordinate}`);
  assert.equal(bayCanMove(NaN,0),false);assert.equal(bayCanMove(Infinity,0),false);
});

test('each bridge has a continuous traversable deck with matching support height',()=>{
  assert.deepEqual(new Set(BAY_BRIDGES.map(bridge=>bridge.id)),new Set(['golden-gate','bay-bridge','san-mateo','dumbarton']));
  for(const bridge of BAY_BRIDGES){
    assert.ok(bayContains(...bridge.path[0]),`${bridge.id} starts on shore`);
    assert.ok(bayContains(...bridge.path.at(-1)!),`${bridge.id} ends on shore`);
    for(let i=1;i<bridge.path.length;i++){
      const a=bridge.path[i-1],b=bridge.path[i];
      assert.ok(baySegmentCanMove(a,b,.2),`${bridge.id} deck segment ${i}`);
      const midpoint=[(a[0]+b[0])/2,(a[1]+b[1])/2] as [number,number];
      assert.equal(bayHeight(...midpoint),bridge.height);
    }
  }
});

test('rendered road lines never imply an unsupported shortcut across water',()=>{
  const failures:string[]=[];
  for(const road of BAY_ROADS)for(let i=1;i<road.path.length;i++)if(!baySegmentCanMove(road.path[i-1],road.path[i]))failures.push(`${road.id}:${i}`);
  assert.deepEqual(failures,[]);
});

test('every place has a safe ground spawn, independent arrival and connected route',()=>{
  for(const place of UNIFIED_BAY_PLACES){
    assert.ok(bayCanMove(...place.position),`${place.key} anchor is land`);
    const spawn=baySpawn(place),point:[number,number]=[spawn.x,spawn.z];
    assert.ok(bayCanMove(...point),`${place.key} spawn is land`);
    assert.ok(baySegmentCanMove(point,place.position),`${place.key} entrance stays on land`);
    assert.notEqual(bayArrival(...point)?.key,place.key,`${place.key} does not collect itself on spawn`);
    assert.equal(bayArrival(...place.position)?.key,place.key,`${place.key} arrival is distinct`);
    const approach=bayApproach(place);
    assert.equal(bayArrival(...approach)?.key,place.key,`${place.key} entrance belongs to this attraction`);
    assert.ok(Math.hypot(approach[0]-place.position[0],approach[1]-place.position[1])>=place.arrivalRadius*.5,`${place.key} route does not stop inside the model centre`);
    const route=routeBay(point,'sf:ferry');
    assert.ok(route.available,`${place.key} has a route to the shared mainland`);
    assert.ok(Number.isFinite(bayHeight(...point)));
    assert.equal(route.requiresFerry,place.key==='sf:alcatraz',`${place.key} ferry requirement`);
  }
});

test('routes between all district centres stay on ground or named bridge decks',()=>{
  for(const fromKey of Object.values(BAY_REGION_FOCI))for(const toKey of Object.values(BAY_REGION_FOCI)){
    const start=getUnifiedPlace(fromKey)!.position,route=routeBay(start,toKey);
    assert.ok(route.available,`${fromKey} → ${toKey}`);
    assert.equal(route.requiresFerry,false);
    assert.deepEqual(route.points[0],start);
    assert.deepEqual(route.points.at(-1),fromKey===toKey?start:bayApproach(toKey));
    assert.ok(Math.abs(route.distance-routeDistance(route.points))<1e-7);
    for(const leg of route.legs)for(let i=1;i<leg.points.length;i++)assert.ok(
      baySegmentCanMove(leg.points[i-1],leg.points[i],.25),`${fromKey} → ${toKey} crosses water`);
  }
  const direct=routeBay(projectBay([-122.245,37.690]),'sf:ferry');
  assert.equal(direct.available,false,'invalid water origin never silently teleports');
  assert.equal(routeBay(getUnifiedPlace('sf:ferry')!.position,'invalid:key').available,false);
});

test('Alcatraz uses an explicit ferry leg both ways and does not enable ocean driving',()=>{
  for(const [from,to] of [['sf:ferry','sf:alcatraz'],['sf:alcatraz','east-bay:berkeley']]){
    const route=routeBay(getUnifiedPlace(from)!.position,to);
    assert.ok(route.available);assert.equal(route.requiresFerry,true);
    const ferry=route.legs.filter(leg=>leg.mode==='ferry');assert.equal(ferry.length,1);
    assert.equal(ferry[0].name,'Pier 33 ↔ Alcatraz');
    assert.ok(ferry[0].points.some(point=>!bayCanMove(...point)),'the ferry crosses genuine water');
    for(const point of ferry[0].points)assert.ok(bayFerryCanMove(...point),'all ferry waypoints support bounded boat movement');
    for(const leg of route.legs.filter(leg=>leg.mode==='land'))for(let i=1;i<leg.points.length;i++)
      assert.ok(baySegmentCanMove(leg.points[i-1],leg.points[i],.25));
  }
  assert.equal(bayFerryCanMove(...projectBay([-122.245,37.690])),false,'manual boat steering cannot unlock the whole bay');
  assert.equal(bayFerryCanMove(10_000,10_000),false);
});

test('region detection does not call Marin an existing content district',()=>{
  for(const [region,key] of Object.entries(BAY_REGION_FOCI))assert.equal(bayRegionAt(...getUnifiedPlace(key)!.position),region);
  for(const place of UNIFIED_BAY_PLACES)assert.equal(bayRegionAt(...place.position),place.region,place.key);
  assert.equal(bayRegionAt(...getUnifiedPlace('sf:alcatraz')!.position),'sf');
  assert.equal(bayRegionAt(...projectBay([-122.50,37.85])),null);
  assert.equal(bayRegionAt(...projectBay([-122.245,37.690])),null);
});

test('resuming from a ferry channel keeps bends and never invents an open-water shortcut',()=>{
  const origin=projectBay([-122.408,37.8165]);
  assert.equal(bayCanMove(...origin),false);assert.ok(bayFerryCanMove(...origin));
  for(const destination of ['sf:alcatraz','sf:ferry','east-bay:berkeley']){
    const route=routeBay(origin,destination);assert.ok(route.available);assert.equal(route.requiresFerry,true);
    assert.deepEqual(route.points[0],origin);assert.equal(route.legs[0].mode,'ferry');
    assert.equal(bayArrival(...route.points.at(-1)!)?.key,destination);
    for(const leg of route.legs)for(let i=1;i<leg.points.length;i++){
      const a=leg.points[i-1],b=leg.points[i],count=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.2);
      for(let j=0;j<=count;j++){
        const t=count?j/count:0,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
        assert.ok(leg.mode==='ferry'?bayFerryCanMove(x,z):bayCanMove(x,z),`${destination}: ${leg.mode} segment`);
      }
    }
  }
});

test('the real walker reaches all 68 named entrances including the bounded ferry crossing',()=>{
  const start=getUnifiedPlace('sf:ferry')!.position;
  for(const place of UNIFIED_BAY_PLACES){
    const route=routeBay(start,place),points:{point:[number,number];mode:'land'|'ferry'}[]=[];
    for(const leg of route.legs)for(const point of leg.points)if(!points.length||Math.hypot(points.at(-1)!.point[0]-point[0],points.at(-1)!.point[1]-point[1])>.001)points.push({point,mode:leg.mode});
    if(points.length<2)continue;
    let state=createSfWalkerState(...start),index=1,arrived=false;
    for(let frame=0;frame<3600;frame++){
      while(index<points.length-1&&Math.hypot(state.x-points[index].point[0],state.z-points[index].point[1])<.55)index++;
      const waypoint=points[index],ferry=waypoint.mode==='ferry'||!bayCanMove(state.x,state.z);
      state=stepSfWalker(state,{x:0,z:0},1/30,{maxSpeed:40,destination:{x:waypoint.point[0],z:waypoint.point[1]},canMove:ferry?bayFerryCanMove:bayCanMove});
      if(index===points.length-1&&Math.hypot(state.x-waypoint.point[0],state.z-waypoint.point[1])<.15){arrived=true;break;}
    }
    assert.ok(arrived,`${place.key}: automatic traversal cannot get stuck`);
    assert.equal(bayArrival(state.x,state.z)?.key,place.key);
  }
});
