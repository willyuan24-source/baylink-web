import assert from 'node:assert/strict';
import test from 'node:test';
import { REGIONAL_WORLDS, projectRegional, regionalContains, regionalHeight, regionalArrival, regionalSpawn } from '../src/features/little-bay/regional-world';
import { createSfWalkerState, stepSfWalker } from '../src/features/little-bay/sf-walking';
import { guides } from '../src/data/guides';
import { PLANNER_PLACES } from '../src/data/planner-catalog';
import { GUIDE_IMAGES } from '../src/data/guide-media';

test('regional attractions have valid editorial links, sources and exact-place image references',()=>{
  for(const world of Object.values(REGIONAL_WORLDS)){
    assert.equal(world.places.length,{peninsula:22,'south-bay':18,'east-bay':16}[world.id],world.id);
    assert.equal(new Set(world.places.map(p=>p.id)).size,world.places.length);
    assert.ok(world.places.find(p=>p.id===world.startId));
    for(const place of world.places){
      assert.equal(new URL(place.sourceUrl).protocol,'https:');
      assert.ok(place.title&&place.titleEn&&place.description&&place.descriptionEn,place.id);
      if(place.guideSlug)assert.ok(guides.some(g=>g.slug===place.guideSlug),`missing guide ${place.guideSlug}`);
      if(place.plannerPlaceId)assert.ok(PLANNER_PLACES.some(p=>p.id===place.plannerPlaceId),`missing planner place ${place.plannerPlaceId}`);
      if(place.imageKey){const asset=GUIDE_IMAGES[place.imageKey];assert.ok(asset,place.imageKey);assert.equal(asset.kind,'photo',place.imageKey);assert.ok(asset.creditUrl,place.imageKey);}
    }
  }
});

test('all regional landmarks and starting positions lie on playable land',()=>{
  for(const world of Object.values(REGIONAL_WORLDS))for(const place of world.places){
    const point=projectRegional(world,place.coordinate),spawn=regionalSpawn(world,place.id);
    assert.ok(regionalContains(world,...point),`${world.id}:${place.id} anchor is in water`);
    assert.ok(regionalContains(world,spawn.x,spawn.z),`${world.id}:${place.id} spawn is in water`);
    assert.ok(Math.hypot(spawn.x-point[0],spawn.z-point[1])>=4.5,`${place.id} spawn must be outside its arrival radius`);
    assert.ok(Number.isFinite(regionalHeight(world,...point)));
    assert.equal(regionalArrival(world,...point)?.id,place.id);
  }
});

test('coordinates preserve east/west and north/south orientation in every world',()=>{
  for(const world of Object.values(REGIONAL_WORLDS)){
    assert.deepEqual(projectRegional(world,world.center),[0,0]);
    assert.ok(projectRegional(world,[world.center[0]+.01,world.center[1]])[0]>0);
    assert.ok(projectRegional(world,[world.center[0],world.center[1]+.01])[1]<0);
    assert.equal(regionalContains(world,10000,10000),false);
  }
});

test('walking from a safe spawn reaches every attraction without road constraints',()=>{
  for(const world of Object.values(REGIONAL_WORLDS))for(const place of world.places){
    const spawn=regionalSpawn(world,place.id),point=projectRegional(world,place.coordinate);
    let walker=createSfWalkerState(spawn.x,spawn.z);
    assert.notEqual(regionalArrival(world,walker.x,walker.z)?.id,place.id);
    for(let i=0;i<120;i++)walker=stepSfWalker(walker,{x:0,z:0},1/60,{maxSpeed:4.8,canMove:(x,z)=>regionalContains(world,x,z),destination:{x:point[0],z:point[1]}});
    assert.equal(regionalArrival(world,walker.x,walker.z)?.id,place.id,`${world.id}:${place.id} cannot arrive`);
    assert.ok(walker.distance>.08);
  }
});

test('free driving moves faster than walking and pause cannot collect movement distance',()=>{
  const world=REGIONAL_WORLDS['south-bay'],spawn=regionalSpawn(world,'tech');
  const travel=(speed:number)=>{let state=createSfWalkerState(spawn.x,spawn.z);for(let i=0;i<60;i++)state=stepSfWalker(state,{x:0,z:1},1/60,{maxSpeed:speed,canMove:(x,z)=>regionalContains(world,x,z)});return state;};
  const walk=travel(4.8),drive=travel(13);
  assert.ok(drive.distance>walk.distance*2);
  const stopped=stepSfWalker(drive,{x:1,z:0},.1,{active:false});
  assert.equal(stopped.distance,drive.distance);assert.equal(stopped.speed,0);
});

test('each regional travel station connects to the other three worlds only',()=>{
  for(const world of Object.values(REGIONAL_WORLDS)){
    const station=world.places.find(p=>p.travelTo);
    assert.ok(station,world.id);
    assert.deepEqual(new Set(station.travelTo),new Set(['sf','peninsula','south-bay','east-bay'].filter(id=>id!==world.id)));
  }
});

test('new city landmarks retain reviewable official addresses and coordinate provenance', () => {
  const added = Object.values(REGIONAL_WORLDS).flatMap(world => world.places).filter(place => place.sourceCheckedOn);
  assert.equal(added.length, 20);
  for (const place of added) {
    assert.ok(place.address?.includes('CA '), place.id);
    assert.equal(place.sourceCheckedOn, '2026-09-25');
    assert.ok(place.coordinateSourceUrl, place.id);
    const host = new URL(place.coordinateSourceUrl).hostname;
    assert.match(host, /(^|\.)(bart\.gov|caltrain\.com|sanbruno\.ca\.gov|menlopark\.gov|heritageparkmuseum\.org|scu\.edu|santaclaracounty\.gov|haywardrec\.org|parks\.ca\.gov|census\.gov)$/, place.id);
  }
  const airport = added.find(place => place.id === 'sfo-airport')!;
  assert.equal(airport.city, 'SFO Airport');
  assert.match(airport.descriptionEn, /San Mateo County/);
  assert.notEqual(airport.city, 'San Francisco');
});

test('legacy travel entry points describe the connected world without promising real services', () => {
  for (const world of Object.values(REGIONAL_WORLDS)) {
    const stop = world.places.find(place => place.travelTo)!;
    assert.doesNotMatch(stop.description, /切换区域|切换到/);
    assert.doesNotMatch(stop.descriptionEn, /Switch game regions|change game regions/);
    assert.match(stop.descriptionEn, /official|Caltrain/);
  }
});
