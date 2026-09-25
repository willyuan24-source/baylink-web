import { SF_LANDMARKS, terrainHeight, type SfLandmark } from './sf-world';
import { REGIONAL_WORLDS, type RegionalPlace } from './regional-world';
import type { BayRegionId } from './bay-journey';

export type BayPoint = [x: number, z: number];
export type BayCoordinate = readonly [longitude: number, latitude: number];
export type UnifiedPlace = {
  key: string; region: BayRegionId; id: string; title: string; titleEn: string;
  coordinate: BayCoordinate; position: BayPoint; sf?: SfLandmark; regional?: RegionalPlace;
  sourceUrl: string; guideSlug?: string; plannerPlaceId?: string;
  arrivalRadius: number; modelScale: number;
};
export type BayRoad = { id: string; name: string; path: BayPoint[]; width: number; kind: 'road' | 'bridge' | 'ferry' };
export type BayBridge = BayRoad & { kind: 'bridge'; nameEn: string; height: number; color: string };
export type BayLandArea = { id: string; name: string; ring: BayPoint[] };

/** One continuous coordinate system, approximately 100 metres per world unit. */
export function projectBay([lng, lat]: readonly number[]): BayPoint { return [(lng + 122.20) * 880, (37.60 - lat) * 1113]; }
export function unprojectBay([x, z]: readonly number[]): BayCoordinate { return [x / 880 - 122.20, 37.60 - z / 1113]; }
const path = (coordinates: BayCoordinate[]) => coordinates.map(projectBay);

export const UNIFIED_BAY_PLACES: UnifiedPlace[] = [
  ...SF_LANDMARKS.map(sf => ({ key: `sf:${sf.id}`, region: 'sf' as const, id: sf.id, title: sf.title, titleEn: sf.titleEn,
    coordinate: sf.coordinate, position: projectBay(sf.coordinate), sf, sourceUrl: sf.sourceUrl, guideSlug: sf.guideSlug,
    plannerPlaceId: sf.plannerPlaceId, arrivalRadius: sf.arrivalRadius, modelScale: sf.modelScale ?? 1 })),
  ...Object.values(REGIONAL_WORLDS).flatMap(world => world.places.map(regional => ({ key: `${world.id}:${regional.id}`, region: world.id,
    id: regional.id, title: regional.title, titleEn: regional.titleEn, coordinate: regional.coordinate,
    position: projectBay(regional.coordinate), regional, sourceUrl: regional.sourceUrl, guideSlug: regional.guideSlug,
    plannerPlaceId: regional.plannerPlaceId, arrivalRadius: 4.2, modelScale: 1.4 }))),
];
export const UNIFIED_PLACES = UNIFIED_BAY_PLACES;
const placeIndex = new Map(UNIFIED_BAY_PLACES.map(place => [place.key, place]));
export const getUnifiedPlace = (key: string) => placeIndex.get(key);
export const BAY_REGION_FOCI: Record<BayRegionId, string> = {
  sf: 'sf:ferry', peninsula: 'peninsula:san-mateo-garden', 'south-bay': 'south-bay:tech', 'east-bay': 'east-bay:lake-merritt',
};
export const BAY_REGION_CENTERS: Record<BayRegionId, BayPoint> = {
  sf: projectBay([-122.447, 37.768]), peninsula: projectBay([-122.30, 37.51]),
  'south-bay': projectBay([-121.975, 37.345]), 'east-bay': projectBay([-122.18, 37.79]),
};

/**
 * Authored, simplified shoreline, not surveyed cartography. This single U-shaped
 * mainland joins San Francisco, the Peninsula, South Bay and East Bay without seams.
 * Alameda's small estuary and salt-pond channels are deliberately simplified.
 * Landmark coordinates remain their venue references; no imported map tiles are used.
 */
