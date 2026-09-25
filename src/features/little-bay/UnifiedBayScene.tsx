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

export type UnifiedSceneNavigation={id:number;points:BayPoint[];legs?:{mode:'land'|'ferry';points:BayPoint[];name?:string}[]};
export type UnifiedSceneProgress={x:number;z:number;heading:number;speed:number;region:BayRegionId|null;remaining:number;travelMode:'land'|'ferry'};
export type UnifiedBaySceneProps={
  mode:'walk'|'drive'|'overview';running:boolean;golden:boolean;input:MutableRefObject<SfMovementInput>;
  selectedKey:string|null;focusCommand?:{id:number;key?:string;overview?:boolean};spawnCommand?:{id:number;key:string};
  navigation?:UnifiedSceneNavigation|null;autoTravel:boolean;locale:'en'|'zh';visitedKeys:readonly string[];cameraCommand?:SfCameraCommand;
  onSelect:(key:string)=>void;onArrival:(key:string|null)=>void;onVisit?:(key:string)=>void;
  onProgress?:(progress:UnifiedSceneProgress)=>void;onNavigationComplete?:()=>void;onManualInput?:()=>void;onReady:()=>void;onError:()=>void;
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
    return legs.filter(leg=>leg.points.length>1).map(leg=>({mode:leg.mode,geometry:createRoadGeometry([{path:leg.points,width:.32}],(x,z)=>leg.mode==='ferry'?-.29:bayHeight(x,z),0,.11)}));
  },[navigation]);
  useEffect(()=>()=>geometry.forEach(item=>item.geometry.dispose()),[geometry]);
  return <group>{geometry.map((item,i)=><mesh key={i} geometry={item.geometry} renderOrder={3}><meshBasicMaterial color={item.mode==='ferry'?'#f4e7b5':'#f6cb70'} side={THREE.DoubleSide} depthWrite={false}/></mesh>)}</group>;
}

