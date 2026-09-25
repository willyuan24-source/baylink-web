/** @jsxImportSource react */
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { BayBayModel, BuggyModel, LandmarkModel, type BayBayLocomotion } from './SanFranciscoModels';
import { RegionalLandmarkModel } from './regional-models';
import { createSfWalkerState, stepSfWalker, type SfWalkerState } from './sf-walking';
import { sfCameraRelativeDirection, type SfMovementInput } from './sf-movement-input';
import { adjustSfCamera, createSfCameraGestureGuard, observeSfCameraGestures, type SfCameraCommand } from './sf-camera';
import { BAY_BRIDGES, BAY_REGION_CENTERS, BAY_REGION_FOCI, UNIFIED_BAY_PLACES, bayArrival, bayCanMove, bayFerryCanMove, bayHeight, bayRegionAt, baySpawn, type BayPoint, type UnifiedPlace } from './unified-bay-world';
import { BAY_REGIONS, type BayRegionId } from './bay-journey';
import { createRoadGeometry } from './san-francisco-geometry';
import { BayFerryModel, UnifiedBayBridges, UnifiedBayGround, UnifiedBayScenery, UnifiedBayWater } from './unified-bay-scene-models';
import { LandmarkCourtyard, LandmarkSilhouette, SoftGroundContact } from './unified-landmark-models';
import { BAY_CITIES } from './bay-cities';
import { translateText, type Locale } from '../../i18n/locale';

export type UnifiedSceneNavigation={id:number;points:BayPoint[];legs?:{mode:'land'|'ferry';points:BayPoint[];name?:string}[]};
export type UnifiedSceneProgress={x:number;z:number;heading:number;speed:number;region:BayRegionId|null;remaining:number;travelMode:'land'|'ferry'};
export type UnifiedSceneDiscovery={id:string;position:[number,number];radius:number;kind:'observe'|'conversation'|'lights';collected:boolean;color:string};
export type UnifiedBaySceneProps={
  mode:'walk'|'drive'|'overview';running:boolean;golden:boolean;input:MutableRefObject<SfMovementInput>;
  selectedKey:string|null;focusCommand?:{id:number;key?:string;cityId?:string;overview?:boolean};spawnCommand?:{id:number;key:string};
  navigation?:UnifiedSceneNavigation|null;autoTravel:boolean;locale:Locale;visitedKeys:readonly string[];cameraCommand?:SfCameraCommand;
  onSelect:(key:string)=>void;onArrival:(key:string|null)=>void;onVisit?:(key:string)=>void;
  onProgress?:(progress:UnifiedSceneProgress)=>void;onNavigationComplete?:()=>void;onManualInput?:()=>void;onReady:()=>void;onError:()=>void;
  onCitySelect?:(cityId:string)=>void;discoveries?:readonly UnifiedSceneDiscovery[];onDiscovery?:(id:string)=>void;onNearbyDiscovery?:(id:string|null)=>void;reducedMotion?:boolean;
};
const emptyInput=():SfMovementInput=>({forward:false,backward:false,left:false,right:false});
type Waypoint={point:BayPoint;mode:'land'|'ferry'};
const length=(a:BayPoint,b:BayPoint)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

function navigationPoints(navigation:UnifiedSceneNavigation|null|undefined):Waypoint[]{
  if(!navigation)return [];
  if(!navigation.legs?.length)return navigation.points.map(point=>({point,mode:'land'}));
  const points:Waypoint[]=[];
  for(const leg of navigation.legs)for(const point of leg.points)if(!points.length||length(points[points.length-1].point,point)>.001)points.push({point,mode:leg.mode});
  return points;
}

function NavigationRibbon({navigation}:{navigation:UnifiedSceneNavigation|null|undefined}){
  const geometry=useMemo(()=>{
    const legs=navigation?.legs?.length?navigation.legs:navigation?[{mode:'land',points:navigation.points}]:[];
    return legs.filter(leg=>leg.points.length>1).map(leg=>({mode:leg.mode,geometry:createRoadGeometry([{path:leg.points,width:.48}],(x,z)=>leg.mode==='ferry'?-.29:bayHeight(x,z),0,.11)}));
  },[navigation]);
  useEffect(()=>()=>geometry.forEach(item=>item.geometry.dispose()),[geometry]);
  const destination=navigation?.points.at(-1);
  return <group>{geometry.map((item,i)=><mesh key={i} geometry={item.geometry} renderOrder={3}><meshBasicMaterial color={item.mode==='ferry'?'#f4e7b5':'#f6cb70'} side={THREE.DoubleSide} depthWrite={false}/></mesh>)}{destination&&<group position={[destination[0],bayHeight(...destination)+.12,destination[1]]}><mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.7,1.05,32]}/><meshBasicMaterial color="#f2c56e" transparent opacity={.95} depthWrite={false}/></mesh><mesh position={[0,2,0]}><octahedronGeometry args={[.45,0]}/><meshStandardMaterial color="#f2c56e" emissive="#c8a151" emissiveIntensity={.12}/></mesh></group>}</group>;
}