export const BAY_LAND_AREAS: BayLandArea[] = [
  { id: 'mainland', name: 'San Francisco · Peninsula · South Bay · East Bay', ring: path([
    [-122.518,37.785],[-122.507,37.791],[-122.493,37.791],[-122.483,37.798],[-122.479,37.812],
    [-122.467,37.811],[-122.459,37.806],[-122.447,37.808],[-122.432,37.808],[-122.425,37.812],
    [-122.415,37.814],[-122.404,37.811],[-122.398,37.805],[-122.395,37.802],[-122.388,37.796],
    [-122.386,37.786],[-122.381,37.778],[-122.385,37.765],[-122.374,37.750],[-122.369,37.740],
    [-122.353,37.727],[-122.352,37.714],[-122.377,37.710],[-122.375,37.691],[-122.368,37.670],
    [-122.348,37.656],[-122.327,37.630],[-122.310,37.612],[-122.301,37.591],[-122.292,37.583],
    [-122.273,37.585],[-122.256,37.575],[-122.240,37.563],[-122.231,37.548],[-122.245,37.530],
    [-122.245,37.511],[-122.217,37.505],[-122.200,37.493],[-122.173,37.487],[-122.147,37.485],
    [-122.126,37.478],[-122.101,37.466],[-122.090,37.450],[-122.069,37.439],[-122.030,37.439],
    [-122.001,37.447],[-121.977,37.454],[-121.967,37.469],[-121.982,37.490],[-122.012,37.521],
    [-122.061,37.546],[-122.087,37.575],[-122.126,37.602],[-122.142,37.621],[-122.153,37.653],
    [-122.182,37.684],[-122.208,37.707],[-122.228,37.727],[-122.248,37.736],[-122.256,37.754],
    [-122.273,37.755],[-122.294,37.761],[-122.311,37.770],[-122.317,37.785],[-122.309,37.803],
    [-122.326,37.819],[-122.334,37.840],[-122.334,37.864],[-122.338,37.883],[-122.356,37.905],
    [-122.357,37.953],[-121.58,37.953],[-121.56,37.17],[-122.23,37.17],[-122.352,37.32],
    [-122.418,37.40],[-122.451,37.46],[-122.502,37.51],[-122.535,37.57],[-122.526,37.66],
    [-122.512,37.72],[-122.519,37.768],
  ]) },
  { id: 'marin', name: 'Marin Headlands', ring: path([
    [-122.606,37.829],[-122.548,37.813],[-122.508,37.817],[-122.491,37.826],[-122.476,37.835],
    [-122.467,37.836],[-122.475,37.851],[-122.479,37.867],[-122.474,37.884],[-122.454,37.884],
    [-122.445,37.895],[-122.461,37.912],[-122.489,37.93],[-122.506,37.953],[-122.606,37.953],
  ]) },
  { id: 'alcatraz', name: 'Alcatraz Island', ring: path([
    [-122.428,37.827],[-122.426,37.830],[-122.422,37.830],[-122.418,37.827],[-122.420,37.823],[-122.425,37.823],
  ]) },
  { id: 'yerba-buena', name: 'Yerba Buena & Treasure Island', ring: path([
    [-122.380,37.807],[-122.376,37.816],[-122.366,37.825],[-122.359,37.823],[-122.361,37.813],
    [-122.365,37.811],[-122.361,37.803],[-122.367,37.798],[-122.375,37.800],
  ]) },
];

export const BAY_BRIDGES: BayBridge[] = [
  { id:'golden-gate',name:'金门大桥',nameEn:'Golden Gate Bridge',kind:'bridge',width:3.4,height:.65,color:'#c57954',
    path:path([[-122.4751,37.8068],[-122.4775,37.8205],[-122.4790,37.8344],[-122.4810,37.8372]]) },
  { id:'bay-bridge',name:'海湾大桥',nameEn:'Bay Bridge',kind:'bridge',width:4,height:.65,color:'#a49b83',
    path:path([[-122.3914,37.7852],[-122.3745,37.8018],[-122.3684,37.8085],[-122.3490,37.8196],[-122.3232,37.8245],[-122.3048,37.8259]]) },
  { id:'san-mateo',name:'圣马特奥–海沃德大桥',nameEn:'San Mateo–Hayward Bridge',kind:'bridge',width:3.8,height:.65,color:'#c2ac83',
    path:path([[-122.2735,37.5540],[-122.2510,37.5791],[-122.1840,37.6089],[-122.1195,37.6291],[-122.0940,37.6307]]) },
  { id:'dumbarton',name:'敦巴顿大桥',nameEn:'Dumbarton Bridge',kind:'bridge',width:3.6,height:.65,color:'#acb294',
    path:path([[-122.1390,37.4800],[-122.1285,37.4971],[-122.1120,37.5091],[-122.0807,37.5269],[-122.0470,37.5400],[-122.0300,37.5370]]) },
];

