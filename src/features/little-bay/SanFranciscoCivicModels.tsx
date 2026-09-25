/** @jsxImportSource react */
import { memo, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type V3 = [number, number, number];
type Piece = { p: V3; s: V3; c: string; r?: V3 };
const cream = '#eadfc6', stone = '#c5b399', glass = '#88b8b2', teal = '#386f69', copper = '#b77f60', leaf = '#93a678';
const box = new RoundedBoxGeometry(1, 1, 1, 2, .04);
const cylinder = new THREE.CylinderGeometry(.5, .5, 1, 16);
const sphere = new THREE.SphereGeometry(1, 12, 8);
const pyramid = new THREE.ConeGeometry(.7071, 1, 4);
const studentCenterRoof = new THREE.ExtrudeGeometry(new THREE.Shape([
  new THREE.Vector2(-.65,0), new THREE.Vector2(-.65,.42), new THREE.Vector2(.62,1),
  new THREE.Vector2(.62,.38), new THREE.Vector2(.1,-.18),
]), {depth:.82,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.025});
const dome = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
const clay = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .87 });
const towerProfile = [[.63, 0], [.65, .3], [.62, 1.8], [.56, 3.4], [.47, 4.3], [.36, 4.8], [.2, 5.03], [0, 5.12]];
const tower = new THREE.LatheGeometry(towerProfile.map(([x,y]) => new THREE.Vector2(x,y)), 24);
const stadiumBowl = new THREE.CylinderGeometry(1.6, 1.85, .8, 28, 1, true, .5, Math.PI * 1.53);

