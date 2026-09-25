/** @jsxImportSource react */
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { BayBayModel, BuggyModel, type BayBayLocomotion } from './SanFranciscoModels';
import { createTerrainGeometry, createRoadGeometry, createShoreGeometry } from './san-francisco-geometry';
import { createSfWalkerState, stepSfWalker, type SfWalkerState } from './sf-walking';
import { sfCameraRelativeDirection, type SfMovementInput } from './sf-movement-input';
import { createSfCameraGestureGuard, observeSfCameraGestures, adjustSfCamera, type SfCameraCommand } from './sf-camera';
import { projectRegional, regionalContains, regionalHeight, regionalArrival, regionalSpawn, type RegionalWorld } from './regional-world';
import { RegionalLandmarkModel } from './regional-models';

export type RegionalSceneProps = {
  world: RegionalWorld; mode: 'walk'|'drive'|'overview'; running: boolean; golden: boolean;
  input: MutableRefObject<SfMovementInput>; selectedId: string|null; startId: string; resetToken: number;
  onSelect: (id:string)=>void; onArrival: (id:string|null)=>void; onVisit?: (id:string)=>void;
  onReady: ()=>void; onError: ()=>void; locale: 'en'|'zh'; visitedIds: readonly string[]; cameraCommand?: SfCameraCommand;
};
const emptyInput=():SfMovementInput=>({forward:false,backward:false,left:false,right:false});
const hash=(a:number,b:number)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};

function Scenery({world}:{world:RegionalWorld}){
  const houses=useRef<THREE.InstancedMesh>(null),roofs=useRef<THREE.InstancedMesh>(null),trees=useRef<THREE.InstancedMesh>(null),trunks=useRef<THREE.InstancedMesh>(null);
  const points=useMemo(()=>{
    const anchors=world.places.map(p=>projectRegional(world,p.coordinate));
    const spawns=world.places.map(p=>regionalSpawn(world,p.id));
    const roadSegments=world.roads.flatMap(road=>road.path.slice(1).map((p,i)=>[projectRegional(world,road.path[i]),projectRegional(world,p)]));
    const nearRoad=(x:number,z:number)=>roadSegments.some(([a,b])=>{const dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz;const t=length?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/length)):0;return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<1.5;});
    const homes:{x:number;z:number;height:number;color:string}[]=[],grove:{x:number;z:number;s:number}[]=[];
    anchors.forEach(([ax,az],j)=>{
      for(let i=0;i<32;i++){
        const angle=hash(i,j)*Math.PI*2,radius=6+hash(i+80,j)*11;
        const x=ax+Math.cos(angle)*radius,z=az+Math.sin(angle)*radius;
        if(!regionalContains(world,x,z)||anchors.some(p=>Math.hypot(x-p[0],z-p[1])<5)||spawns.some(p=>Math.hypot(x-p.x,z-p.z)<3.4)||nearRoad(x,z))continue;
        if(i%3===0)homes.push({x,z,height:.7+hash(i+2,j)*.8,color:['#d6b995','#c6c6a3','#a8b8a0','#d1ad99'][i%4]});
        else grove.push({x,z,s:.65+hash(i+3,j)*.6});
      }
    });
    return {homes,grove};
  },[world]);
  useLayoutEffect(()=>{
    const obj=new THREE.Object3D(),color=new THREE.Color();
    points.homes.forEach((home,i)=>{const y=regionalHeight(world,home.x,home.z);obj.position.set(home.x,y+home.height/2,home.z);obj.scale.set(1.15,home.height,.95);obj.updateMatrix();houses.current?.setMatrixAt(i,obj.matrix);houses.current?.setColorAt(i,color.set(home.color));obj.position.y=y+home.height+.12;obj.scale.set(1.28,.23,1.1);obj.updateMatrix();roofs.current?.setMatrixAt(i,obj.matrix);});
    points.grove.forEach((tree,i)=>{const y=regionalHeight(world,tree.x,tree.z);obj.position.set(tree.x,y+tree.s*.5,tree.z);obj.scale.set(.15,tree.s,.15);obj.updateMatrix();trunks.current?.setMatrixAt(i,obj.matrix);obj.position.y=y+tree.s*1.2;obj.scale.set(tree.s*.55,tree.s*.85,tree.s*.55);obj.updateMatrix();trees.current?.setMatrixAt(i,obj.matrix);trees.current?.setColorAt(i,color.set(i%3?'#91a981':'#b1bd91'));});
    for(const ref of [houses,roofs,trees,trunks])if(ref.current){ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();}
  },[points,world]);
  return <group>
    <instancedMesh ref={houses} args={[undefined,undefined,points.homes.length]} receiveShadow><boxGeometry/><meshStandardMaterial roughness={.95}/></instancedMesh>
    <instancedMesh ref={roofs} args={[undefined,undefined,points.homes.length]}><boxGeometry/><meshStandardMaterial color="#a88467" roughness={.95}/></instancedMesh>
    <instancedMesh ref={trunks} args={[undefined,undefined,points.grove.length]}><cylinderGeometry args={[1,1.1,1,5]}/><meshStandardMaterial color="#a68365"/></instancedMesh>
    <instancedMesh ref={trees} args={[undefined,undefined,points.grove.length]}><icosahedronGeometry args={[1,1]}/><meshStandardMaterial roughness={1}/></instancedMesh>
  </group>;
}