const road = (id:string,name:string,coordinates:BayCoordinate[],width=1.8):BayRoad => ({id,name,path:path(coordinates),width,kind:'road'});
export const BAY_ROADS: BayRoad[] = [
  road('us-101','US 101',[
    [-122.481,37.8372],[-122.4751,37.8068],[-122.451,37.796],[-122.422,37.799],[-122.422,37.775],
    [-122.409,37.762],[-122.405,37.741],[-122.400,37.714],[-122.401,37.68],[-122.377,37.651],
    [-122.350,37.62],[-122.328,37.592],[-122.300,37.57],[-122.2735,37.5540],[-122.263,37.514],
    [-122.246,37.502],[-122.227,37.491],[-122.189,37.47],[-122.1390,37.4800],[-122.134,37.452],[-122.101,37.416],
    [-122.065,37.397],[-122.028,37.391],[-121.982,37.376],[-121.935,37.362],[-121.899,37.346],[-121.878,37.322],
  ],2.3),
  road('el-camino','El Camino Real',[
    [-122.47,37.704],[-122.443,37.671],[-122.415,37.639],[-122.371,37.604],[-122.347,37.583],
    [-122.323,37.564],[-122.294,37.539],[-122.270,37.513],[-122.234,37.489],[-122.194,37.453],
    [-122.168,37.428],[-122.125,37.411],[-122.086,37.39],[-122.045,37.377],[-122.005,37.354],[-121.941,37.341],[-121.892,37.333],
  ]),
  road('i-280','I 280',[
    [-122.455,37.757],[-122.462,37.729],[-122.47,37.704],[-122.465,37.67],[-122.453,37.63],
    [-122.415,37.591],[-122.365,37.547],[-122.343,37.519],[-122.310,37.467],[-122.246,37.422],
    [-122.168,37.386],[-122.119,37.364],[-122.07,37.335],[-122.025,37.318],[-121.956,37.314],[-121.895,37.320],
  ],2.1),
  road('i-880','I 880 · Eastshore',[
    [-122.303,37.906],[-122.297,37.872],[-122.298,37.850],[-122.3048,37.8259],[-122.289,37.806],
    [-122.278,37.795],[-122.238,37.779],[-122.209,37.753],[-122.186,37.724],[-122.159,37.694],
    [-122.130,37.667],[-122.0940,37.6307],[-122.070,37.598],[-122.042,37.567],[-122.030,37.537],
    [-121.985,37.506],[-121.953,37.477],[-121.941,37.445],[-121.917,37.408],[-121.906,37.370],[-121.899,37.346],
  ],2.3),
  road('ca-92','CA 92 · Coast to bay',[
    [-122.446,37.466],[-122.427,37.473],[-122.399,37.489],[-122.369,37.506],[-122.343,37.519],
    [-122.315,37.540],[-122.294,37.549],[-122.2735,37.5540],
  ]),
  road('ca-84','CA 84 · Woodside',[
    [-122.281,37.430],[-122.264,37.452],[-122.234,37.489],[-122.189,37.47],[-122.1390,37.4800],
  ]),
  road('ca-237','CA 237 · South Bay',[
    [-122.065,37.397],[-122.030,37.408],[-121.991,37.418],[-121.967,37.416],[-121.941,37.420],[-121.917,37.408],
  ]),
  road('sf-market','Market St',[[ -122.3888,37.794],[-122.403,37.788],[-122.419,37.776],[-122.436,37.761],[-122.455,37.757]],1.4),
  road('sf-geary','Geary Blvd',[[ -122.505,37.780],[-122.482,37.781],[-122.451,37.782],[-122.422,37.785],[-122.404,37.789]],1.2),
  road('sf-19th','19th Ave',[[ -122.478,37.781],[-122.477,37.766],[-122.477,37.747],[-122.476,37.722],[-122.47,37.704]],1.5),
  road('sf-embarcadero','The Embarcadero',[[ -122.413,37.808],[-122.406,37.807],[-122.399,37.800],[-122.394,37.795],[-122.3914,37.7852],[-122.389,37.778],[-122.392,37.768]],1.2),
  road('sf-marina','Marina Blvd · Lombard St',[[ -122.4751,37.8068],[-122.458,37.801],[-122.437,37.802],[-122.419,37.800],[-122.413,37.808]],1.3),
  road('sf-golden-gate-park','Lincoln Way',[[ -122.509,37.765],[-122.479,37.766],[-122.461,37.766],[-122.453,37.766]],1.2),
  road('south-stevens-creek','Stevens Creek Blvd',[[ -122.083,37.323],[-122.026,37.323],[-121.964,37.323],[-121.928,37.324],[-121.892,37.333]],1.4),
  road('south-saratoga','Saratoga Ave',[[ -122.03,37.255],[-122.014,37.283],[-121.985,37.31],[-121.964,37.323]],1.2),
  road('mount-hamilton','CA 130 · Mount Hamilton',[[ -121.892,37.333],[-121.850,37.355],[-121.809,37.367],[-121.788,37.34],[-121.749,37.327],[-121.713,37.360],[-121.671,37.361],[-121.6429,37.3414]],1.1),
  road('berkeley-university','University Ave',[[ -122.297,37.872],[-122.276,37.872],[-122.2585,37.872],[-122.237,37.876]],1.3),
  road('east-skyline','Skyline Blvd',[[ -122.244,37.910],[-122.239,37.883],[-122.224,37.856],[-122.193,37.830],[-122.160,37.807],[-122.148,37.784]],1.2),
  road('alameda','Alameda waterfront',[[ -122.278,37.795],[-122.264,37.782],[-122.2706,37.7622],[-122.3024,37.7727]],1.2),
  road('fremont-mission','Mission Blvd',[[ -122.042,37.567],[-121.976,37.550],[-121.927,37.531],[-121.895,37.512],[-121.941,37.445]],1.3),
  ...BAY_BRIDGES,
];