function BayActor({props,stateRef,destinationRef,ferryRef}:{props:UnifiedBaySceneProps;stateRef:MutableRefObject<SfWalkerState>;destinationRef:MutableRefObject<{x:number;z:number}|null>;ferryRef:MutableRefObject<boolean>}){
  const actor=useRef<THREE.Group>(null),otter=useRef<THREE.Group>(null),car=useRef<THREE.Group>(null),boat=useRef<THREE.Group>(null);
  const keys=useRef(emptyInput()),forward=useRef(new THREE.Vector3()),locomotion=useRef<BayBayLocomotion>({speed:0,distance:0,turn:0});
  const near=useRef<string|null>(null),reported=useRef(new Set<string>()),index=useRef(1),aborted=useRef(false),completed=useRef(false),lastReport=useRef(-1),manualActive=useRef(false);
  const {camera,gl}=useThree();
  const route=useMemo(()=>navigationPoints(props.navigation),[props.navigation]);
  const remaining=useMemo(()=>{const result=route.map(()=>0);for(let i=route.length-2;i>=0;i--)result[i]=result[i+1]+length(route[i].point,route[i+1].point);return result;},[route]);
  useEffect(()=>{index.current=1;aborted.current=false;completed.current=false;destinationRef.current=null;},[props.navigation,destinationRef]);
  useEffect(()=>{if(props.autoTravel)aborted.current=false;},[props.autoTravel]);
  useEffect(()=>{reported.current.clear();},[props.onVisit]);
  useEffect(()=>{
    if(!props.spawnCommand)return;
    const spawn=baySpawn(props.spawnCommand.key);stateRef.current=createSfWalkerState(spawn.x,spawn.z,spawn.heading);destinationRef.current=null;near.current=null;ferryRef.current=false;keys.current=emptyInput();aborted.current=true;props.onArrival(null);
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
  useFrame(({clock},delta)=>{
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
    if(clock.elapsedTime-lastReport.current>.2){lastReport.current=clock.elapsedTime;const rest=route.length&&!completed.current?Math.hypot(s.x-route[Math.min(index.current,route.length-1)].point[0],s.z-route[Math.min(index.current,route.length-1)].point[1])+(remaining[Math.min(index.current,route.length-1)]||0):0;props.onProgress?.({x:s.x,z:s.z,heading:s.heading,speed:s.speed,region:bayRegionAt(s.x,s.z),remaining:rest,travelMode:onBoat?'ferry':'land'});}
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
    if(props.focusCommand.overview)fitWholeBay();else {const place=UNIFIED_BAY_PLACES.find(p=>p.key===props.focusCommand?.key);if(place){const [x,z]=place.position,fit=Math.max(1,Math.min(1.4,size.height/size.width)),distance=place.sf?.cameraDistance||21;target.current.set(x,bayHeight(x,z)+1,z);position.current.copy(target.current).add(new THREE.Vector3(distance*.4*fit,distance*.62*fit,distance*.68*fit));focusOverride.current=true;}}
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
    if(moving.current){const blend=1-Math.exp(-Math.min(delta,.05)*6);camera.position.lerp(position.current,blend);c.target.lerp(target.current,blend);if(camera.position.distanceTo(position.current)<.06)moving.current=false;else invalidate();}focusTargetRef.current.copy(c.target);c.update();
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.1} enablePan={props.mode==='overview'} minDistance={8} maxDistance={3600} minPolarAngle={.15} maxPolarAngle={1.27} rotateSpeed={.5} zoomSpeed={.8} touches={{ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_ROTATE}} onStart={()=>{moving.current=false;}}/>;
}

function Landmark({place,props,guard}:{place:UnifiedPlace;props:UnifiedBaySceneProps;guard:ReturnType<typeof createSfCameraGestureGuard>}){
  const full=useRef<THREE.Group>(null),proxy=useRef<THREE.Group>(null),position=useMemo(()=>new THREE.Vector3(place.position[0],bayHeight(...place.position),place.position[1]),[place]);
  useFrame(({camera})=>{const distance=camera.position.distanceTo(position),near=distance<125||props.selectedKey===place.key&&distance<190;if(full.current)full.current.visible=near;if(proxy.current){proxy.current.visible=!near;proxy.current.scale.setScalar(distance>300?place.region==='sf'?1.5:3.8:1.6);}});
  const color=BAY_REGIONS.find(region=>region.id===place.region)?.color||'#a8b89a';
  return <group position={position} onClick={event=>{event.stopPropagation();if(event.delta<5&&guard.allowsClick())props.onSelect(place.key);}}>
    <group ref={full} scale={place.modelScale}>
      {place.sf?place.id==='bridge'?<mesh position={[0,.6,0]}><cylinderGeometry args={[.5,.6,1.2,10]}/><meshStandardMaterial color="#bc795a"/></mesh>:<LandmarkModel kind={place.id} animated={props.running&&props.selectedKey===place.key}/>:place.regional?<RegionalLandmarkModel place={place.regional}/>:null}
    </group>
    <group ref={proxy}><mesh position={[0,1.2,0]}><boxGeometry args={[2.7,2.4,2.4]}/><meshStandardMaterial color={color} roughness={.9}/></mesh><mesh position={[0,2.5,0]}><boxGeometry args={[2.9,.23,2.65]}/><meshStandardMaterial color="#f0dfbb"/></mesh><mesh position={[-.7,3.4,-.3]}><boxGeometry args={[.68,1.8,.68]}/><meshStandardMaterial color={color} roughness={.9}/></mesh></group>
    {props.selectedKey===place.key&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.12,0]}><ringGeometry args={[Math.max(2,place.arrivalRadius),Math.max(2,place.arrivalRadius)+.18,40]}/><meshBasicMaterial color="#f4c774" transparent opacity={.85} depthWrite={false}/></mesh>}
  </group>;
}

function WorldLabels({props,focusTargetRef}:{props:UnifiedBaySceneProps;focusTargetRef:MutableRefObject<THREE.Vector3>}){
  const {camera,size}=useThree(),last=useRef(-1),signature=useRef(''),[visible,setVisible]=useState<{keys:string[];regions:boolean}>({keys:[],regions:true}),project=useMemo(()=>new THREE.Vector3(),[]);
  useFrame(({clock})=>{
    if(clock.elapsedTime-last.current<.25)return;last.current=clock.elapsedTime;
    const distance=camera.position.distanceTo(focusTargetRef.current),regions=distance>180,limit=regions?0:(size.width<640?5:10),occupied:{x:number;y:number}[]=[],keys:string[]=[];
    const candidates=[...UNIFIED_BAY_PLACES].sort((a,b)=>a.key===props.selectedKey?-1:b.key===props.selectedKey?1:Math.hypot(a.position[0]-focusTargetRef.current.x,a.position[1]-focusTargetRef.current.z)-Math.hypot(b.position[0]-focusTargetRef.current.x,b.position[1]-focusTargetRef.current.z));
    for(const place of candidates){if(keys.length>=limit)break;project.set(place.position[0],bayHeight(...place.position)+4,place.position[1]).project(camera);if(project.z<0||project.z>1||Math.abs(project.x)>.9||Math.abs(project.y)>.77)continue;
      const point={x:(project.x+1)*size.width/2,y:(1-project.y)*size.height/2};if(occupied.some(p=>Math.abs(p.x-point.x)<(regions?170:145)&&Math.abs(p.y-point.y)<45))continue;occupied.push(point);keys.push(place.key);
    }
    const next=`${regions}:${keys.join(',')}`;if(next!==signature.current){signature.current=next;setVisible({keys,regions});}
  });
  return <group>{visible.regions&&BAY_REGIONS.map(region=>{const point=BAY_REGION_CENTERS[region.id];return <Html key={region.id} center position={[point[0],3,point[1]]} zIndexRange={[2,1]}><button type="button" className="unified-region-label" onPointerDown={event=>event.stopPropagation()} onClick={()=>props.onSelect(BAY_REGION_FOCI[region.id])} aria-label={props.locale==='en'?`Explore ${region.en}`:`探索${region.zh}`} style={{display:'block',minHeight:44,color:'#285f58',background:'#fff8e8e8',padding:'6px 12px',border:'1px solid #fff9e9',borderRadius:22,fontFamily:'inherit',fontWeight:700,fontSize:size.width<640?11:14,whiteSpace:'nowrap',letterSpacing:'.04em',cursor:'pointer'}}>{props.locale==='en'?region.en:region.zh}</button></Html>;})}
    {visible.regions&&size.width>=640&&BAY_BRIDGES.map(bridge=>{const a=bridge.path[0],b=bridge.path[bridge.path.length-1],point:BayPoint=[(a[0]+b[0])/2,(a[1]+b[1])/2];return <Html key={bridge.id} center position={[point[0],2,point[1]]} zIndexRange={[1,0]} style={{pointerEvents:'none'}}><span style={{display:'block',padding:'3px 6px',borderRadius:6,color:'#496a60',background:'#e9ebd6bf',fontSize:9,whiteSpace:'nowrap',fontFamily:'inherit'}}>{props.locale==='en'?bridge.nameEn:bridge.name}</span></Html>;})}
    {visible.keys.map(key=>{const place=UNIFIED_BAY_PLACES.find(p=>p.key===key)!,selected=key===props.selectedKey,visited=props.visitedKeys.includes(key),height=place.sf?.markerHeight||4;return <Html key={key} center position={[place.position[0],bayHeight(...place.position)+height,place.position[1]]} zIndexRange={selected?[4,3]:[3,2]}><button type="button" className={`unified-place-label${selected?' is-selected':''}`} aria-label={props.locale==='en'?place.titleEn:place.title} aria-pressed={selected} onPointerDown={event=>event.stopPropagation()} onClick={()=>props.onSelect(key)} style={{minHeight:36,maxWidth:190,border:'1px solid #fff9eacc',borderRadius:18,padding:'5px 10px',background:selected?'#2b766b':'#fff8e6ed',color:selected?'#fff8e6':'#35685d',fontFamily:'inherit',fontSize:11,fontWeight:600,cursor:'pointer',boxShadow:'0 2px 8px #234e3620',whiteSpace:'nowrap',textOverflow:'ellipsis',overflow:'hidden'}}>{visited?'✓ ':selected?'◆ ':''}{props.locale==='en'?place.titleEn:place.title}</button></Html>;})}</group>;
}

function UnifiedWorld(props:UnifiedBaySceneProps){
  const initial=useMemo(()=>baySpawn('sf:park'),[]),stateRef=useRef(createSfWalkerState(initial.x,initial.z,initial.heading)),destinationRef=useRef<{x:number;z:number}|null>(null),ferryRef=useRef(false),focusTargetRef=useRef(new THREE.Vector3()),gesture=useMemo(()=>createSfCameraGestureGuard(),[]);
  const {gl}=useThree(),{onReady,onError,locale}=props;
  useEffect(()=>{const canvas=gl.domElement;canvas.setAttribute('tabindex','0');canvas.setAttribute('aria-label',locale==='en'?'One Bay Area world. WASD to move; drag to orbit.':'完整湾区。WASD 移动，拖动调整视角。');const stop=observeSfCameraGestures(canvas,gesture),focus=()=>canvas.focus({preventScroll:true}),error=()=>onError();canvas.addEventListener('pointerdown',focus);canvas.addEventListener('webglcontextlost',error);onReady();return()=>{stop();canvas.removeEventListener('pointerdown',focus);canvas.removeEventListener('webglcontextlost',error);};},[gl,gesture,onReady,onError,locale]);
  return <>
    <color attach="background" args={[props.golden?'#e9e1cb':'#dce8df']}/><fog attach="fog" args={[props.golden?'#e9e1cb':'#dce8df',2200,4000]}/>
    <ambientLight intensity={1.2}/><hemisphereLight args={['#fff1d7','#7e9785',1.3]}/><directionalLight position={[-120,300,180]} intensity={props.golden?2.4:2.0} color={props.golden?'#ffe0a4':'#fff6e6'}/>
    <UnifiedBayWater running={props.running}/><UnifiedBayGround onWalk={(x,z)=>{if(props.running&&props.mode!=='overview'&&gesture.allowsClick()&&bayCanMove(x,z)){props.onManualInput?.();destinationRef.current={x,z};}}}/><UnifiedBayBridges/><UnifiedBayScenery/>
    <NavigationRibbon navigation={props.navigation}/>
    {UNIFIED_BAY_PLACES.map(place=><Landmark key={place.key} place={place} props={props} guard={gesture}/>)}
    <WorldLabels props={props} focusTargetRef={focusTargetRef}/><BayActor props={props} stateRef={stateRef} destinationRef={destinationRef} ferryRef={ferryRef}/><UnifiedCamera props={props} stateRef={stateRef} focusTargetRef={focusTargetRef}/>
  </>;
}

export default function UnifiedBayScene(props:UnifiedBaySceneProps){
  return <Canvas dpr={[1,1.5]} frameloop={props.running?'always':'demand'} camera={{position:[0,800,600],fov:43,near:2,far:6000}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}}><UnifiedWorld {...props}/></Canvas>;
}
