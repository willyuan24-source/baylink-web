/** @jsxImportSource react */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BAY_BRIDGES, BAY_FERRY_ROUTES, BAY_LAND_AREAS, BAY_ROADS, UNIFIED_BAY_PLACES, bayContains, bayHeight, projectBay, type BayPoint } from './unified-bay-world';
import { createRoadGeometry, createShoreGeometry, mapHash } from './san-francisco-geometry';
import { sfVisualRoads } from './sf-city-scenery';

type BoxPart={p:[number,number,number];s:[number,number,number];color:string;angle?:number};
function Boxes({parts}:{parts:BoxPart[]}) {
  const mesh=useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(()=>{const object=new THREE.Object3D(),color=new THREE.Color();parts.forEach((part,i)=>{object.position.set(...part.p);object.scale.set(...part.s);object.rotation.set(0,part.angle||0,0);object.updateMatrix();mesh.current?.setMatrixAt(i,object.matrix);mesh.current?.setColorAt(i,color.set(part.color));});if(mesh.current){mesh.current.instanceMatrix.needsUpdate=true;if(mesh.current.instanceColor)mesh.current.instanceColor.needsUpdate=true;mesh.current.computeBoundingSphere();}},[parts]);
  return <instancedMesh ref={mesh} args={[undefined,undefined,parts.length]}><boxGeometry/><meshStandardMaterial roughness={.92}/></instancedMesh>;
}

/** A coarser adaptive surface is enough for a 70 km diorama; city geometry keeps its own detail. */
function bayTerrain() {
  const positions:number[]=[],colors:number[]=[];
  const sand=new THREE.Color('#ccd0a8'),hill=new THREE.Color('#91ab80'),color=new THREE.Color();
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
    <mesh geometry={geometry.roads}><meshStandardMaterial color="#b1bca9" roughness={1} side={THREE.DoubleSide}/></mesh>
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

/** Landmarks remain the largest forms. Scenery is instanced and thins out beyond the camera. */
export function UnifiedBayScenery() {
  const mesh=useRef<THREE.InstancedMesh>(null),canopy=useRef<THREE.InstancedMesh>(null),roof=useRef<THREE.InstancedMesh>(null),last=useRef(-1);
  const objects=useMemo(()=>{
    const items:{x:number;z:number;height:number;tree:boolean;color:string}[]=[];
    UNIFIED_BAY_PLACES.forEach((place,j)=>{for(let i=0;i<22;i++){
      const angle=mapHash(i,j)*Math.PI*2,radius=6+mapHash(i,j,2)*18,x=place.position[0]+Math.cos(angle)*radius,z=place.position[1]+Math.sin(angle)*radius;
      if(!bayContains(x,z)||UNIFIED_BAY_PLACES.some(p=>Math.hypot(x-p.position[0],z-p.position[1])<Math.max(5,p.arrivalRadius+1.4)))continue;
      const roadNear=BAY_ROADS.some(road=>road.path.slice(1).some((b,k)=>{const a=road.path[k],dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/len)):0;return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<road.width*.5+1.0;}));
      if(!roadNear)items.push({x,z,height:.65+mapHash(i,j,3)*1.5,tree:i%3!==0,color:['#b8c5a7','#ccb797','#aec1b0','#d2bca8'][i%4]});
    }});return items;
  },[]);
  useFrame(({camera,clock})=>{
    if(clock.elapsedTime-last.current<.35)return;last.current=clock.elapsedTime;
    const object=new THREE.Object3D(),color=new THREE.Color();
    objects.forEach((item,i)=>{const distance=Math.hypot(item.x-camera.position.x,item.z-camera.position.z),detail=distance<130||i%5===0;
      const y=bayHeight(item.x,item.z);object.position.set(item.x,y+item.height/2,item.z);object.scale.set(detail?(item.tree?.16:1.15):0,detail?item.height:0,detail?(item.tree?.16:1):0);object.updateMatrix();mesh.current?.setMatrixAt(i,object.matrix);mesh.current?.setColorAt(i,color.set(item.tree?'#a28665':item.color));
      object.position.y=y+item.height+(item.tree?.3:.08);object.scale.set(detail&&item.tree?.85:0,detail&&item.tree?.95:0,detail&&item.tree?.85:0);object.updateMatrix();canopy.current?.setMatrixAt(i,object.matrix);canopy.current?.setColorAt(i,color.set(i%3?'#9db78e':'#b1bf98'));
      object.scale.set(detail&&!item.tree?1.26:0,detail&&!item.tree?.18:0,detail&&!item.tree?1.12:0);object.updateMatrix();roof.current?.setMatrixAt(i,object.matrix);
    });for(const ref of [mesh,canopy,roof])if(ref.current){ref.current.visible=camera.position.y<170;ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();}
  });
  return <group><instancedMesh ref={mesh} args={[undefined,undefined,objects.length]}><boxGeometry/><meshStandardMaterial roughness={1}/></instancedMesh><instancedMesh ref={canopy} args={[undefined,undefined,objects.length]}><icosahedronGeometry args={[1,1]}/><meshStandardMaterial roughness={1}/></instancedMesh><instancedMesh ref={roof} args={[undefined,undefined,objects.length]}><boxGeometry/><meshStandardMaterial color="#a68d70" roughness={1}/></instancedMesh></group>;
}