function RegionalGround({world,onWalk}:{world:RegionalWorld;onWalk:(x:number,z:number)=>void}){
  const geometry=useMemo(()=>{
    const boundary=world.land.map(point=>projectRegional(world,point));
    const rings=[[...boundary,boundary[0]]];
    const height=(x:number,z:number)=>regionalHeight(world,x,z);
    return {land:createTerrainGeometry(rings,height),shore:createShoreGeometry(rings,height),roads:createRoadGeometry(world.roads.filter(r=>!r.rail).map(r=>({path:r.path.map(p=>projectRegional(world,p)),width:.8})),height,0,.075),rail:createRoadGeometry(world.roads.filter(r=>r.rail).map(r=>({path:r.path.map(p=>projectRegional(world,p)),width:.25})),height,0,.09)};
  },[world]);
  useEffect(()=>()=>Object.values(geometry).forEach(item=>item.dispose()),[geometry]);
  return <group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.65,0]}><planeGeometry args={[700,700]}/><meshStandardMaterial color="#82b8b8" roughness={.58}/></mesh>
    <group onClick={event=>{event.stopPropagation();if(event.delta<5)onWalk(event.point.x,event.point.z);}}>
      <mesh geometry={geometry.land} receiveShadow><meshStandardMaterial color="#d8d5b5" roughness={1} side={THREE.DoubleSide}/></mesh>
      <mesh geometry={geometry.shore}><meshStandardMaterial color="#c9b394" roughness={1} side={THREE.DoubleSide}/></mesh>
      <mesh geometry={geometry.roads} receiveShadow><meshStandardMaterial color="#b4bba8" roughness={1} side={THREE.DoubleSide}/></mesh>
      <mesh geometry={geometry.rail}><meshStandardMaterial color="#8c8270" roughness={1} side={THREE.DoubleSide}/></mesh>
    </group>
    {world.roads.map(road=>{const p=projectRegional(world,road.path[Math.floor(road.path.length/2)]);return <Html key={road.name} position={[p[0],regionalHeight(world,...p)+.2,p[1]]} center zIndexRange={[1,0]} style={{pointerEvents:'none'}}><span className="regional-road-label">{road.name}</span></Html>;})}
  </group>;
}