function BayActor({props,stateRef,destinationRef,ferryRef}:{props:UnifiedBaySceneProps;stateRef:MutableRefObject<SfWalkerState>;destinationRef:MutableRefObject<{x:number;z:number}|null>;ferryRef:MutableRefObject<boolean>}){
  const actor=useRef<THREE.Group>(null),otter=useRef<THREE.Group>(null),car=useRef<THREE.Group>(null),boat=useRef<THREE.Group>(null);
  const keys=useRef(emptyInput()),forward=useRef(new THREE.Vector3()),locomotion=useRef<BayBayLocomotion>({speed:0,distance:0,turn:0});
  const near=useRef<string|null>(null),nearDiscovery=useRef<string|null>(null),reported=useRef(new Set<string>()),index=useRef(1),aborted=useRef(false),completed=useRef(false),lastReport=useRef(.2),manualActive=useRef(false);
  const {camera,gl}=useThree();
  const route=useMemo(()=>navigationPoints(props.navigation),[props.navigation]);
  const remaining=useMemo(()=>{const result=route.map(()=>0);for(let i=route.length-2;i>=0;i--)result[i]=result[i+1]+length(route[i].point,route[i+1].point);return result;},[route]);
  useEffect(()=>{index.current=1;aborted.current=false;completed.current=false;destinationRef.current=null;},[props.navigation,destinationRef]);
  useEffect(()=>{if(props.autoTravel)aborted.current=false;},[props.autoTravel]);
  useEffect(()=>{reported.current.clear();},[props.onVisit]);
  useEffect(()=>{
    if(!props.spawnCommand)return;
    const spawn=baySpawn(props.spawnCommand.key);stateRef.current=createSfWalkerState(spawn.x,spawn.z,spawn.heading);destinationRef.current=null;near.current=null;nearDiscovery.current=null;ferryRef.current=false;keys.current=emptyInput();aborted.current=true;props.onArrival(null);props.onNearbyDiscovery?.(null);
    // A command is an explicit user action. Other callback updates must not teleport the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[props.spawnCommand]);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      const map:Record<string,'forward'|'backward'|'left'|'right'>={w:'forward',ArrowUp:'forward',s:'backward',ArrowDown:'backward',a:'left',ArrowLeft:'left',d:'right',ArrowRight:'right'};
      const action=map[event.key]||map[event.key.toLowerCase()];if(!action)return;
      if(event.type==='keyup'){keys.current[action]=false;return;}
      if((event.target as HTMLElement)?.closest('input,textarea,select,[role="dialog"],[contenteditable="true"]')||!gl.domElement.parentElement?.closest('[data-unified-bay-stage],.unified-bay-stage,.unified-stage')?.contains(document.activeElement))return;
      if(props.running&&props.mode!=='overview'){event.preventDefault();keys.current[action]=true;}
    };
    const clear=()=>{keys.current=emptyInput();};window.addEventListener('keydown',key);window.addEventListener('keyup',key);window.addEventListener('blur',clear);
    return()=>{window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);window.removeEventListener('blur',clear);clear();};
  },[props.running,props.mode,gl]);
  useFrame((_,delta)=>{
    camera.getWorldDirection(forward.current);
    const combined={...props.input.current,forward:keys.current.forward||props.input.current.forward,backward:keys.current.backward||props.input.current.backward,left:keys.current.left||props.input.current.left,right:keys.current.right||props.input.current.right};
    const direction=sfCameraRelativeDirection(combined,forward.current),manual=Math.hypot(direction.x,direction.z)>.01;
    if(manual){destinationRef.current=null;aborted.current=true;if(!manualActive.current)props.onManualInput?.();}manualActive.current=manual;
    const following=props.autoTravel&&!aborted.current&&!completed.current&&route.length>1&&props.mode!=='overview';
    let target=destinationRef.current;
    if(following){
      while(index.current<route.length-1&&Math.hypot(stateRef.current.x-route[index.current].point[0],stateRef.current.z-route[index.current].point[1])<.55)index.current++;
      const waypoint=route[index.current];target={x:waypoint.point[0],z:waypoint.point[1]};ferryRef.current=waypoint.mode==='ferry'||!bayCanMove(stateRef.current.x,stateRef.current.z);
    }else if(bayCanMove(stateRef.current.x,stateRef.current.z))ferryRef.current=false;
    stateRef.current=stepSfWalker(stateRef.current,direction,delta,{active:props.running&&props.mode!=='overview',maxSpeed:following?40:props.mode==='drive'?30:4.8,destination:target,canMove:(x,z)=>ferryRef.current?bayFerryCanMove(x,z):bayCanMove(x,z)});
    const s=stateRef.current;
    if(destinationRef.current&&Math.hypot(destinationRef.current.x-s.x,destinationRef.current.z-s.z)<.06)destinationRef.current=null;
    if(following&&index.current===route.length-1&&Math.hypot(s.x-target!.x,s.z-target!.z)<.15){completed.current=true;ferryRef.current=!bayCanMove(s.x,s.z);props.onNavigationComplete?.();}
    const onBoat=ferryRef.current&&!bayCanMove(s.x,s.z),y=onBoat?-.25:bayHeight(s.x,s.z)+.03;
    if(actor.current){actor.current.position.set(s.x,y,s.z);actor.current.rotation.y=s.heading;}
    if(otter.current){otter.current.visible=props.mode!=='drive'||onBoat;otter.current.position.set(0,onBoat?.69:0,onBoat?.38:0);otter.current.scale.setScalar(onBoat?.72:1.05);}
    if(car.current)car.current.visible=props.mode==='drive'&&!onBoat;
    if(boat.current)boat.current.visible=onBoat;
    locomotion.current={speed:onBoat?0:s.speed,distance:s.distance,turn:s.turn};
    if(props.mode!=='overview'&&props.running&&s.distance>.08){
      const place=bayArrival(s.x,s.z),key=place?.key||null;if(key!==near.current){near.current=key;props.onArrival(key);}
      if(place&&!reported.current.has(place.key)&&!props.visitedKeys.includes(place.key)){reported.current.add(place.key);props.onVisit?.(place.key);}
    }
    if(props.running||props.mode==='overview'){
      const discovery=props.mode!=='overview'&&s.distance>.08?props.discoveries?.filter(item=>Math.hypot(item.position[0]-s.x,item.position[1]-s.z)<=item.radius).sort((a,b)=>Math.hypot(a.position[0]-s.x,a.position[1]-s.z)-Math.hypot(b.position[0]-s.x,b.position[1]-s.z))[0]?.id||null:null;
      if(discovery!==nearDiscovery.current){nearDiscovery.current=discovery;props.onNearbyDiscovery?.(discovery);}
    }
    lastReport.current+=Math.max(0,Math.min(delta,.25));
    if(lastReport.current>=.2){lastReport.current=0;const rest=route.length&&!completed.current?Math.hypot(s.x-route[Math.min(index.current,route.length-1)].point[0],s.z-route[Math.min(index.current,route.length-1)].point[1])+(remaining[Math.min(index.current,route.length-1)]||0):0;props.onProgress?.({x:s.x,z:s.z,heading:s.heading,speed:s.speed,region:bayRegionAt(s.x,s.z),remaining:rest,travelMode:onBoat?'ferry':'land'});}
  });
  return <group ref={actor} visible={props.mode!=='overview'}><group ref={otter}><BayBayModel locomotion={locomotion}/></group><group ref={car} visible={props.mode==='drive'}><BuggyModel/></group><group ref={boat} visible={false}><BayFerryModel/></group><mesh rotation={[-Math.PI/2,0,0]} position={[0,.025,0]}><circleGeometry args={[.6,24]}/><meshBasicMaterial color="#3c6e58" transparent opacity={.18} depthWrite={false}/></mesh></group>;
}

