/** @jsxImportSource react */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BAY_BRIDGES, BAY_FERRY_ROUTES, BAY_LAND_AREAS, BAY_ROADS, UNIFIED_BAY_PLACES, bayContains, bayHeight, projectBay, type BayPoint } from './unified-bay-world';
import { createRoadGeometry, createShoreGeometry, mapHash } from './san-francisco-geometry';
import { sfVisualRoads } from './sf-city-scenery';
import { SealionsModel } from './SanFranciscoModels';
import UrbanFabric from './UrbanFabric';

type BoxPart={p:[number,number,number];s:[number,number,number];color:string;angle?:number};
function Boxes({parts}:{parts:BoxPart[]}) {
  const mesh=useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(()=>{const object=new THREE.Object3D(),color=new THREE.Color();parts.forEach((part,i)=>{object.position.set(...part.p);object.scale.set(...part.s);object.rotation.set(0,part.angle||0,0);object.updateMatrix();mesh.current?.setMatrixAt(i,object.matrix);mesh.current?.setColorAt(i,color.set(part.color));});if(mesh.current){mesh.current.instanceMatrix.needsUpdate=true;if(mesh.current.instanceColor)mesh.current.instanceColor.needsUpdate=true;mesh.current.computeBoundingSphere();}},[parts]);
  return <instancedMesh ref={mesh} args={[undefined,undefined,parts.length]}><boxGeometry/><meshStandardMaterial roughness={.92}/></instancedMesh>;
}

/** A coarser adaptive surface is enough for a 70 km diorama; city geometry keeps its own detail. */
function bayTerrain() {
  const positions:number[]=[],colors:number[]=[];
  const sand=new THREE.Color('#c4cda1'),hill=new THREE.Color('#85a773'),color=new THREE.Color();
  const forests=[[-122.39,37.44,27,65],[-122.13,37.75,18,56],[-122.42,37.62,19,42],[-122.54,37.88,22,40],[-122.05,37.26,44,27],[-122.40,37.25,30,45]].map(([lng,lat,rx,rz])=>({point:projectBay([lng,lat]),rx,rz}));
  const triangle=(a:BayPoint,b:BayPoint,c:BayPoint,depth=0)=>{
    const points=[a,b,c],lengths=points.map((p,i)=>Math.hypot(p[0]-points[(i+1)%3][0],p[1]-points[(i+1)%3][1]));
    const largest=Math.max(...lengths);
    if(largest>7&&depth<17){const i=lengths.indexOf(largest),p=points[i],q=points[(i+1)%3],r=points[(i+2)%3],middle:BayPoint=[(p[0]+q[0])/2,(p[1]+q[1])/2];triangle(p,middle,r,depth+1);triangle(middle,q,r,depth+1);return;}
    for(const p of [a,c,b]){const y=bayHeight(...p);positions.push(p[0],y,p[1]);const grove=Math.max(...forests.map(f=>Math.exp(-Math.pow((p[0]-f.point[0])/f.rx,2)-Math.pow((p[1]-f.point[1])/f.rz,2))));color.copy(sand).lerp(hill,Math.min(.8,Math.max(grove*.75,(y-.3)/5)));colors.push(color.r,color.g,color.b);}
  };
  for(const land of BAY_LAND_AREAS){const ring=land.ring;for(const face of THREE.ShapeUtils.triangulateShape(ring.map(p=>new THREE.Vector2(...p)),[]))triangle(ring[face[0]],ring[face[1]],ring[face[2]]);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();return geometry;
}

export function UnifiedBayGround({onWalk}:{onWalk:(x:number,z:number)=>void}) {
  const geometry=useMemo(()=>{
    const streets=sfVisualRoads().avenues.map(road=>({width:road.width,path:road.path.map(p=>[p[0]-220,p[1]-189.21] as BayPoint)}));
    const roads=BAY_ROADS.filter(road=>road.kind==='road');
    return {land:bayTerrain(),shore:createShoreGeometry(BAY_LAND_AREAS.map(land=>land.ring),bayHeight),roads:createRoadGeometry(roads,bayHeight,0,.035),streets:createRoadGeometry(streets,bayHeight,0,.038),decks:createRoadGeometry(BAY_BRIDGES,bayHeight,0,.025)};
  },[]);
  useEffect(()=>()=>Object.values(geometry).forEach(item=>item.dispose()),[geometry]);
  return <group onClick={event=>{event.stopPropagation();if(event.delta<5)onWalk(event.point.x,event.point.z);}}>
    <mesh geometry={geometry.land} receiveShadow><meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide}/></mesh>
    <mesh geometry={geometry.shore}><meshStandardMaterial color="#bcb697" roughness={1} side={THREE.DoubleSide}/></mesh>
    <mesh geometry={geometry.roads}><meshStandardMaterial color="#c5b78f" roughness={1} side={THREE.DoubleSide}/></mesh>
    <mesh geometry={geometry.streets}><meshStandardMaterial color="#bcc4ad" roughness={1} side={THREE.DoubleSide}/></mesh>
    <mesh geometry={geometry.decks}><meshStandardMaterial color="#be9c75" roughness={.9} side={THREE.DoubleSide}/></mesh>
  </group>;
}