function RegionalPlayer({props,stateRef,destinationRef}:{props:RegionalSceneProps;stateRef:MutableRefObject<SfWalkerState>;destinationRef:MutableRefObject<{x:number;z:number}|null>}){
  const actor=useRef<THREE.Group>(null),keys=useRef(emptyInput()),forward=useRef(new THREE.Vector3());
  const locomotion=useRef<BayBayLocomotion>({speed:0,distance:0,turn:0});
  const near=useRef<string|null>(null),reported=useRef(new Set<string>());
  const {camera,gl}=useThree();
  useEffect(()=>{reported.current.clear();},[props.onVisit]);
  useEffect(()=>{
    const spawn=regionalSpawn(props.world,props.startId);stateRef.current=createSfWalkerState(spawn.x,spawn.z,Math.PI);
    destinationRef.current=null;near.current=null;keys.current=emptyInput();locomotion.current={speed:0,distance:0,turn:0};props.onArrival(null);
    // Ref-backed movement does not trigger a React render on each animation frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[props.world,props.startId,props.resetToken]);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      const map:Record<string,'forward'|'backward'|'left'|'right'>={w:'forward',ArrowUp:'forward',s:'backward',ArrowDown:'backward',a:'left',ArrowLeft:'left',d:'right',ArrowRight:'right'};
      const action=map[event.key]||map[event.key.toLowerCase()];if(!action)return;
      // Releasing a movement key must stop it even if focus moved into a menu.
      if(event.type==='keyup'){keys.current[action]=false;return;}
      if((event.target as HTMLElement)?.closest('input,textarea,select,[role="dialog"],[contenteditable="true"]')||!gl.domElement.closest('.regional-stage')?.contains(document.activeElement))return;
      if(props.running&&props.mode!=='overview'){event.preventDefault();keys.current[action]=true;}
    };
    const clear=()=>{keys.current=emptyInput();};
    window.addEventListener('keydown',key);window.addEventListener('keyup',key);window.addEventListener('blur',clear);
    return()=>{window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);window.removeEventListener('blur',clear);clear();};
  },[props.running,props.mode,gl]);
  useFrame((_,delta)=>{
    camera.getWorldDirection(forward.current);
    const combined={...props.input.current,forward:keys.current.forward||props.input.current.forward,backward:keys.current.backward||props.input.current.backward,left:keys.current.left||props.input.current.left,right:keys.current.right||props.input.current.right};
    const direction=sfCameraRelativeDirection(combined,forward.current);
    if(Math.hypot(direction.x,direction.z)>.01)destinationRef.current=null;
    stateRef.current=stepSfWalker(stateRef.current,direction,delta,{active:props.running&&props.mode!=='overview',maxSpeed:props.mode==='drive'?13:4.8,canMove:(x,z)=>regionalContains(props.world,x,z),destination:destinationRef.current});
    const s=stateRef.current;
    if(destinationRef.current&&Math.hypot(destinationRef.current.x-s.x,destinationRef.current.z-s.z)<.06)destinationRef.current=null;
    if(actor.current){actor.current.position.set(s.x,regionalHeight(props.world,s.x,s.z)+.03,s.z);actor.current.rotation.y=s.heading;}
    locomotion.current={speed:s.speed,distance:s.distance,turn:s.turn};
    if(props.mode==='overview'||!props.running)return;
    const place=regionalArrival(props.world,s.x,s.z),id=place?.id||null;
    if(id!==near.current){near.current=id;props.onArrival(id);}
    // Selection and fast travel do not stamp: the player has to walk/drive into range.
    if(place&&s.distance>.08&&!reported.current.has(place.id)){reported.current.add(place.id);props.onVisit?.(place.id);}
  });
  return <group ref={actor} visible={props.mode!=='overview'}>{props.mode==='drive'?<BuggyModel/>:<BayBayModel scale={1.05} locomotion={locomotion}/>}<mesh rotation={[-Math.PI/2,0,0]} position={[0,.035,0]}><circleGeometry args={[props.mode==='drive'?.95:.48,24]}/><meshBasicMaterial color="#46664d" transparent opacity={.2} depthWrite={false}/></mesh></group>;
}