export function BayFerryModel() {
  return <group><mesh position={[0,.35,0]} scale={[1.4,.48,2.55]}><boxGeometry/><meshStandardMaterial color="#477e78" roughness={.85}/></mesh><mesh position={[0,.68,-.2]} scale={[1.13,.15,1.9]}><boxGeometry/><meshStandardMaterial color="#fff0ce"/></mesh><mesh position={[0,.92,-.6]} scale={[.92,.48,.66]}><boxGeometry/><meshStandardMaterial color="#e0c398"/></mesh><mesh position={[0,1.2,-.6]} scale={[1.03,.1,.82]}><boxGeometry/><meshStandardMaterial color="#f4ead2"/></mesh></group>;
}

export function UnifiedBayWater({running}:{running:boolean}) {
  const wave=useRef<THREE.InstancedMesh>(null),foam=useRef<THREE.Group>(null),time=useRef(0),ferry=useRef<THREE.Group>(null);
  const waves=useMemo(()=>{const points:BayPoint[]=[];for(let x=-350;x<240;x+=13)for(let z=-310;z<370;z+=15){const p:BayPoint=[x+mapHash(x,z)*8,z+mapHash(z,x)*6];if(!bayContains(...p))points.push(p);}return points;},[]);
  useLayoutEffect(()=>{const object=new THREE.Object3D();waves.forEach((point,i)=>{object.position.set(point[0],-.36,point[1]);object.rotation.set(-Math.PI/2,0,0);object.scale.set(2.4+i%4*.5,.14,1);object.updateMatrix();wave.current?.setMatrixAt(i,object.matrix);});if(wave.current){wave.current.instanceMatrix.needsUpdate=true;wave.current.computeBoundingSphere();}},[waves]);
  useFrame((_,delta)=>{if(running){time.current+=Math.min(delta,.05);if(foam.current){foam.current.position.x=Math.sin(time.current*.12)*.32;foam.current.position.y=Math.sin(time.current*.5)*.025;}const path=BAY_FERRY_ROUTES[0]?.path;if(ferry.current&&path?.length){const progress=(Math.sin(time.current*.025)+1)/2*(path.length-1),index=Math.min(path.length-2,Math.floor(progress)),t=progress-index,a=path[index],b=path[index+1];ferry.current.position.set(a[0]+(b[0]-a[0])*t,-.24+Math.sin(time.current)*.025,a[1]+(b[1]-a[1])*t);ferry.current.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1])+(Math.cos(time.current*.025)<0?Math.PI:0);}}});
  return <><mesh rotation={[-Math.PI/2,0,0]} position={[0,-.44,0]}><planeGeometry args={[2400,2400]}/><meshStandardMaterial color="#87bdb9" roughness={.5} metalness={.015}/></mesh><group ref={foam}><instancedMesh ref={wave} args={[undefined,undefined,waves.length]}><planeGeometry/><meshBasicMaterial color="#d6eade" transparent opacity={.42} depthWrite={false}/></instancedMesh></group><group ref={ferry}><BayFerryModel/></group></>;
}