export function UnifiedBayBridges() {
  const parts=useMemo(()=>BAY_BRIDGES.flatMap(bridge=>{
    const boxes:BoxPart[]=[],red=bridge.id.includes('golden'),color=red?'#bc795a':'#b7bcae';
    bridge.path.slice(1).forEach((b,i)=>{
      const a=bridge.path[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=Math.atan2(b[0]-a[0],b[1]-a[1]),nx=Math.cos(angle),nz=-Math.sin(angle);
      const p=(along:number,side=0):[number,number,number]=>[a[0]+(b[0]-a[0])*along+nx*side,bridge.height,a[1]+(b[1]-a[1])*along+nz*side];
      for(const side of [-1,1]) {const pos=p(.5,bridge.width*.47*side);boxes.push({p:[pos[0],pos[1]+.22,pos[2]],s:[.09,.12,length],color,angle});}
      const segments=Math.max(1,Math.floor(length/9));
      for(let j=1;j<=segments;j++){const pos=p(j/(segments+1));boxes.push({p:[pos[0],bridge.height/2-.3,pos[2]],s:[.46,bridge.height+.6,bridge.width*.8],color:'#a3b3a5',angle});}
      if(red||bridge.id.includes('bay-bridge'))for(const along of [.25,.75]){
        const top=red?8:6.2;
        for(const side of [-1,1]){const pos=p(along,bridge.width*.55*side);boxes.push({p:[pos[0],bridge.height+top/2,pos[2]],s:[.32,top,.42],color,angle});}
        const pos=p(along);boxes.push({p:[pos[0],bridge.height+top-.4,pos[2]],s:[bridge.width*1.25,.3,.38],color,angle});
        // Cable strands use narrow segments and share one instanced draw call.
        for(const side of [-1,1])for(let k=0;k<16;k++){
          const t1=Math.max(0,along-.25)+k/16*.5,t2=t1+.5/16;
          const y=(t:number)=>.6+(top-.65)*Math.pow(1-Math.min(1,Math.abs(t-along)/.25),2);
          const a3=p(t1,side*bridge.width*.55),b3=p(t2,side*bridge.width*.55),height=(y(t1)+y(t2))/2;
          boxes.push({p:[(a3[0]+b3[0])/2,bridge.height+height,(a3[2]+b3[2])/2],s:[.075,.075,Math.hypot(b3[0]-a3[0],b3[2]-a3[2])+.025],color,angle});
          if(k%2===0)boxes.push({p:[a3[0],bridge.height+y(t1)/2,a3[2]],s:[.035,y(t1),.035],color,angle});
        }
      }
    });return boxes;
  }),[]);
  return <Boxes parts={parts}/>;
}

/** Continuous neighbourhoods remain visible at every map scale. */
export function UnifiedBayScenery() { return <UrbanFabric/>; }

export function BayFerryModel() {
  return <group><mesh position={[0,.35,0]} scale={[1.4,.48,2.55]}><boxGeometry/><meshStandardMaterial color="#477e78" roughness={.85}/></mesh><mesh position={[0,.68,-.2]} scale={[1.13,.15,1.9]}><boxGeometry/><meshStandardMaterial color="#fff0ce"/></mesh><mesh position={[0,.92,-.6]} scale={[.92,.48,.66]}><boxGeometry/><meshStandardMaterial color="#e0c398"/></mesh><mesh position={[0,1.2,-.6]} scale={[1.03,.1,.82]}><boxGeometry/><meshStandardMaterial color="#f4ead2"/></mesh></group>;
}

function BayCoastline() {
  const geometry=useMemo(()=>{
    const shore:number[]=[],foam:number[]=[],colors:number[]=[],sand=new THREE.Color('#ddc79d'),marsh=new THREE.Color('#9fbd9f');
    for(const area of BAY_LAND_AREAS)for(let i=1;i<area.ring.length;i++){
      const a=area.ring[i-1],b=area.ring[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.01)continue;
      let nx=-(b[1]-a[1])/length,nz=(b[0]-a[0])/length;const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;if(!bayContains(mx+nx*.4,mz+nz*.4)){nx=-nx;nz=-nz;}
      const ocean=mx<-185&&mz>-230,color=ocean?sand:marsh,width=ocean?2.3:.75;
      const points:BayPoint[]=[a,b,[a[0]+nx*width,a[1]+nz*width],[b[0]+nx*width,b[1]+nz*width]],water:BayPoint[]=[[a[0]-nx*.7,a[1]-nz*.7],[b[0]-nx*.7,b[1]-nz*.7],[a[0]-nx*.94,a[1]-nz*.94],[b[0]-nx*.94,b[1]-nz*.94]];
      for(const j of [0,2,1,1,2,3]){const p=points[j];shore.push(p[0],bayHeight(...p)+.013,p[1]);colors.push(color.r,color.g,color.b);const q=water[j];foam.push(q[0],-.405,q[1]);}
    }
    const strip=new THREE.BufferGeometry();strip.setAttribute('position',new THREE.Float32BufferAttribute(shore,3));strip.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));strip.computeVertexNormals();const edge=new THREE.BufferGeometry();edge.setAttribute('position',new THREE.Float32BufferAttribute(foam,3));return {strip,edge};
  },[]);
  useEffect(()=>()=>Object.values(geometry).forEach(item=>item.dispose()),[geometry]);
  return <><mesh geometry={geometry.strip}><meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide}/></mesh><mesh geometry={geometry.edge}><meshBasicMaterial color="#d9eee0" transparent opacity={.66} side={THREE.DoubleSide} depthWrite={false}/></mesh></>;
}