function RegionalCamera({props,stateRef,destinationRef}:{props:RegionalSceneProps;stateRef:MutableRefObject<SfWalkerState>;destinationRef:MutableRefObject<{x:number;z:number}|null>}){
  const controls=useRef<OrbitControlsImpl>(null),target=useRef(new THREE.Vector3()),position=useRef(new THREE.Vector3()),moving=useRef(true),offset=useRef(new THREE.Vector3());
  const {camera,size,invalidate}=useThree();
  const limits={minDistance:7,maxDistance:props.mode==='overview'?480:45,minPolar:.2,maxPolar:1.25};
  const reset=useRef(()=>{});
  useEffect(()=>{
    reset.current=()=>{
      const place=props.world.places.find(p=>p.id===props.selectedId);
      const fit=Math.max(1,Math.min(1.75,size.height/size.width));
      if(props.mode==='overview'&&!place){const xs=props.world.land.map(p=>projectRegional(props.world,p));const radius=Math.max(...xs.map(p=>Math.hypot(...p)))*fit;target.current.set(0,0,0);position.current.set(radius*.6,radius*1.3,radius*.9);}
      else {const p=props.mode==='overview'&&place?projectRegional(props.world,place.coordinate):[stateRef.current.x,stateRef.current.z];const y=regionalHeight(props.world,p[0],p[1]);target.current.set(p[0],y+.8,p[1]);position.current.set(p[0]+8*fit,y+12*fit,p[1]+13*fit);}
      moving.current=true;
    };reset.current();
  },[props.mode,props.selectedId,props.world,props.startId,props.resetToken,size.width,size.height,stateRef]);
  useEffect(()=>{
    if(!props.cameraCommand||!controls.current)return;
    if(props.cameraCommand.action==='reset'){reset.current();return;}
    const vector=camera.position.clone().sub(controls.current.target),s=new THREE.Spherical().setFromVector3(vector);
    const next=adjustSfCamera({azimuth:s.theta,polar:s.phi,distance:s.radius},props.cameraCommand.action,{minDistance:7,maxDistance:props.mode==='overview'?480:45,minPolar:.2,maxPolar:1.25});
    target.current.copy(controls.current.target);position.current.copy(target.current).add(vector.setFromSphericalCoords(next.distance,next.polar,next.azimuth));moving.current=true;
  },[props.cameraCommand,props.mode,camera]);
  useFrame((_,delta)=>{
    const c=controls.current;if(!c)return;
    if(props.mode!=='overview'){
      const p=stateRef.current;offset.current.set(p.x,regionalHeight(props.world,p.x,p.z)+.8,p.z);
      if(moving.current){offset.current.sub(target.current);target.current.add(offset.current);position.current.add(offset.current);}
      else {offset.current.sub(c.target).multiplyScalar(1-Math.exp(-Math.min(delta,.05)*9));c.target.add(offset.current);camera.position.add(offset.current);}
    }
    if(moving.current){const blend=1-Math.exp(-Math.min(delta,.05)*7);camera.position.lerp(position.current,blend);c.target.lerp(target.current,blend);if(camera.position.distanceTo(position.current)<.04)moving.current=false;else invalidate();}
    c.update();
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.09} enablePan={props.mode==='overview'} minDistance={limits.minDistance} maxDistance={limits.maxDistance} minPolarAngle={limits.minPolar} maxPolarAngle={limits.maxPolar} rotateSpeed={.55} zoomSpeed={.7} touches={{ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_ROTATE}} onStart={()=>{moving.current=false;destinationRef.current=null;}}/>;
}

function RegionalWorldScene(props:RegionalSceneProps){
  const spawn=regionalSpawn(props.world,props.startId),stateRef=useRef(createSfWalkerState(spawn.x,spawn.z,Math.PI)),destinationRef=useRef<{x:number;z:number}|null>(null);
  const gesture=useMemo(()=>createSfCameraGestureGuard(),[]),{gl}=useThree();
  const {locale,onReady,onError}=props;
  useEffect(()=>{const canvas=gl.domElement;canvas.setAttribute('tabindex','0');canvas.setAttribute('aria-label',locale==='en'?'Explore with WASD; drag to orbit':'WASD 移动，拖动调整视角');const stop=observeSfCameraGestures(canvas,gesture);const focus=()=>canvas.focus({preventScroll:true});const error=()=>onError();canvas.addEventListener('pointerdown',focus);canvas.addEventListener('webglcontextlost',error);onReady();return()=>{stop();canvas.removeEventListener('pointerdown',focus);canvas.removeEventListener('webglcontextlost',error);};},[gl,gesture,onReady,onError,locale]);
  return <>
    <color attach="background" args={[props.golden?'#ece4cf':'#dce8e2']}/><fog attach="fog" args={[props.golden?'#ece4cf':'#dce8e2',180,520]}/>
    <ambientLight intensity={1.2}/><hemisphereLight args={['#fff4de','#8c9c86',1.3]}/><directionalLight position={[-40,85,30]} intensity={props.golden?2.6:2.1} color={props.golden?'#ffdb9d':'#fff7e7'}/>
    <RegionalGround world={props.world} onWalk={(x,z)=>{if(props.running&&props.mode!=='overview'&&gesture.allowsClick()&&regionalContains(props.world,x,z))destinationRef.current={x,z};}}/>
    <Scenery world={props.world}/>
    {props.world.places.map(place=>{const p=projectRegional(props.world,place.coordinate),y=regionalHeight(props.world,...p);const visited=props.visitedIds.includes(place.id);return <group key={place.id} position={[p[0],y,p[1]]}>
      <group onClick={event=>{event.stopPropagation();if(event.delta<5&&gesture.allowsClick())props.onSelect(place.id);}}><RegionalLandmarkModel place={place}/></group>
      <Html center position={[0,place.kind==='campus'?5.1:3.5,0]} zIndexRange={[3,1]}><button className={`regional-place-label${props.selectedId===place.id?' is-selected':''}${visited?' is-visited':''}`} onPointerDown={event=>event.stopPropagation()} onClick={()=>props.onSelect(place.id)}>{visited?<span aria-label={props.locale==='en'?'Visited':'已到访'}>✓</span>:<i/>}{props.locale==='en'?place.titleEn:place.title}</button></Html>
      {visited&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,.19,0]}><ringGeometry args={[2.7,2.77,40]}/><meshBasicMaterial color="#428e7d" transparent opacity={.65} depthWrite={false}/></mesh>}
    </group>;})}
    <RegionalPlayer props={props} stateRef={stateRef} destinationRef={destinationRef}/><RegionalCamera props={props} stateRef={stateRef} destinationRef={destinationRef}/>
  </>;
}

export default function RegionalBayScene(props:RegionalSceneProps){
  return <Canvas dpr={[1,1.5]} frameloop={props.running?'always':'demand'} camera={{position:[18,25,28],fov:44,near:.1,far:1000}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}}><RegionalWorldScene {...props}/></Canvas>;
}