function Parts({ pieces, geometry = box }: { pieces: Piece[]; geometry?: THREE.BufferGeometry }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const object = new THREE.Object3D(), color = new THREE.Color();
    pieces.forEach((piece, i) => {
      object.position.set(...piece.p); object.scale.set(...piece.s); object.rotation.set(...(piece.r || [0,0,0])); object.updateMatrix();
      ref.current!.setMatrixAt(i, object.matrix); ref.current!.setColorAt(i, color.set(piece.c));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [pieces]);
  return <instancedMesh ref={ref} args={[geometry, clay, pieces.length]} castShadow receiveShadow dispose={null} />;
}

function Grove({ positions }: { positions: V3[] }) {
  return <><Parts geometry={cylinder} pieces={positions.map(([x,y,z]) => ({p:[x,y+.28,z],s:[.075,.56,.075],c:copper}))} /><Parts geometry={sphere} pieces={positions.map(([x,y,z],i) => ({p:[x,y+.64,z],s:[.3,.42,.29],c:i%2?leaf:'#80966e'}))} /></>;
}

function Palms({ positions }: { positions: V3[] }) {
  return <><Parts geometry={cylinder} pieces={positions.map(([x,y,z])=>({p:[x,y+.5,z],s:[.09,1,.09],c:copper}))} /><Parts geometry={sphere} pieces={positions.flatMap(([x,y,z])=>Array.from({length:6},(_,i)=>{
    const angle=i*Math.PI/3;
    return {p:[x+Math.sin(angle)*.18,y+1.06,z+Math.cos(angle)*.18] as V3,s:[.095,.055,.4] as V3,r:[.18,angle,0] as V3,c:leaf};
  }))} /></>;
}

function Campus({ missionBay = false }: { missionBay?: boolean }) {
  const buildings: Piece[] = missionBay ? [
    {p:[-.95,.8,-.35],s:[1.05,1.6,1.5],c:cream}, {p:[.7,.65,-.65],s:[1.8,1.3,.86],c:copper},
    {p:[.27,.4,.45],s:[1.6,.8,.56],c:glass}, {p:[1.27,1.03,-.6],s:[.45,2.06,.86],c:'#dad7c4'},
  ] : [
    {p:[-.7,1.04,-.25],s:[1.15,2.08,1.02],c:cream}, {p:[.56,.66,.12],s:[1.46,1.32,1.2],c:'#c1c7ba'},
    {p:[1.34,.47,-.29],s:[.64,.94,.88],c:stone}, {p:[-1.28,.51,.26],s:[.45,1.02,.92],c:stone},
  ];
  const windows: Piece[] = [];
  for (const b of buildings) {
    for (let floor=.24;floor<b.s[1]-.13;floor+=.25) windows.push({p:[b.p[0],floor,b.p[2]+b.s[2]/2+.012],s:[b.s[0]*.83,.10,.025],c:teal});
    windows.push({p:[b.p[0],b.s[1]+.045,b.p[2]],s:[b.s[0]+.08,.09,b.s[2]+.08],c:cream});
  }
  return <group name={missionBay?'ucsf-mission-bay-model':'ucsf-parnassus-model'}>
    <Parts pieces={[{p:[0,.045,.1],s:[3.8,.09,3.05],c:'#d8cfb2'},...buildings,...windows,{p:[0,.38,1.03],s:[.9,.08,.54],c:teal},{p:[-.34,.18,1.12],s:[.04,.36,.04],c:cream},{p:[.34,.18,1.12],s:[.04,.36,.04],c:cream}]} />
    <Grove positions={missionBay?[[-1.55,0,.75],[1.56,0,.9],[-.15,0,-1.2]]:[[-1.3,0,-1.2],[-.65,.12,-1.3],[.1,.17,-1.4],[.88,.13,-1.35],[1.52,0,-1.12]]} />
    {missionBay && <Parts geometry={cylinder} pieces={[{p:[.4,.11,.97],s:[.5,.13,.5],c:leaf}]} />}
  </group>;
}

function SfState() {
  const roofPieces: Piece[] = [
    {p:[-.75,1,-.72],s:[1.14,.9,1.14],c:'#c4b5a1'},
    {p:[.62,1,-.68],s:[.9,.68,.95],c:cream,r:[0,Math.PI,0]},
    {p:[.72,1.05,-1.09],s:[.68,.95,.62],c:stone},
  ];
  return <group name="sf-state-student-center-model">
    <Parts pieces={[{p:[0,.04,.15],s:[3.8,.08,3.1],c:'#bac6a1'},{p:[0,.48,-.18],s:[2.8,.96,1.7],c:cream},{p:[-.18,.31,.81],s:[1.52,.62,.52],c:stone},{p:[-.1,.78,.73],s:[2.5,.13,.1],c:'#81718a'},...Array.from({length:9},(_,i):Piece=>({p:[-1.16+i*.28,.49,.693],s:[.13,.35,.03],c:teal})),{p:[0,.065,1.23],s:[1.15,.07,.95],c:'#dfcda9'}]} />
    <Parts geometry={studentCenterRoof} pieces={roofPieces} />
    <Grove positions={[[-1.55,0,.7],[1.5,0,.85],[-1.4,0,-1.13]]} />
  </group>;
}

function Exploratorium() {
  const roof: Piece[] = Array.from({length:7},(_,i)=>({p:[-.38,.79,-1.22+i*.4],s:[.83,.1,.28],c:teal}));
  const windows: Piece[] = Array.from({length:8},(_,i)=>({p:[.51,.46,-1.3+i*.38],s:[.026,.33,.22],c:glass}));
  return <group name="exploratorium-pier-15-model" rotation={[0,-.7,0]}>
    <Parts pieces={[{p:[0,.09,0],s:[2,.18,4.1],c:'#c9bca3'},{p:[-.14,.44,-.14],s:[1.28,.7,3.35],c:cream},...roof,...windows,{p:[-.14,.65,1.62],s:[1.48,1.12,.32],c:stone},{p:[-.14,1.2,1.62],s:[1.55,.11,.4],c:cream},{p:[-.14,.6,1.79],s:[.87,.56,.028],c:glass},{p:[.55,.38,-1.83],s:[.85,.55,.55],c:glass},...Array.from({length:8},(_,i):Piece=>({p:[.91,.37,-1.7+i*.48],s:[.035,.49,.035],c:cream})),{p:[.91,.59,0],s:[.035,.035,3.7],c:cream}]} />
    <Parts geometry={cylinder} pieces={[-1.6,-.8,0,.8,1.6].flatMap(z=>[-.7,.7].map(x=>({p:[x,-.08,z] as V3,s:[.14,.35,.14] as V3,c:copper})))} />
  </group>;
}

function Stonestown() {
  return <group name="stonestown-galleria-model">
    <Parts pieces={[{p:[0,.04,0],s:[4.2,.08,3],c:'#dfd1b7'},{p:[0,.43,-.17],s:[3.6,.86,1.65],c:cream},{p:[-1.38,.56,-.3],s:[.82,1.12,1.92],c:stone},{p:[1.4,.53,-.3],s:[.86,1.06,1.92],c:stone},{p:[0,.5,.69],s:[1.77,.69,.035],c:glass},{p:[0,.93,.87],s:[2.06,.13,.73],c:'#c2a481'},{p:[-.93,.47,1.13],s:[.07,.94,.07],c:cream},{p:[.93,.47,1.13],s:[.07,.94,.07],c:cream},...Array.from({length:7},(_,i):Piece=>({p:[-.83+i*.28,1.03,-.28],s:[.13,.22,1.4],c:glass})),{p:[0,1.07,.45],s:[1.92,.19,.12],c:'#bd9e70'}]} />
    <Palms positions={[[-1.75,0,1.03],[1.75,0,1.03]]} />
  </group>;
}

function CityHall() {
  const columns: Piece[] = [-.55,-.33,-.11,.11,.33,.55].map(x=>({p:[x,.78,.9],s:[.105,.8,.105],c:cream}));
  const windowPieces: Piece[] = [];
  for (const side of [-1,1]) for(let i=0;i<5;i++) for(let floor=0;floor<2;floor++) windowPieces.push({p:[side*(.86+i*.24),.38+floor*.37,.71],s:[.115,.23,.03],c:teal});
  return <group name="city-hall-dome-model">
    <Parts pieces={[{p:[0,.06,0],s:[4,.12,2.5],c:stone},{p:[0,.63,0],s:[3.7,1.14,1.4],c:cream},{p:[0,1.2,0],s:[3.85,.13,1.53],c:stone},{p:[0,.13,1],s:[1.8,.14,.85],c:cream},{p:[0,1.22,.87],s:[1.42,.13,.44],c:cream},...windowPieces]} />
    <Parts geometry={cylinder} pieces={[...columns,{p:[0,1.48,0],s:[1.02,.45,1.02],c:cream},{p:[0,2.11,0],s:[.75,.22,.75],c:cream},{p:[0,2.63,0],s:[.19,.36,.19],c:'#d1a858'}]} />
    <Parts geometry={dome} pieces={[{p:[0,1.7,0],s:[.62,.48,.62],c:'#9fa98e'},{p:[0,2.21,0],s:[.41,.32,.41],c:'#9fa98e'}]} />
    <Parts geometry={sphere} pieces={[{p:[0,2.87,0],s:[.075,.12,.075],c:'#d1a858'}]} />
  </group>;
}

function Salesforce() {
  const bands: Piece[] = Array.from({length:25},(_,i)=>{
    const y=.2+i*.19, localY=y-.12;
    const segment=towerProfile.findIndex(([,height])=>height>=localY);
    const [r0,y0]=towerProfile[Math.max(0,segment-1)], [r1,y1]=towerProfile[segment];
    // Follow the exact lathe profile so facade bands stay outside the glass.
    const radius=r0+(r1-r0)*(localY-y0)/(y1-y0)+.012;
    return {p:[-.55,y,0],s:[radius*2,.033,radius*1.6],c:cream};
  });
  return <group name="salesforce-tower-and-park-model">
    <Parts geometry={tower} pieces={[{p:[-.55,.12,0],s:[1,1,.8],c:glass}]} />
    <Parts geometry={cylinder} pieces={bands} />
    <Parts pieces={[{p:[.65,.19,.24],s:[1.38,.38,2.94],c:cream},{p:[.65,.41,.24],s:[1.34,.10,2.88],c:leaf},{p:[.63,.475,.25],s:[.36,.03,2.63],c:'#ddcba8'},...[-.85,-.3,.3,.85].map((z):Piece=>({p:[.22,.19,z],s:[.08,.38,.08],c:stone}))]} />
    <Grove positions={[[.23,.47,-.82],[1.04,.47,-.43],[.28,.47,.23],[1.03,.47,.85]]} />
  </group>;
}

function Transamerica() {
  const windows: Piece[] = [];
  for(let floor=0;floor<21;floor++) {
    const y=.55+floor*.165, width=1.58*(1-(y-.39)/3.8);
    if(width>0) windows.push({p:[0,y,width/2+.006],s:[width*.83,.052,.023],c:teal},{p:[width/2+.006,y,0],s:[.023,.052,width*.83],c:teal});
  }
  return <group name="transamerica-pyramid-model">
    <Parts geometry={pyramid} pieces={[{p:[0,2.29,0],s:[1.58,3.8,1.58],r:[0,Math.PI/4,0],c:cream}]} />
    <Parts pieces={[{p:[0,.06,.13],s:[3,.12,2.6],c:'#d2c4a8'},...windows,{p:[0,4.4,0],s:[.07,.45,.07],c:cream},...[-.63,.63].flatMap(x=>[-.63,.63].map(z=>({p:[x,.26,z] as V3,s:[.16,.45,.16] as V3,c:cream}))),{p:[.61,2.69,0],s:[.19,1.45,.25],c:cream},{p:[-.61,2.69,0],s:[.19,1.45,.25],c:cream}]} />
    <Grove positions={[[1.04,0,-.7],[1.23,0,0],[1.01,0,.68]]} />
  </group>;
}

function OraclePark() {
  const steps: Piece[] = [];
  for(let row=0;row<3;row++) for(let i=0;i<16;i++) {
    const angle=.45+i*Math.PI*1.54/15, radius=1.44-row*.16;
    steps.push({p:[Math.sin(angle)*radius,.54-row*.12,Math.cos(angle)*radius],s:[.29,.15,.2],r:[0,angle,0],c:row%2?teal:'#6f8e72'});
  }
  return <group name="oracle-park-diamond-model" rotation={[0,.6,0]}>
    <Parts geometry={stadiumBowl} pieces={[{p:[0,.44,0],s:[1,1,1],c:copper}]} />
    <Parts geometry={cylinder} pieces={[{p:[0,.08,0],s:[3.7,.16,3.7],c:'#cfbaa0'},{p:[0,.18,0],s:[2.7,.07,2.7],c:leaf}]} />
    <Parts pieces={[...steps,{p:[0,.225,.14],s:[1.08,.035,1.08],r:[0,Math.PI/4,0],c:'#bf9a70'},{p:[0,.25,.14],s:[.62,.025,.62],r:[0,Math.PI/4,0],c:leaf},{p:[0,.28,-.15],s:[.12,.035,.12],c:cream},{p:[-.53,.27,.14],s:[.11,.04,.11],c:cream},{p:[.53,.27,.14],s:[.11,.04,.11],c:cream},{p:[0,.27,.66],s:[.11,.04,.11],c:cream},{p:[.85,1.02,-1.21],s:[1.13,.61,.12],r:[0,-.54,0],c:teal},...[-1,1].flatMap(side=>[-.8,.8].flatMap(z=>[{p:[side*1.59,1.04,z] as V3,s:[.055,1.76,.055] as V3,c:stone},{p:[side*1.59,1.89,z] as V3,s:[.6,.18,.12] as V3,c:cream}]))]} />
  </group>;
}

export const CivicLandmarkModel = memo(function CivicLandmarkModel({ id }: { id: string }) {
  switch(id) {
    case 'ucsf-parnassus': return <Campus />;
    case 'ucsf-mission-bay': return <Campus missionBay />;
    case 'sf-state': return <SfState />;
    case 'exploratorium': return <Exploratorium />;
    case 'stonestown': return <Stonestown />;
    case 'city-hall': return <CityHall />;
    case 'salesforce': return <Salesforce />;
    case 'transamerica': return <Transamerica />;
    case 'oracle-park': return <OraclePark />;
    default: return null;
  }
});