function BayShoreLife({running}:{running:boolean}) {
  const birds=useRef<THREE.Group>(null),perch=useRef<THREE.Group>(null),elapsed=useRef(0);
  const locations=useMemo(()=>UNIFIED_BAY_PLACES.filter(place=>['ocean-beach','half-moon-bay','alviso','alameda-beach'].includes(place.id)).map(place=>place.position),[]);
  const pier=UNIFIED_BAY_PLACES.find(place=>place.key==='sf:pier')!;
  useFrame(({camera},delta)=>{if(running)elapsed.current+=Math.min(delta,.05);if(perch.current)perch.current.visible=camera.position.distanceTo(perch.current.position)<100;
    birds.current?.children.forEach((group,index)=>{const p=locations[index],time=elapsed.current*.35+index;group.visible=Math.hypot(camera.position.x-p[0],camera.position.z-p[1])<100&&camera.position.y<90;group.position.set(p[0]+Math.cos(time)*4,5.1+Math.sin(time*1.2)*.5,p[1]+Math.sin(time)*3);group.rotation.y=-time;group.children.forEach((wing,i)=>{wing.rotation.z=(i===0?1:-1)*(.16+Math.sin(elapsed.current*2.8+index)*.12);});});
  });
  return <><group ref={birds}>{locations.map((_,i)=><group key={i}>{[-1,1].map(side=><mesh key={side} position={[side*.22,0,0]}><boxGeometry args={[.5,.035,.18]}/><meshStandardMaterial color="#f3e9ce" roughness={1}/></mesh>)}</group>)}</group><group ref={perch} position={[pier.position[0]-3,bayHeight(...pier.position)+.10,pier.position[1]-2.7]}><mesh position={[0,-.06,0]}><boxGeometry args={[2.6,.18,1.4]}/><meshStandardMaterial color="#9c8463" roughness={1}/></mesh><SealionsModel/></group></>;
}

export function UnifiedBayWater({running}:{running:boolean}) {
  const wave=useRef<THREE.InstancedMesh>(null),foam=useRef<THREE.Group>(null),time=useRef(0),ferry=useRef<THREE.Group>(null);
  const waves=useMemo(()=>{const points:BayPoint[]=[];for(let x=-350;x<240;x+=13)for(let z=-310;z<370;z+=15){const p:BayPoint=[x+mapHash(x,z)*8,z+mapHash(z,x)*6];if(!bayContains(...p))points.push(p);}return points;},[]);
  useLayoutEffect(()=>{const object=new THREE.Object3D();waves.forEach((point,i)=>{object.position.set(point[0],-.36,point[1]);object.rotation.set(-Math.PI/2,0,0);object.scale.set(2.4+i%4*.5,.14,1);object.updateMatrix();wave.current?.setMatrixAt(i,object.matrix);});if(wave.current){wave.current.instanceMatrix.needsUpdate=true;wave.current.computeBoundingSphere();}},[waves]);
  useFrame((_,delta)=>{if(running){time.current+=Math.min(delta,.05);if(foam.current){foam.current.position.x=Math.sin(time.current*.12)*.32;foam.current.position.y=Math.sin(time.current*.5)*.025;}const path=BAY_FERRY_ROUTES[0]?.path;if(ferry.current&&path?.length){const progress=(Math.sin(time.current*.025)+1)/2*(path.length-1),index=Math.min(path.length-2,Math.floor(progress)),t=progress-index,a=path[index],b=path[index+1];ferry.current.position.set(a[0]+(b[0]-a[0])*t,-.24+Math.sin(time.current)*.025,a[1]+(b[1]-a[1])*t);ferry.current.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1])+(Math.cos(time.current*.025)<0?Math.PI:0);}}});
  return <><mesh rotation={[-Math.PI/2,0,0]} position={[0,-.44,0]}><planeGeometry args={[2400,2400]}/><meshStandardMaterial color="#72aaa8" roughness={.52} metalness={.015}/></mesh><group ref={foam}><instancedMesh ref={wave} args={[undefined,undefined,waves.length]}><planeGeometry/><meshBasicMaterial color="#d6eade" transparent opacity={.32} depthWrite={false}/></instancedMesh></group><BayCoastline/><BayShoreLife running={running}/><group ref={ferry}><BayFerryModel/></group></>;
}