export const BAY_FERRY_ROUTES: BayRoad[] = [
  { id:'alcatraz-ferry',name:'Pier 33 ↔ Alcatraz',kind:'ferry',width:0,
    path:path([[-122.404663,37.80767],[-122.407,37.816],[-122.417,37.822],[-122.4230122,37.8266636]]) },
];
export const BAY_WORLD_BOUNDS = BAY_LAND_AREAS.flatMap(area=>area.ring).reduce((bounds,[x,z])=>({
  minX:Math.min(bounds.minX,x),maxX:Math.max(bounds.maxX,x),minZ:Math.min(bounds.minZ,z),maxZ:Math.max(bounds.maxZ,z),
}),{minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity});

function inRing(x:number,z:number,ring:BayPoint[]) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export function bayContains(x:number,z:number):boolean {
  return Number.isFinite(x)&&Number.isFinite(z)&&BAY_LAND_AREAS.some(area=>inRing(x,z,area.ring));
}
export function distanceToBaySegment(point:readonly number[],a:readonly number[],b:readonly number[]) {
  const dx=b[0]-a[0],dz=b[1]-a[1],lengthSquared=dx*dx+dz*dz;
  const t=lengthSquared?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/lengthSquared)):0;
  return Math.hypot(point[0]-a[0]-dx*t,point[1]-a[1]-dz*t);
}
export function bayBridgeAt(x:number,z:number):BayBridge|undefined {
  return BAY_BRIDGES.find(bridge=>bridge.path.slice(1).some((b,i)=>distanceToBaySegment([x,z],bridge.path[i],b)<=bridge.width/2));
}
export function bayCanMove(x:number,z:number,radius=0):boolean {
  const contains=(px:number,pz:number)=>bayContains(px,pz)||Boolean(bayBridgeAt(px,pz));
  if(!Number.isFinite(x)||!Number.isFinite(z)||!contains(x,z))return false;
  if(radius<=0)return true;
  return [[radius,0],[-radius,0],[0,radius],[0,-radius]].every(([dx,dz])=>contains(x+dx,z+dz));
}
/** Ferry steering remains inside the marked crossing, with dry-land handoff. */
export function bayFerryCanMove(x:number,z:number):boolean {
  if(!Number.isFinite(x)||!Number.isFinite(z)||x<BAY_WORLD_BOUNDS.minX||x>BAY_WORLD_BOUNDS.maxX||z<BAY_WORLD_BOUNDS.minZ||z>BAY_WORLD_BOUNDS.maxZ)return false;
  if(bayCanMove(x,z))return true;
  return BAY_FERRY_ROUTES.some(ferry=>ferry.path.slice(1).some((b,i)=>distanceToBaySegment([x,z],ferry.path[i],b)<=2));
}
/**
 * Split at all coastline and bridge-capsule intersections, then inspect every
 * interval. Sampling alone misses small water gaps at a slanted bridge approach.
 * The optional step remains for callers requesting an additional dense check.
 */