function UnifiedCamera({props,stateRef,focusTargetRef}:{props:UnifiedBaySceneProps;stateRef:MutableRefObject<SfWalkerState>;focusTargetRef:MutableRefObject<THREE.Vector3>}){
  const controls=useRef<OrbitControlsImpl>(null),target=useRef(new THREE.Vector3()),position=useRef(new THREE.Vector3()),offset=useRef(new THREE.Vector3()),moving=useRef(true),focusOverride=useRef(false),initialized=useRef(false),handledFocus=useRef(-1);
  const {camera,size,invalidate}=useThree();
  const fitWholeBay=()=>{
    // Mount Hamilton remains in the same world, but its remote observatory must
    // not make the populated shoreline tiny on a portrait screen.
    const points=[...UNIFIED_BAY_PLACES.filter(place=>place.id!=='lick').map(place=>place.position),...BAY_BRIDGES.flatMap(bridge=>bridge.path)],xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
    const minX=Math.min(...xs)-42,maxX=Math.max(...xs)+32,minZ=Math.min(...zs)-36,maxZ=Math.max(...zs)+36,centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
    const aspect=size.width/size.height,tangent=Math.tan(43*Math.PI/360),widthDistance=(maxX-minX)/(2*tangent*Math.max(.25,aspect)),heightDistance=(maxZ-minZ)*.85/(2*tangent),distance=Math.max(widthDistance,heightDistance)*1.05;
    target.current.set(centerX,0,centerZ);position.current.set(centerX,distance*.85,centerZ+distance*.55);focusOverride.current=false;
  };
  const followPlayer=()=>{const s=stateRef.current,fit=Math.max(1,Math.min(1.4,size.height/size.width));target.current.set(s.x,bayHeight(s.x,s.z)+.9,s.z);position.current.copy(target.current).add(new THREE.Vector3(8*fit,12*fit,14*fit));focusOverride.current=false;};
  const reset=useRef(()=>{});
  useEffect(()=>{reset.current=()=>{if(props.mode==='overview')fitWholeBay();else followPlayer();moving.current=true;invalidate();};reset.current();if(!initialized.current){camera.position.copy(position.current);controls.current?.target.copy(target.current);camera.lookAt(target.current);initialized.current=true;}
    // Reset framing only when the exploration mode or viewport changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[props.mode,size.width,size.height,camera]);
  useEffect(()=>{
    if(!props.focusCommand||props.focusCommand.id===handledFocus.current)return;handledFocus.current=props.focusCommand.id;
    if(props.focusCommand.overview&&props.mode!=='overview')return;
    if(props.focusCommand.overview)fitWholeBay();else {const city=BAY_CITIES.find(item=>item.id===props.focusCommand?.cityId),place=UNIFIED_BAY_PLACES.find(p=>p.key===props.focusCommand?.key),point=city?.position||place?.position;if(point){const [x,z]=point,fit=Math.max(1,Math.min(1.4,size.height/size.width)),distance=city?125:place?.sf?.cameraDistance||21;target.current.set(x,bayHeight(x,z)+1,z);position.current.copy(target.current).add(new THREE.Vector3(distance*.4*fit,distance*.62*fit,distance*.68*fit));focusOverride.current=true;}}
    moving.current=true;invalidate();
    // Commands, not incidental React updates, change the user's view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[props.focusCommand]);
  useEffect(()=>{if(props.spawnCommand){followPlayer();moving.current=true;invalidate();}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[props.spawnCommand]);
  useEffect(()=>{
    if(!props.cameraCommand||!controls.current)return;if(props.cameraCommand.action==='reset'){reset.current();return;}
    const vector=camera.position.clone().sub(controls.current.target),spherical=new THREE.Spherical().setFromVector3(vector),next=adjustSfCamera({azimuth:spherical.theta,polar:spherical.phi,distance:spherical.radius},props.cameraCommand.action,{minDistance:8,maxDistance:3600,minPolar:.15,maxPolar:1.27});
    target.current.copy(controls.current.target);position.current.copy(target.current).add(vector.setFromSphericalCoords(next.distance,next.polar,next.azimuth));moving.current=true;invalidate();
  },[props.cameraCommand,camera,invalidate]);
  useFrame((_,delta)=>{
    const c=controls.current;if(!c)return;
    if(stateRef.current.speed>.05)focusOverride.current=false;
    if(props.mode!=='overview'&&!focusOverride.current){const s=stateRef.current;offset.current.set(s.x,(bayCanMove(s.x,s.z)?bayHeight(s.x,s.z):-.25)+.9,s.z);if(moving.current){offset.current.sub(target.current);target.current.add(offset.current);position.current.add(offset.current);}else{offset.current.sub(c.target).multiplyScalar(1-Math.exp(-Math.min(delta,.05)*10));c.target.add(offset.current);camera.position.add(offset.current);}}
    if(moving.current){const blend=props.reducedMotion?1:1-Math.exp(-Math.min(delta,.05)*6);camera.position.lerp(position.current,blend);c.target.lerp(target.current,blend);if(camera.position.distanceTo(position.current)<.06)moving.current=false;else invalidate();}focusTargetRef.current.copy(c.target);c.update();
  });
  return <OrbitControls ref={controls} makeDefault enableDamping={!props.reducedMotion} dampingFactor={.1} enablePan={props.mode==='overview'} minDistance={8} maxDistance={3600} minPolarAngle={.15} maxPolarAngle={1.27} rotateSpeed={.5} zoomSpeed={.8} touches={{ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_ROTATE}} onStart={()=>{moving.current=false;}}/>;
}

function Landmark({place,props,guard}:{place:UnifiedPlace;props:UnifiedBaySceneProps;guard:ReturnType<typeof createSfCameraGestureGuard>}){
  const full=useRef<THREE.Group>(null),proxy=useRef<THREE.Group>(null),position=useMemo(()=>new THREE.Vector3(place.position[0],bayHeight(...place.position),place.position[1]),[place]);
  useFrame(({camera})=>{const distance=camera.position.distanceTo(position),near=distance<125||props.selectedKey===place.key&&distance<190;if(full.current)full.current.visible=near;if(proxy.current){proxy.current.visible=!near;proxy.current.scale.setScalar(distance>300?place.region==='sf'?1.5:3.8:1.6);}});
  return <group position={position} onClick={event=>{event.stopPropagation();if(event.delta<5&&guard.allowsClick())props.onSelect(place.key);}}>
    <group ref={full} scale={place.modelScale}>
      <SoftGroundContact radius={place.region==='sf'?3:2.4}/><LandmarkCourtyard place={place} selected={props.selectedKey===place.key}/>
      {place.sf?place.id==='bridge'?<LandmarkSilhouette place={place}/>:<LandmarkModel kind={place.id} animated={props.running&&!props.reducedMotion&&props.selectedKey===place.key}/>:place.regional?<RegionalLandmarkModel place={place.regional}/>:null}
    </group>
    <group ref={proxy}><SoftGroundContact radius={2.6}/><LandmarkSilhouette place={place}/></group>
    {props.selectedKey===place.key&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.12,0]}><ringGeometry args={[Math.max(2,place.arrivalRadius),Math.max(2,place.arrivalRadius)+.18,40]}/><meshBasicMaterial color="#f4c774" transparent opacity={.85} depthWrite={false}/></mesh>}
  </group>;
}

function WorldLabels({props,focusTargetRef}:{props:UnifiedBaySceneProps;focusTargetRef:MutableRefObject<THREE.Vector3>}){
  const {camera,size}=useThree(),last=useRef(.25),signature=useRef(''),[visible,setVisible]=useState<{places:string[];cities:string[];regions:string[];bridges:string[]}>({places:[],cities:[],regions:[],bridges:[]}),project=useMemo(()=>new THREE.Vector3(),[]);
  useFrame((_,delta)=>{
    last.current+=Math.max(0,Math.min(delta,.25));if(last.current<.25)return;last.current=0;
    const distance=camera.position.distanceTo(focusTargetRef.current),level=distance>420?'region':distance>80?'city':'place',mobile=size.width<640,occupied:{x:number;y:number;width:number}[]=[];
    const next:typeof visible={places:[],cities:[],regions:[],bridges:[]};
    const fits=(point:BayPoint,height:number,width:number)=>{
      project.set(point[0],height,point[1]).project(camera);if(project.z<0||project.z>1)return false;
      const x=(project.x+1)*size.width/2,y=(1-project.y)*size.height/2;
      // Leave the search bar, title, mini-map, route card and touch controls usable.
      if(x<width/2+8||x>size.width-width/2-8||y<70||y>size.height-(level==='region'?58:115))return false;
      if(y>size.height-115&&x>size.width-300)return false;
      if(y<(mobile?176:165)&&x<size.width*(mobile?.64:.57))return false;
      if(y<(mobile?204:272)&&x>size.width-(mobile?119:175))return false;
      if(props.navigation&&y>180&&y<290&&x<(mobile?240:340))return false;
      if(occupied.some(p=>Math.abs(p.x-x)<(p.width+width)/2+8&&Math.abs(p.y-y)<38))return false;
      occupied.push({x,y,width});return true;
    };
    if(level==='region'){
      for(const region of BAY_REGIONS){const point=BAY_REGION_CENTERS[region.id];if(fits(point,3,mobile?94:136))next.regions.push(region.id);}
      if(!mobile)for(const bridge of BAY_BRIDGES){const a=bridge.path[0],b=bridge.path[bridge.path.length-1],point:BayPoint=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(fits(point,2,116))next.bridges.push(bridge.id);}
    }else if(level==='city'){
      const candidates=[...BAY_CITIES].sort((a,b)=>a.id===props.focusCommand?.cityId?-1:b.id===props.focusCommand?.cityId?1:Math.hypot(a.position[0]-focusTargetRef.current.x,a.position[1]-focusTargetRef.current.z)-Math.hypot(b.position[0]-focusTargetRef.current.x,b.position[1]-focusTargetRef.current.z));
      for(const city of candidates){if(next.cities.length>=(mobile?6:13))break;const label=props.locale==='en'?city.nameEn:translateText(city.name,props.locale);if(fits(city.position,bayHeight(...city.position)+2.2,Math.min(178,32+label.length*(props.locale==='en'?6.6:11))))next.cities.push(city.id);}
    }else{
      const candidates=[...UNIFIED_BAY_PLACES].sort((a,b)=>a.key===props.selectedKey?-1:b.key===props.selectedKey?1:Math.hypot(a.position[0]-focusTargetRef.current.x,a.position[1]-focusTargetRef.current.z)-Math.hypot(b.position[0]-focusTargetRef.current.x,b.position[1]-focusTargetRef.current.z));
      for(const place of candidates){if(next.places.length>=(mobile?4:8))break;if(fits(place.position,bayHeight(...place.position)+(place.sf?.markerHeight||4),165))next.places.push(place.key);}
    }
    const serialized=JSON.stringify(next);if(serialized!==signature.current){signature.current=serialized;setVisible(next);}
  });
  return <group>{visible.regions.map(id=>{const region=BAY_REGIONS.find(item=>item.id===id)!,point=BAY_REGION_CENTERS[region.id];return <Html key={id} center position={[point[0],3,point[1]]} zIndexRange={[2,1]}><button type="button" className="unified-region-label" onPointerDown={event=>event.stopPropagation()} onClick={()=>props.onCitySelect?props.onCitySelect(({sf:'san-francisco',peninsula:'san-mateo','south-bay':'san-jose','east-bay':'oakland'} as const)[region.id]):props.onSelect(BAY_REGION_FOCI[region.id])} aria-label={props.locale==='en'?`Explore ${region.en}`:translateText(`探索${region.zh}`,props.locale)} style={{display:'block',minHeight:44,color:'#285f58',background:'#fff8e8e8',padding:'6px 12px',border:'1px solid #fff9e9',borderRadius:22,fontFamily:'inherit',fontWeight:700,fontSize:size.width<640?11:14,whiteSpace:'nowrap',letterSpacing:'.04em',cursor:'pointer'}}>{props.locale==='en'?region.en:translateText(region.zh,props.locale)}</button></Html>;})}
    {visible.bridges.map(id=>{const bridge=BAY_BRIDGES.find(item=>item.id===id)!,a=bridge.path[0],b=bridge.path[bridge.path.length-1];return <Html key={id} center position={[(a[0]+b[0])/2,2,(a[1]+b[1])/2]} zIndexRange={[1,0]} style={{pointerEvents:'none'}}><span style={{display:'block',padding:'3px 6px',borderRadius:6,color:'#496a60',background:'#e9ebd6bf',fontSize:9,whiteSpace:'nowrap',fontFamily:'inherit'}}>{props.locale==='en'?bridge.nameEn:translateText(bridge.name,props.locale)}</span></Html>;})}
    {visible.cities.map(id=>{const city=BAY_CITIES.find(item=>item.id===id)!;return <Html key={id} center position={[city.position[0],bayHeight(...city.position)+2.2,city.position[1]]} zIndexRange={[3,2]}><button type="button" className="unified-city-label" onPointerDown={event=>event.stopPropagation()} onClick={()=>props.onCitySelect?.(id)} aria-label={props.locale==='en'?`Explore ${city.nameEn}`:translateText(`探索${city.name}`,props.locale)} style={{display:'flex',alignItems:'center',gap:6,minHeight:36,border:'1px solid #f3e6cb',borderRadius:20,padding:'5px 11px',background:'#fff8e9ed',color:'#2a6059',fontSize:size.width<640?11:12,fontFamily:'inherit',fontWeight:700,whiteSpace:'nowrap',boxShadow:'0 3px 12px #234e3620',cursor:'pointer'}}><span style={{width:5,height:5,borderRadius:'50%',background:'#be8b50'}}/>{props.locale==='en'?city.nameEn:translateText(city.name,props.locale)}</button></Html>;})}
    {visible.places.map(key=>{const place=UNIFIED_BAY_PLACES.find(p=>p.key===key)!,selected=key===props.selectedKey,visited=props.visitedKeys.includes(key),height=place.sf?.markerHeight||4;return <Html key={key} center position={[place.position[0],bayHeight(...place.position)+height,place.position[1]]} zIndexRange={selected?[4,3]:[3,2]}><button type="button" className={`unified-place-label${selected?' is-selected':''}`} aria-label={props.locale==='en'?place.titleEn:translateText(place.title,props.locale)} aria-pressed={selected} onPointerDown={event=>event.stopPropagation()} onClick={()=>props.onSelect(key)} style={{minHeight:36,maxWidth:190,border:'1px solid #fff9eacc',borderRadius:18,padding:'5px 10px',background:selected?'#2b766b':'#fff8e6ed',color:selected?'#fff8e6':'#35685d',fontFamily:'inherit',fontSize:11,fontWeight:600,cursor:'pointer',boxShadow:'0 2px 8px #234e3620',whiteSpace:'nowrap',textOverflow:'ellipsis',overflow:'hidden'}}>{visited?'✓ ':selected?'◆ ':''}{props.locale==='en'?place.titleEn:translateText(place.title,props.locale)}</button></Html>;})}</group>;
}

function DiscoveryMarker({item,props}:{item:UnifiedSceneDiscovery;props:UnifiedBaySceneProps}){
  const ref=useRef<THREE.Group>(null),beacon=useRef<THREE.Group>(null),elapsed=useRef(0),position=useMemo(()=>{
    // The arrival pad stays clear for the buggy. Its sign sits beside it, within the same interaction radius.
    const nearest=UNIFIED_BAY_PLACES.reduce((best,place)=>Math.hypot(place.position[0]-item.position[0],place.position[1]-item.position[1])<Math.hypot(best.position[0]-item.position[0],best.position[1]-item.position[1])?place:best,UNIFIED_BAY_PLACES[0]);
    const dx=item.position[0]-nearest.position[0],dz=item.position[1]-nearest.position[1],length=Math.hypot(dx,dz)||1,offset=Math.min(1.35,item.radius*.6);
    let x=item.position[0],z=item.position[1];for(const side of [1,-1]){const nx=x+dz/length*offset*side,nz=z-dx/length*offset*side;if(bayCanMove(nx,nz)){x=nx;z=nz;break;}}
    return new THREE.Vector3(x,bayHeight(x,z),z);
  },[item.position,item.radius]);
  useFrame(({camera},delta)=>{if(props.running&&!props.reducedMotion)elapsed.current+=Math.min(delta,.05);if(ref.current)ref.current.visible=camera.position.distanceTo(position)<135;if(beacon.current){beacon.current.position.y=1.9+Math.sin(elapsed.current*1.8)*.10;beacon.current.rotation.y=elapsed.current*.18;}});
  return <group ref={ref} position={position} onClick={event=>{event.stopPropagation();if(event.delta<5)props.onDiscovery?.(item.id);}}>
    <mesh position={[0,.10,0]}><cylinderGeometry args={[.66,.78,.2,12]}/><meshStandardMaterial color="#d6c39f" roughness={1}/></mesh>
    <mesh position={[0,.78,0]}><cylinderGeometry args={[.12,.15,1.4,8]}/><meshStandardMaterial color="#a9855f"/></mesh>
    <group ref={beacon}><mesh><octahedronGeometry args={[item.collected?.26:.4,0]}/><meshStandardMaterial color={item.collected?'#83a896':item.color} emissive={item.collected?'#000000':item.color} emissiveIntensity={.18} roughness={.5}/></mesh><mesh rotation={[-Math.PI/2,0,0]}><torusGeometry args={[.6,.027,4,20]}/><meshStandardMaterial color="#f0d596"/></mesh></group>
    {item.kind==='conversation'&&<group position={[.86,.16,.14]}><mesh position={[0,.37,0]}><capsuleGeometry args={[.25,.3,3,7]}/><meshStandardMaterial color="#798d68"/></mesh><mesh position={[0,.9,0]}><sphereGeometry args={[.23,8,6]}/><meshStandardMaterial color="#bc9770"/></mesh><mesh position={[0,1.03,0]}><cylinderGeometry args={[.33,.33,.10,9]}/><meshStandardMaterial color="#d6bd83"/></mesh></group>}
    {item.kind==='observe'&&<group position={[.86,.5,.1]} rotation={[0,.4,-.45]}><mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.15,.2,.75,8]}/><meshStandardMaterial color="#4a7d75"/></mesh></group>}
    {item.kind==='lights'&&[-.9,.9].map(x=><mesh key={x} position={[x,.65,0]}><sphereGeometry args={[.17,8,6]}/><meshStandardMaterial color="#f0ce72" emissive="#c2a154" emissiveIntensity={.5}/></mesh>)}
    <SoftGroundContact radius={1.1}/>
  </group>;
}

function BayLighting({golden,focusTargetRef}:{golden:boolean;focusTargetRef:MutableRefObject<THREE.Vector3>}){
  const light=useRef<THREE.DirectionalLight>(null),target=useMemo(()=>new THREE.Object3D(),[]);
  useFrame(({camera})=>{if(!light.current)return;const point=focusTargetRef.current;target.position.copy(point);target.updateMatrixWorld();light.current.position.set(point.x-24,point.y+38,point.z+18);light.current.castShadow=camera.position.distanceTo(point)<160;});
  return <><ambientLight intensity={.42}/><hemisphereLight args={['#e9f0e2','#78907c',1.35]}/><primitive object={target}/><directionalLight ref={light} target={target} intensity={golden?2.1:1.8} color={golden?'#ffdcaa':'#fff1dc'} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-28} shadow-camera-right={28} shadow-camera-top={28} shadow-camera-bottom={-28} shadow-camera-near={1} shadow-camera-far={100} shadow-bias={-.0006} shadow-normalBias={.06}/></>;
}

