/** @jsxImportSource react */
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { UnifiedPlace } from './unified-bay-world';

type Part={p:[number,number,number];s:[number,number,number];color:string;r?:[number,number,number]};
const BOX=new RoundedBoxGeometry(1,1,1,1,.045),MAT=new THREE.MeshStandardMaterial({color:'white',roughness:.86});
const palette={ivory:'#efe2c4',terracotta:'#b97150',teal:'#427d7a',sage:'#91ae80',sand:'#d2bd93',stone:'#c9c4ac'};
function Parts({items}:{items:Part[]}){
  const ref=useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(()=>{const object=new THREE.Object3D(),color=new THREE.Color();items.forEach((part,i)=>{object.position.set(...part.p);object.scale.set(...part.s);object.rotation.set(...(part.r||[0,0,0]));object.updateMatrix();ref.current?.setMatrixAt(i,object.matrix);ref.current?.setColorAt(i,color.set(part.color));});if(ref.current){ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();}},[items]);
  return <instancedMesh ref={ref} args={[BOX,MAT,items.length]} castShadow receiveShadow dispose={null}/>;
}
function Dome({position,radius,color=palette.ivory}:{position:[number,number,number];radius:number;color?:string}){return <mesh position={position} castShadow><sphereGeometry args={[radius,16,8,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color={color} roughness={.84}/></mesh>;}
function Ring({position=[0,.2,0],radius=1.5,tube=.18,color=palette.ivory,vertical=false}:{position?:[number,number,number];radius?:number;tube?:number;color?:string;vertical?:boolean}){return <mesh position={position} rotation={vertical?[0,0,0]:[-Math.PI/2,0,0]} castShadow><torusGeometry args={[radius,tube,5,24]}/><meshStandardMaterial color={color} roughness={.72}/></mesh>;}

/** Regional signatures remain recognizable after dropping all window-level detail. */
export const LandmarkSilhouette=memo(function LandmarkSilhouette({place}:{place:UnifiedPlace}){
  const parts:Part[]=[],kind=place.regional?.kind||place.sf?.kind||'museum',id=place.id;
  const box=(p:Part['p'],s:Part['s'],color=palette.ivory,r?:Part['r'])=>parts.push({p,s,color,r});
  const natural=['park','garden','beach','coast','wetland','forest','lagoon','peak','farm'].includes(kind);
  box([0,.065,0],[4.5,.13,3.8],natural?'#adc396':'#ddcaa4');
  if(id==='stanford'||id==='berkeley'){
    const stanford=id==='stanford';box([-.5,.65,-.6],[3.4,1.1,1],palette.ivory);box([-.5,1.28,-.6],[3.7,.23,1.3],stanford?palette.terracotta:palette.stone);
    for(let i=0;i<5;i++){box([-1.8+i*.58,.55,.15],[.16,.95,.22]);box([-1.8+i*.58,1.03,.15],[.62,.16,.24]);}
    box([1.18,2.2,-.5],[.66,4.2,.66],palette.ivory);box([1.18,3.82,-.14],[.44,.39,.025],palette.teal);box([1.18,4.31,-.5],[.85,.22,.85],stanford?palette.terracotta:palette.ivory);
    if(!stanford)box([1.18,4.63,-.5],[.56,.52,.56],palette.stone);
  }else if(id==='apple-visitor'){
    box([0,.31,.45],[3.8,.42,1.3],palette.teal);box([0,.58,.45],[4.1,.16,1.6],palette.ivory);box([0,.07,-.35],[1.6,.1,1.1],palette.sage);
  }else if(id==='google-visitor'){
    box([0,.43,0],[3.9,.7,2.5],palette.teal);box([0,.18,1.35],[3.9,.13,.45],palette.terracotta);
    for(let i=0;i<5;i++)box([-1.48+i*.74,.78,0],[.14,.6,2.8],i%2?palette.ivory:'#b9cbb8');
  }else if(id==='tech'){
    box([-.7,.84,-.25],[2.5,1.5,2.4],'#c57951');box([1.15,1.1,0],[1.0,2.1,2.2],'#4a8c95');box([-.72,1.62,-.25],[2.75,.18,2.65],palette.ivory);box([1.15,2.22,0],[1.1,.16,2.3],'#84b7bd');box([-.1,.47,1.24],[.9,.72,.1],palette.teal);
  }else if(id==='chabot'||id==='lick'){
    box([-.9,.78,0],[1.65,1.4,1.65],palette.ivory);box([1.15,.5,.35],[1.4,.85,1.4],palette.ivory);box([.2,.35,0],[1.5,.56,.7],palette.stone);
  }else if(id==='transamerica'){
    box([0,.28,0],[1.9,.5,1.9],palette.ivory);box([-.72,2.1,0],[.16,2,.25],palette.ivory);box([.72,2.1,0],[.16,2,.25],palette.ivory);
  }else if(id==='salesforce'){
    box([-.2,3,0],[1.6,5.8,1.45],palette.teal);box([-.2,5.95,0],[1.37,.6,1.22],'#94b9ad');box([-.2,6.34,0],[.98,.27,.92],palette.ivory);box([1.1,.65,.2],[1.5,1.1,1.8],palette.ivory);box([1.1,1.23,.2],[1.58,.16,1.9],palette.sage);
    for(let i=0;i<5;i++)box([-.2,1.1+i*.9,.738],[1.65,.06,.02],'#b1c9b8');
  }else if(id==='coit'){
    box([0,.19,0],[2.2,.3,2.0],palette.sand);box([0,1.9,0],[.82,3.4,.82],palette.ivory);box([0,3.7,0],[1.08,.38,1.08],palette.ivory);box([0,3.72,.55],[.65,.19,.02],palette.teal);
  }else if(id==='skystar'){
    box([-.85,1.25,0],[.14,2.4,.2],palette.teal,[0,0,-.3]);box([.85,1.25,0],[.14,2.4,.2],palette.teal,[0,0,.3]);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;box([Math.cos(a)*1.68,2.55+Math.sin(a)*1.68,0],[.38,.48,.35],i%2?palette.ivory:palette.terracotta);}
  }else if(id==='bridge'){
    box([0,.6,0],[4.5,.18,.9],palette.terracotta);for(const x of [-1.4,1.4]){box([x,1.65,-.55],[.24,3,.22],palette.terracotta);box([x,1.65,.55],[.24,3,.22],palette.terracotta);box([x,2.8,0],[.28,.22,1.28],palette.terracotta);}
  }else if(kind==='campus'||kind==='civic'||kind==='courthouse'){
    box([0,.86,-.55],[3.6,1.5,1.45]);for(let i=0;i<5;i++)box([-1.25+i*.63,.82,.4],[.21,1.4,.21]);box([0,1.67,.4],[3.25,.24,.7],palette.terracotta);
  }else if(kind==='tower'||kind==='skyscraper'){
    box([0,2,0],[1.5,3.8,1.4],palette.teal);box([0,4,0],[1.22,.24,1.12],palette.ivory);
  }else if(kind==='ship'){
    box([0,.39,0],[2.8,.57,4.3],palette.stone);box([.65,.97,-.5],[.7,.85,1.1],palette.ivory);box([.7,1.7,-.5],[.13,.85,.13],palette.teal);
  }else if(kind==='station'){
    box([-.45,.7,-.8],[2.9,1.15,1.2]);box([-.45,1.33,-.8],[3.2,.24,1.5],palette.terracotta);box([.4,.47,.73],[3.5,.62,.8],palette.teal);for(let i=0;i<5;i++)box([-.9+i*.62,.59,1.145],[.36,.23,.03],palette.ivory);
  }else if(natural){
    box([0,.16,.2],[3.6,.12,.7],palette.sand);for(const x of [-1.1,0,1.2]){box([x,.78,-.65],[.14,1.4,.14],'#987b5a');box([x,1.5,-.65],[.84,.92,.84],palette.sage);}
    if(kind==='beach'||kind==='wetland'||kind==='lagoon')box([0,.17,1.0],[4.0,.08,.73],'#6baba7');
  }else{
    box([-.8,.62,0],[1.7,1.08,2.3]);box([1.0,1.05,-.25],[1.5,1.95,1.7],palette.teal);box([-.8,1.23,0],[1.96,.2,2.5],palette.terracotta);box([1,2.11,-.25],[1.68,.18,1.9],palette.ivory);
  }
  return <group><Parts items={parts}/>
    {id==='apple-visitor'&&<Ring position={[0,.7,-.12]} radius={1.3} tube={.23} color="#a8bcb0"/>}
    {id==='google-visitor'&&[-1.2,0,1.2].map(x=><group key={x} position={[x,.66,0]} scale={[.7,.34,1.25]}><Dome position={[0,0,0]} radius={1} color="#d1dfca"/></group>)}
    {(id==='chabot'||id==='lick')&&<><Dome position={[-.9,1.47,0]} radius={.86}/><Dome position={[1.15,.94,.35]} radius={.73}/></>}
    {id==='transamerica'&&<mesh position={[0,2.76,0]} rotation={[0,Math.PI/4,0]} castShadow><coneGeometry args={[1.42,5.2,4]}/><meshStandardMaterial color={palette.ivory} roughness={.9}/></mesh>}
    {id==='skystar'&&<><Ring position={[0,2.55,0]} radius={1.65} tube={.09} vertical/><mesh position={[0,2.55,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.2,.2,.3,8]}/><meshStandardMaterial color={palette.teal}/></mesh></>}
    {(kind==='civic'||kind==='courthouse')&&<Dome position={[0,1.58,-.5]} radius={.7} color={palette.teal}/>}
  </group>;
});

/** Low, open courtyards provide contact and human scale without blocking movement. */
export const LandmarkCourtyard=memo(function LandmarkCourtyard({place,selected}:{place:UnifiedPlace;selected:boolean}){
  const items=useMemo(()=>{
    const kind=place.sf?.kind||place.regional?.kind||'',natural=['bridge','beach','coast','island','peak','ship','wetland','lagoon','forest','ruins'].includes(kind);
    if(natural)return [];
    const radius=place.region==='sf'?Math.min(2.3,(place.sf?.sceneryRadius||2.4)*.83):2.45;
    const parts:Part[]=[{p:[0,.035,0],s:[radius*2,.055,radius*1.65],color:'#d4c5a6'},{p:[0,.07,radius*.74],s:[.9,.07,radius*.6],color:'#eee0c1'}];
    for(const side of [-1,1]){
      const x=side*radius*.78;parts.push({p:[x,.18,radius*.44],s:[.54,.28,.54],color:'#be8d6a'},{p:[x,.38,radius*.44],s:[.67,.2,.67],color:'#9ab57f'});
      if(selected){parts.push({p:[x,.26,-radius*.65],s:[.82,.11,.34],color:'#ae865d'},{p:[x,.5,-radius*.81],s:[.82,.32,.075],color:'#b59367'},{p:[x-.28,.13,-radius*.65],s:[.06,.22,.25],color:'#54796c'},{p:[x+.28,.13,-radius*.65],s:[.06,.22,.25],color:'#54796c'});}
    }return parts;
  },[place,selected]);
  return items.length?<Parts items={items}/>:null;
});

const shadowData=new Uint8Array(32*32*4);
for(let y=0;y<32;y++)for(let x=0;x<32;x++){const distance=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5),offset=(y*32+x)*4;shadowData[offset]=49;shadowData[offset+1]=73;shadowData[offset+2]=58;shadowData[offset+3]=Math.round(Math.pow(Math.max(0,1-distance),1.6)*92);}
const SHADOW=new THREE.DataTexture(shadowData,32,32,THREE.RGBAFormat);SHADOW.needsUpdate=true;
export function SoftGroundContact({radius=2.2}:{radius?:number}){return <mesh rotation={[-Math.PI/2,0,0]} position={[0,.022,0]} renderOrder={1}><planeGeometry args={[radius*2.8,radius*2.8]}/><meshBasicMaterial map={SHADOW} transparent depthWrite={false} opacity={.65} toneMapped={false}/></mesh>;}