export function baySegmentCanMove(a:readonly number[],b:readonly number[],step=Infinity):boolean {
  if(!bayCanMove(a[0],a[1])||!bayCanMove(b[0],b[1]))return false;
  const dx=b[0]-a[0],dz=b[1]-a[1],lengthSquared=dx*dx+dz*dz;
  if(lengthSquared<1e-12)return true;
  const cuts=[0,1];
  const add=(t:number)=>{if(t>0&&t<1)cuts.push(t);};
  const intersect=(p:readonly number[],q:readonly number[])=>{
    const ex=q[0]-p[0],ez=q[1]-p[1],denominator=dx*ez-dz*ex;
    if(Math.abs(denominator)<1e-12)return;
    const px=p[0]-a[0],pz=p[1]-a[1],t=(px*ez-pz*ex)/denominator,u=(px*dz-pz*dx)/denominator;
    if(u>=0&&u<=1)add(t);
  };
  for(const area of BAY_LAND_AREAS)for(let i=0,j=area.ring.length-1;i<area.ring.length;j=i++)intersect(area.ring[j],area.ring[i]);
  for(const bridge of BAY_BRIDGES)for(let i=1;i<bridge.path.length;i++){
    const p=bridge.path[i-1],q=bridge.path[i],radius=bridge.width/2;
    const ex=q[0]-p[0],ez=q[1]-p[1],length=Math.hypot(ex,ez),nx=-ez/length*radius,nz=ex/length*radius;
    intersect([p[0]+nx,p[1]+nz],[q[0]+nx,q[1]+nz]);
    intersect([p[0]-nx,p[1]-nz],[q[0]-nx,q[1]-nz]);
    for(const center of [p,q]){
      const ox=a[0]-center[0],oz=a[1]-center[1],linear=2*(ox*dx+oz*dz),constant=ox*ox+oz*oz-radius*radius;
      const discriminant=linear*linear-4*lengthSquared*constant;
      if(discriminant>=0){const root=Math.sqrt(discriminant);add((-linear-root)/(2*lengthSquared));add((-linear+root)/(2*lengthSquared));}
    }
  }
  if(Number.isFinite(step)){
    const count=Math.ceil(Math.sqrt(lengthSquared)/Math.max(.1,step));for(let i=1;i<count;i++)cuts.push(i/count);
  }
  cuts.sort((x,y)=>x-y);
  for(let i=1;i<cuts.length;i++){
    if(cuts[i]-cuts[i-1]<1e-10)continue;
    const t=(cuts[i]+cuts[i-1])/2;if(!bayCanMove(a[0]+dx*t,a[1]+dz*t))return false;
  }
  return true;
}
const regionalHills=Object.values(REGIONAL_WORLDS).flatMap(world=>world.hills.map(hill=>({position:projectBay(hill.coordinate),radius:hill.radius*2.5,height:hill.height})));
export function bayHeight(x:number,z:number):number {
  const bridge=bayBridgeAt(x,z);
  if(bridge)return bridge.height;
  let height=.3+terrainHeight(x+220,z+189.21);
  for(const hill of regionalHills){const d=Math.hypot(x-hill.position[0],z-hill.position[1]);if(d<hill.radius*3)height+=hill.height*Math.exp(-(d*d)/(hill.radius*hill.radius));}
  return height;
}
export function bayArrival(x:number,z:number):UnifiedPlace|null {
  let closest:UnifiedPlace|null=null,best=Infinity;
  for(const place of UNIFIED_BAY_PLACES){const distance=Math.hypot(x-place.position[0],z-place.position[1]);if(distance<place.arrivalRadius&&distance<best){closest=place;best=distance;}}
  return closest;
}
export function baySpawn(placeOrKey:UnifiedPlace|string):{x:number;z:number;heading:number} {
  const place=typeof placeOrKey==='string'?getUnifiedPlace(placeOrKey):placeOrKey;
  if(!place)throw new RangeError(`Unknown Bay Area landmark: ${placeOrKey}`);
  for(const extra of [1.1,.65,1.8,2.8])for(let i=0;i<24;i++){
    const angle=i*Math.PI/12,distance=place.arrivalRadius+extra;
    const candidate:BayPoint=[place.position[0]+Math.sin(angle)*distance,place.position[1]+Math.cos(angle)*distance];
    if(bayCanMove(...candidate,.15)&&!bayArrival(...candidate)&&baySegmentCanMove(candidate,place.position))
      return {x:candidate[0],z:candidate[1],heading:Math.atan2(place.position[0]-candidate[0],place.position[1]-candidate[1])};
  }
  // A narrow island can still start at its public game landing. Arrival requires
  // actual movement in the controller; this never creates a hidden water spawn.
  if(bayCanMove(...place.position))return {x:place.position[0],z:place.position[1],heading:0};
  throw new RangeError(`Landmark has no playable arrival: ${place.key}`);
}
/** Stop at the public-facing miniature entrance, never in the model's centre. */
export function bayApproach(placeOrKey:UnifiedPlace|string):BayPoint {
  const place=typeof placeOrKey==='string'?getUnifiedPlace(placeOrKey):placeOrKey;
  if(!place)throw new RangeError(`Unknown Bay Area landmark: ${placeOrKey}`);
  const spawn=baySpawn(place),dx=spawn.x-place.position[0],dz=spawn.z-place.position[1],length=Math.hypot(dx,dz);
  for(const factor of [.8,.7,.6,.5]){
    const distance=place.arrivalRadius*factor;
    const point:BayPoint=[place.position[0]+(length?dx/length:0)*distance,place.position[1]+(length?dz/length:1)*distance];
    if(bayArrival(...point)?.key===place.key&&bayCanMove(...point,.1)&&baySegmentCanMove([spawn.x,spawn.z],point))return point;
  }
  return [...place.position];
}
export function bayRegionAt(x:number,z:number):BayRegionId|null {
  if(!bayCanMove(x,z))return null;
  const [lng,lat]=unprojectBay([x,z]);
  if(lat>37.818&&lng< -122.438)return null; // Marin is scenery, not a fifth content district.
  if(lat>37.81&&lng< -122.395)return 'sf'; // Alcatraz.
  // Alameda's western tip projects farther into the bay than Oakland's shore.
  const bayMiddleLongitude=lat>=37.745?-122.35:-122.08-(lat-37.48)*.72;
  if(lng>bayMiddleLongitude&&lat>37.455)return 'east-bay';
  if(lat<37.455&&lng> -122.155)return 'south-bay';
  if(lat>=37.708&&lng< -122.35)return 'sf';
  if(lat>=37.79&&lng>= -122.395)return lng< -122.367?'sf':'east-bay';
  return 'peninsula';
}