function UnifiedWorld(props:UnifiedBaySceneProps){
  const initial=useMemo(()=>baySpawn('sf:park'),[]),stateRef=useRef(createSfWalkerState(initial.x,initial.z,initial.heading)),destinationRef=useRef<{x:number;z:number}|null>(null),ferryRef=useRef(false),focusTargetRef=useRef(new THREE.Vector3()),gesture=useMemo(()=>createSfCameraGestureGuard(),[]);
  const {gl}=useThree(),{onReady,onError,locale}=props;
  useEffect(()=>{const canvas=gl.domElement;canvas.setAttribute('tabindex','0');canvas.setAttribute('aria-label',locale==='en'?'One Bay Area world. WASD to move; drag to orbit.':translateText('完整湾区。WASD 移动，拖动调整视角。',locale));const stop=observeSfCameraGestures(canvas,gesture),focus=()=>canvas.focus({preventScroll:true}),error=()=>onError();canvas.addEventListener('pointerdown',focus);canvas.addEventListener('webglcontextlost',error);onReady();return()=>{stop();canvas.removeEventListener('pointerdown',focus);canvas.removeEventListener('webglcontextlost',error);};},[gl,gesture,onReady,onError,locale]);
  return <>
    <color attach="background" args={[props.golden?'#e9e1cb':'#dce8df']}/><fog attach="fog" args={[props.golden?'#e9e1cb':'#dce8df',2200,4000]}/>
    <BayLighting golden={props.golden} focusTargetRef={focusTargetRef}/>
    <UnifiedBayWater running={props.running&&!props.reducedMotion}/><UnifiedBayGround onWalk={(x,z)=>{if(props.running&&props.mode!=='overview'&&gesture.allowsClick()&&bayCanMove(x,z)){props.onManualInput?.();destinationRef.current={x,z};}}}/><UnifiedBayBridges/><UnifiedBayScenery/>
    <NavigationRibbon navigation={props.navigation}/>
    {UNIFIED_BAY_PLACES.map(place=><Landmark key={place.key} place={place} props={props} guard={gesture}/>)}
    {props.discoveries?.map(item=><DiscoveryMarker key={item.id} item={item} props={props}/>)}
    <WorldLabels props={props} focusTargetRef={focusTargetRef}/><BayActor props={props} stateRef={stateRef} destinationRef={destinationRef} ferryRef={ferryRef}/><UnifiedCamera props={props} stateRef={stateRef} focusTargetRef={focusTargetRef}/>
  </>;
}

export default function UnifiedBayScene(props:UnifiedBaySceneProps){
  const [systemReducedMotion,setSystemReducedMotion]=useState(false);
  useEffect(()=>{if(typeof window.matchMedia!=='function')return;const preference=window.matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setSystemReducedMotion(preference.matches);update();preference.addEventListener('change',update);return()=>preference.removeEventListener('change',update);},[]);
  return <Canvas shadows={{type:THREE.PCFShadowMap}} dpr={[1,1.5]} frameloop={props.running?'always':'demand'} camera={{position:[0,800,600],fov:43,near:2,far:6000}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}}><UnifiedWorld {...props} reducedMotion={props.reducedMotion??systemReducedMotion}/></Canvas>;
}
