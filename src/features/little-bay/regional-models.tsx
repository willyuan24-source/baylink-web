/** @jsxImportSource react */
import { memo, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { RegionalPlace } from './regional-world';

type Part = { p: [number,number,number]; s: [number,number,number]; c: string; r?: [number,number,number] };
const BOX = new RoundedBoxGeometry(1,1,1,1,.07);
const MAT = new THREE.MeshStandardMaterial({color:'white',roughness:.86});
const ivory='#f2e6c9', roof='#bb8060', teal='#477f78', sage='#90a781';

function Blocks({parts}:{parts:Part[]}) {
  const ref=useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(()=>{const obj=new THREE.Object3D();const color=new THREE.Color();parts.forEach((part,i)=>{obj.position.set(...part.p);obj.scale.set(...part.s);obj.rotation.set(...(part.r||[0,0,0]));obj.updateMatrix();ref.current?.setMatrixAt(i,obj.matrix);ref.current?.setColorAt(i,color.set(part.c));});if(ref.current){ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();}},[parts]);
  return <instancedMesh ref={ref} args={[BOX,MAT,parts.length]} castShadow receiveShadow dispose={null}/>;
}
function Dome({position=[0,2,0],radius=1,color=ivory}:{position?:[number,number,number];radius?:number;color?:string}) {return <mesh position={position} castShadow><sphereGeometry args={[radius,20,12,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color={color} roughness={.85}/></mesh>;}
function Cone({position,scale,color=roof}:{position:[number,number,number];scale:[number,number,number];color?:string}){return <mesh position={position} scale={scale} castShadow rotation={[0,Math.PI/4,0]}><coneGeometry args={[1,1,4]}/><meshStandardMaterial color={color} roughness={.9}/></mesh>;}
function Tree({x,z,tall=false}:{x:number;z:number;tall?:boolean}){return <group position={[x,0,z]}><mesh position={[0,.7,0]}><cylinderGeometry args={[.11,.17,1.4,6]}/><meshStandardMaterial color="#a68362"/></mesh><mesh position={[0,tall?2:1.4,0]} scale={[.65,tall?1.6:.85,.65]} castShadow>{tall?<coneGeometry args={[1,2,7]}/>:<icosahedronGeometry args={[1,1]}/>}<meshStandardMaterial color={sage} roughness={1}/></mesh></group>;}

/** Authored landmark silhouettes use the same warm clay palette as San Francisco. */
export const RegionalLandmarkModel=memo(function RegionalLandmarkModel({place}:{place:RegionalPlace}){
  const parts:Part[]=[];
  const block=(p:Part['p'],s:Part['s'],c=ivory,r?:Part['r'])=>parts.push({p,s,c,r});
  const natural=['garden','park','forest','beach','wetland','lagoon','peak','farm'].includes(place.kind);
  block([0,.08,0],place.kind==='ship'?[6.6,.16,6.3]:[4.4,.16,3.7],place.kind==='ship'?'#83b5b2':natural?'#b0bd95':'#dfd4b8');
  if(place.kind==='park'){
    block([0,.19,0],[.6,.05,3.45],'#e5d7b8');block([0,.2,.28],[4.1,.045,.55],'#e5d7b8');
    block([.98,.29,-.88],[1.45,.22,.9],'#8fb697');
    for(const x of [-1.25,1.25]){block([x,.48,.92],[.98,.17,.38],roof);block([x,.76,1.08],[.98,.36,.09],roof);for(const dx of [-.3,.3])block([x+dx,.29,.9],[.08,.36,.3],teal);}
    for(const x of [-1.65,-.65])block([x,.87,-.8],[.09,1.36,.1],teal);
    block([-1.15,1.56,-.8],[1.35,.13,1.0],roof);block([-1.15,.72,-.8],[.65,.08,.55],ivory);
    if(place.id==='burgess-park')block([1.14,.18,-.89],[1.65,.04,1.15],'#8ebdb3');
  }else if(place.kind==='garden'||place.kind==='pagoda'){
    block([0,.14,.5],[2.3,.04,1.65],'#8cb9b0');
    [-1,1].forEach(x=>{block([x,1.05,-.6],[.14,1.6,.14],roof);block([x,.54,1],[.12,.65,.12],roof);});
    block([0,1.7,-.6],[2.9,.2,1.4],teal);block([0,1.93,-.6],[2.3,.2,1.0],teal);block([0,2.13,-.6],[1.5,.19,.6],teal);
    block([0,.43,.9],[2.5,.12,.4],roof);block([0,.74,.9],[2.5,.07,.09],roof);
    block([1.55,.6,-1],[.22,.8,.22],'#c8bb9f');block([1.55,1.07,-1],[.55,.16,.55],ivory);
  }else if(place.id==='santa-clara-university'){
    block([0,.99,-.55],[2.1,1.78,2.2]);block([0,1.96,-.55],[2.45,.18,2.55],roof);
    block([0,1.4,.64],[2.25,2.55,.22]);block([0,2.76,.64],[1.35,.2,.3],ivory);
    block([0,.58,.775],[.48,.82,.035],teal);for(const x of [-.77,.77])block([x,1.87,.78],[.28,.44,.035],teal);
    block([-1.56,.6,-.45],[.72,1.04,2.25]);block([-1.56,1.18,-.45],[.94,.19,2.47],roof);
  }else if(place.kind==='campus'){
    block([0,.9,-.75],[3.8,1.5,1.0]);block([0,1.72,-.75],[4.1,.23,1.3],roof);
    for(let i=-2;i<=2;i++) {block([i*.7,.7,.12],[.18,1.25,.22]);block([i*.7,1.3,.12],[.6,.22,.25]);}
    block([0,.08,.85],[3.9,.15,1.1],'#c9c699');
    block([1.28,2.15,-.4],[.65,4.1,.65],ivory);block([1.28,3.7,-.03],[.38,.4,.03],teal);block([1.28,4.27,-.4],[.82,.19,.82],roof);
  }else if(place.kind==='courthouse'||place.kind==='temple'||place.kind==='egypt'){
    const temple=place.kind==='temple';
    if(!temple)block([0,1,-.8],[3.2,1.7,1.35],place.kind==='egypt'?'#cfb77e':ivory);
    for(let i=-2;i<=2;i++)block([i*.62,1.05,.05],[.2,1.9,.2],ivory);
    block([0,2.07,.05],[3.4,.28,.8],ivory);block([0,.18,.6],[3.7,.18,1.5],'#d6c39f');
    if(temple)block([0,.15,1.35],[1.8,.02,.9],'#86b7aa');
  }else if(place.kind==='observatory'){
    block([-.85,.8,0],[1.8,1.5,1.65]);block([1.15,.5,.3],[1.15,.9,1.1]);block([.2,.43,0],[1.3,.6,.7],ivory);
  }else if(place.id==='sfo-airport'){
    block([0,.6,-.4],[3.5,1.03,1.3],ivory);block([0,1.2,-.4],[3.8,.19,1.65],teal);
    block([0,.63,.27],[3.12,.58,.03],'#8fbaba');for(const x of [-1.2,-.6,0,.6,1.2])block([x,.67,.3],[.06,.85,.05],ivory);
    block([1.55,1.9,-.4],[.34,3.4,.34],ivory);block([1.55,3.39,-.4],[.8,.46,.65],teal);block([1.55,3.68,-.4],[.94,.15,.8],ivory);
    block([-1,.49,1.07],[.24,.23,1.06],ivory);block([-1,.53,1.07],[1.38,.08,.29],roof);block([-1,.68,.6],[.1,.35,.25],teal);
  }else if(place.kind==='aviation'){
    block([0,.8,-.65],[3.5,1.45,1.5],'#d1b88e');block([0,1.6,-.65],[3.8,.2,1.8],teal);
    block([0,.75,.85],[.36,.32,2.2],ivory);block([0,.76,.8],[2.9,.12,.44],roof);block([0,1.01,-.05],[.15,.65,.4],teal);block([0,.74,-.05],[1,.1,.25],ivory);
  }else if(place.kind==='station'&&(place.id.endsWith('-bart')||place.id==='millbrae-transit')){
    block([0,.22,0],[4.05,.23,2.3],'#c7c6ac');for(const z of [-.53,.53])block([0,.37,z],[3.86,.05,.04],'#716d5b');
    block([-.24,.74,0],[3.15,.74,.7],ivory);block([-.24,.66,.363],[3.15,.18,.025],teal);
    for(let i=0;i<6;i++)block([-1.52+i*.49,.91,.365],[.31,.24,.025],'#648f8d');
    for(const x of [-1.6,1.6]){block([x,1.37,-.83],[.12,2.3,.12],teal);block([x,1.37,.84],[.12,2.3,.12],teal);}
    block([0,2.6,0],[4.2,.18,2.45],teal);block([0,2.74,0],[4.3,.13,1.3],'#dce4cd');
    block([1.8,1.2,1.35],[.08,1.95,.08],teal);block([1.8,2.16,1.35],[.47,.39,.09],ivory);
  }else if(place.kind==='station'){
    block([-.65,.95,-.7],[1.8,1.65,1.3],ivory);block([-.65,1.86,-.7],[2.05,.24,1.6],roof);
    block([.8,.7,.9],[2.3,.83,.66],teal);block([.8,1.18,.9],[2.55,.15,.85],ivory);
    for(let i=0;i<4;i++)block([-.02+i*.52,.83,1.245],[.35,.24,.02],'#a3c6c0');
    [-.12,.5].forEach(z=>block([0,.23,z+1.12],[4,.05,.04],'#786b57'));
  }else if(place.kind==='ship'){
    // A local harbor basin makes the docked ship legible on the schematic coast.
    block([0,.19,0],[6.5,.06,6.2],'#90bebb');
    block([2.65,.33,0],[1.0,.25,6.3],'#c6b99c');
    block([1.65,.61,-1.25],[1.15,.13,.42],'#ded1ad');
    for(const z of [-2.45,-.7,1.1,2.5]){block([2.24,.61,z],[.16,.43,.16],teal);block([2.24,.87,z],[.3,.09,.16],teal);}
    for(const [x,z,width] of [[-2.4,-1.65,.65],[-2.15,.8,.9],[-1.8,2.65,.65],[.45,-2.8,1.05]])block([x,.23,z],[width,.015,.05],'#c2dcd1');
    block([0,.6,0],[1.75,.8,4.1],'#7e9d9b');block([0,1.09,0],[2.35,.18,4.6],ivory);block([.65,1.62,-.65],[.55,.9,1.1],teal);block([.65,2.3,-.65],[.12,.6,.12],teal);
    for(let i=0;i<3;i++){block([-.4,1.3,.2+i*.8],[.95,.06,.2],roof);block([-.4,1.33,.2+i*.8],[.12,.1,.65],ivory);}
    block([0,1.195,0],[.03,.01,4.2],'#c6af7d');
  }else if(place.kind==='forest'||place.kind==='wetland'||place.kind==='lagoon'||place.kind==='beach'||place.kind==='peak'){
    if(place.kind==='lagoon'||place.kind==='wetland')block([0,.18,0],[3.3,.03,2.5],'#86b8b1');
    if(place.kind==='beach')block([0,.19,.15],[4.15,.04,3.4],'#ebd4ab');
    if(place.kind==='peak'){block([0,.7,0],[.12,1.3,.12],roof);block([.28,1.24,0],[.62,.22,.08],teal);}
    else {block([0,.3,.85],[2.9,.14,.47],'#bd9471');[-1,1].forEach(x=>block([x,.45,.62],[.12,.62,.12],'#bd9471'));}
  }else if(place.kind==='estate'||place.kind==='mansion'||place.kind==='farm'||place.kind==='town'||place.id==='sunnyvale-heritage'){
    block([0,1.0,-.35],[3,1.8,1.5],place.kind==='farm'?'#c08867':ivory);block([0,2,-.35],[3.4,.25,1.9],roof);
    [-1,0,1].forEach(x=>{block([x*.9,1.12,.415],[.35,.48,.04],teal);block([x*.9,.5,.415],[.4,.04,.04],roof);});
    if(place.kind==='mansion'){block([-1,2.7,-.5],[.6,1.1,.6],ivory);block([1,2.45,-.5],[.6,.8,.6],ivory);}
    if(place.kind==='estate')for(let x=-1.5;x<2;x+=.75)block([x,.29,1.25],[.48,.32,.75],sage);
    if(place.id==='sunnyvale-heritage'){block([0,.33,.98],[3.4,.18,1.2],ivory);block([0,1.4,.98],[3.55,.12,1.3],teal);for(const x of [-1.45,-.5,.5,1.45])block([x,.84,1.47],[.1,1.0,.1],ivory);}
  }else{
    const isGoogle=place.id==='google-visitor',isApple=place.id==='apple-visitor';
    block([0,.95,0],[3.6,1.6,2.2],place.id==='tech'?'#d39e72':ivory);
    block([0,1.1,1.12],[3.2,1.05,.03],'#8eb9b4');block([0,1.84,0],[3.9,.19,2.5],isGoogle?'#e2dac5':teal);
    for(let x=-1.4;x<1.5;x+=.55)block([x,1.1,1.15],[.06,1.15,.04],ivory);
    if(isApple)block([0,2.06,0],[3.4,.19,2.0],'#e7e6d4');
    if(place.id==='computer-history'){block([-1.3,2.28,0],[.4,.6,.4],roof);block([0,2.48,0],[.4,1,.4],teal);block([1.3,2.14,0],[.4,.4,.4],sage);}
  }
  return <group><Blocks parts={parts}/>
    {place.id==='tech'&&<Dome position={[.55,1.94,-.35]} radius={1.16} color="#8b83a5"/>}
    {place.id==='google-visitor'&&[-1.2,0,1.2].flatMap(x=>[-.6,.6].map(z=><Cone key={`${x}:${z}`} position={[x,2.08,z]} scale={[.86,.48,.86]} color="#d9d9c2"/>))}
    {place.kind==='courthouse'&&<Dome position={[0,2.4,-.7]} radius={.78} color="#aab49a"/>}
    {place.kind==='temple'&&<Dome position={[0,2.2,.05]} radius={1.35}/>}
    {place.kind==='egypt'&&<Cone position={[1.4,2.6,-.75]} scale={[.9,1.7,.9]} color="#cfb77e"/>}
    {place.kind==='observatory'&&<><Dome position={[-.85,1.58,0]} radius={.96}/><Dome position={[1.15,.95,.3]} radius={.6}/></>}
    {place.kind==='campus'&&place.id!=='santa-clara-university'&&<Cone position={[1.28,4.65,-.4]} scale={[.55,.7,.55]}/>}
    {place.kind==='mansion'&&<><Cone position={[-1,3.65,-.5]} scale={[.7,1,.7]}/><Cone position={[1,3.24,-.5]} scale={[.7,.9,.7]}/></>}
    {['garden','forest','wetland','beach','farm'].includes(place.kind)&&<><Tree x={-1.6} z={-.9} tall={place.kind==='forest'}/><Tree x={1.55} z={-1.2} tall={place.kind==='forest'}/></>}
    {place.kind==='park'&&<><Tree x={-1.8} z={-.97}/><Tree x={1.76} z={-1.19}/><Tree x={1.67} z={.2}/></>}
  </group>;
});
