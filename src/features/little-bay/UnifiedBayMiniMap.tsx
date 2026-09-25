import { BAY_LAND_AREAS, BAY_BRIDGES, UNIFIED_BAY_PLACES, type BayPoint } from './unified-bay-world';

// Keep the shoreline readable; the viewport expands for a remote route/player.
const points = [...UNIFIED_BAY_PLACES.filter(place=>place.id!=='lick').map(place=>place.position), ...BAY_BRIDGES.flatMap(bridge=>bridge.path)];
const landmarkBounds = [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
export default function UnifiedBayMiniMap({position,route,selectedKey,onOverview,label}:{position:BayPoint;route?:BayPoint[];selectedKey:string|null;onOverview:()=>void;label:string}) {
  const selected = UNIFIED_BAY_PLACES.find(place=>place.key===selectedKey);
  const visiblePoints=[position,...(route||[]),...(selected?[selected.position]:[])];
  const minX=Math.min(landmarkBounds[0],...visiblePoints.map(p=>p[0]))-25,minZ=Math.min(landmarkBounds[1],...visiblePoints.map(p=>p[1]))-25;
  const width=Math.max(landmarkBounds[2],...visiblePoints.map(p=>p[0]))-minX+25,height=Math.max(landmarkBounds[3],...visiblePoints.map(p=>p[1]))-minZ+25;
  return <button className="ub-mini-map" onClick={onOverview} aria-label={label} title={label}>
    <svg viewBox={`${minX} ${minZ} ${width} ${height}`} role="img" aria-label={label}>
      <rect x={minX} y={minZ} width={width} height={height} fill="#b5d5cd"/>
      {BAY_LAND_AREAS.map(area=><polygon key={area.id} points={area.ring.map(p=>p.join(',')).join(' ')} fill="#e9e4c7" stroke="#98b097" strokeWidth="3"/>)}
      {BAY_BRIDGES.map(bridge=><polyline key={bridge.id} points={bridge.path.map(p=>p.join(',')).join(' ')} stroke="#8e8170" strokeWidth="6" fill="none"/>)}
      {!!route?.length&&<polyline points={route.map(p=>p.join(',')).join(' ')} stroke="#dd8959" strokeWidth="9" fill="none"/>}
      {selected&&<circle cx={selected.position[0]} cy={selected.position[1]} r="13" fill="#e29661" stroke="#fff9ec" strokeWidth="5"/>}
      <circle cx={position[0]} cy={position[1]} r="14" fill="#267864" stroke="#fff9ec" strokeWidth="6"/>
    </svg><span aria-hidden="true">N ↑</span>
  </button>;
}
