import { BAY_FERRY_ROUTES, BAY_ROADS, UNIFIED_BAY_PLACES, bayApproach, bayArrival, bayCanMove, bayFerryCanMove, baySegmentCanMove, getUnifiedPlace, type BayPoint, type UnifiedPlace } from './unified-bay-world';

export type BayRouteLeg = { mode:'land'|'ferry'; points:BayPoint[]; name?:string };
export type BayRoute = {
  available:boolean; points:BayPoint[]; legs:BayRouteLeg[];
  /** Game-world units, never a real road distance or journey-time promise. */
  distance:number; requiresFerry:boolean;
};
type Edge = { to:number; points:BayPoint[]; distance:number; mode:'land'|'ferry'; name:string };
type Node = { point:BayPoint; edges:Edge[] };
type Graph = { nodes:Node[]; index:Map<string,number> };
const keyOf=(point:readonly number[])=>`${point[0].toFixed(4)},${point[1].toFixed(4)}`;
const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const routeDistance=(points:readonly (readonly number[])[])=>points.slice(1).reduce((sum,point,i)=>sum+distance(points[i],point),0);
const unavailable=():BayRoute=>({available:false,points:[],legs:[],distance:0,requiresFerry:false});

function addNode(graph:Graph,point:BayPoint) {
  const key=keyOf(point),known=graph.index.get(key);
  if(known!==undefined)return known;
  const index=graph.nodes.length;graph.nodes.push({point,edges:[]});graph.index.set(key,index);return index;
}
function addEdge(graph:Graph,a:number,b:number,points:BayPoint[],mode:'land'|'ferry',name:string) {
  if(a===b||graph.nodes[a].edges.some(edge=>edge.to===b))return;
  const length=routeDistance(points);
  graph.nodes[a].edges.push({to:b,points,distance:length,mode,name});
  graph.nodes[b].edges.push({to:a,points:[...points].reverse(),distance:length,mode,name});
}
function joinVisible(graph:Graph,index:number,maxDistance:number,limit:number,againstCount=graph.nodes.length) {
  const node=graph.nodes[index];
  const candidates=graph.nodes.slice(0,againstCount).map((other,i)=>({i,d:distance(node.point,other.point)}))
    .filter(item=>item.i!==index&&item.d<=maxDistance).sort((a,b)=>a.d-b.d);
  let count=0;
  for(const candidate of candidates){
    if(!baySegmentCanMove(node.point,graph.nodes[candidate.i].point))continue;
    addEdge(graph,index,candidate.i,[node.point,graph.nodes[candidate.i].point],'land','Local connection');
    if(++count>=limit)break;
  }
}

let cachedGraph:Graph|undefined;
function baseGraph():Graph {
  if(cachedGraph)return cachedGraph;
  const graph:Graph={nodes:[],index:new Map()};
  for(const road of BAY_ROADS){
    for(let i=1;i<road.path.length;i++){
      const a=road.path[i-1],b=road.path[i],count=Math.max(1,Math.ceil(distance(a,b)/8));
      let previous:number|undefined;
      for(let j=0;j<=count;j++){
        const t=j/count,point:BayPoint=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
        if(!bayCanMove(...point)){previous=undefined;continue;}
        const index=addNode(graph,point);
        if(previous!==undefined&&baySegmentCanMove(graph.nodes[previous].point,point))
          addEdge(graph,previous,index,[graph.nodes[previous].point,point],'land',road.name);
        previous=index;
      }
    }
  }
  const roadCount=graph.nodes.length;
  // Join geometric road intersections and close corridor endpoints only on
  // traversable ground. Every edge is checked, including shoreline shortcuts.
  for(let i=0;i<roadCount;i++)joinVisible(graph,i,19,6,roadCount);
  for(const place of UNIFIED_BAY_PLACES){
    const index=addNode(graph,place.position);
    joinVisible(graph,index,Infinity,8,roadCount);
  }
  for(const ferry of BAY_FERRY_ROUTES){
    const start=addNode(graph,ferry.path[0]),end=addNode(graph,ferry.path[ferry.path.length-1]);
    joinVisible(graph,start,Infinity,8);
    joinVisible(graph,end,Infinity,8);
    addEdge(graph,start,end,ferry.path,'ferry',ferry.name);
  }
  cachedGraph=graph;return graph;
}

/**
 * Routes on a connected game road graph. Water is never a driving shortcut.
 * Alcatraz has a labelled ferry leg in both directions; the UI/scene changes
 * to a boat for that leg. This is exploration guidance, not real navigation.
 */
export function routeBay(from:BayPoint,to:BayPoint|UnifiedPlace|string):BayRoute {
  const place=typeof to==='string'?getUnifiedPlace(to):Array.isArray(to)?undefined:to;
  const target=place?bayApproach(place):Array.isArray(to)?to:undefined;
  if(!target||!bayCanMove(...target))return unavailable();
  if(!bayCanMove(...from))return routeFromFerry(from,target);
  if(place&&bayArrival(...from)?.key===place.key)return {available:true,points:[[...from]],legs:[],distance:0,requiresFerry:false};
  if(distance(from,target)<.001)return {available:true,points:[[...from]],legs:[],distance:0,requiresFerry:false};
  if(distance(from,target)<22&&baySegmentCanMove(from,target)){
    const points:BayPoint[]=[[...from],[...target]];
    return {available:true,points,legs:[{mode:'land',points,name:'Local connection'}],distance:routeDistance(points),requiresFerry:false};
  }
  const base=baseGraph();
  // Edges and nodes are copied because start/end attachments must never leak
  // into the cached graph across successive navigation requests.
  const graph:Graph={nodes:base.nodes.map(node=>({point:node.point,edges:[...node.edges]})),index:new Map(base.index)};
  const baseCount=graph.nodes.length,start=addNode(graph,from),end=addNode(graph,[...target]);
  joinVisible(graph,start,Infinity,8,baseCount);
  joinVisible(graph,end,Infinity,8,baseCount);
  const scores=new Map<number,number>([[start,0]]),previous=new Map<number,{node:number;edge:Edge}>();
  const open=new Set<number>([start]),closed=new Set<number>();
  while(open.size){
    let current=-1,best=Infinity;
    for(const index of open){const score=(scores.get(index)??Infinity)+distance(graph.nodes[index].point,target);if(score<best){best=score;current=index;}}
    if(current===end)break;
    if(current===-1)return unavailable();
    open.delete(current);closed.add(current);
    for(const edge of graph.nodes[current].edges){
      if(closed.has(edge.to))continue;
      const next=(scores.get(current)??Infinity)+edge.distance;
      if(next<(scores.get(edge.to)??Infinity)){scores.set(edge.to,next);previous.set(edge.to,{node:current,edge});open.add(edge.to);}
    }
  }
  if(!previous.has(end))return unavailable();
  const edges:Edge[]=[];let cursor=end;
  while(cursor!==start){const step=previous.get(cursor);if(!step)return unavailable();edges.unshift(step.edge);cursor=step.node;}
  const legs:BayRouteLeg[]=[];
  for(const edge of edges){
    const prior=legs[legs.length-1];
    if(prior&&prior.mode===edge.mode&&prior.name===edge.name)prior.points.push(...edge.points.slice(1));
    else legs.push({mode:edge.mode,points:edge.points.map(point=>[...point]),name:edge.name});
  }
  const points=legs.flatMap((leg,index)=>index?leg.points.slice(1):leg.points);
  return {available:true,points,legs,distance:routeDistance(points),requiresFerry:legs.some(leg=>leg.mode==='ferry')};
}

/**
 * Rejoin the nearest ferry segment after steering or pausing at sea. Both
 * terminal directions are considered; every continuation follows the authored
 * channel bends rather than cutting across open water toward an old waypoint.
 */
function routeFromFerry(from:BayPoint,target:BayPoint):BayRoute {
  if(!bayFerryCanMove(...from))return unavailable();
  let best:BayRoute|undefined;
  for(const ferry of BAY_FERRY_ROUTES){
    let nearest:{index:number;point:BayPoint;distance:number}|undefined;
    for(let i=1;i<ferry.path.length;i++){
      const a=ferry.path[i-1],b=ferry.path[i],dx=b[0]-a[0],dz=b[1]-a[1],squared=dx*dx+dz*dz;
      const t=squared?Math.max(0,Math.min(1,((from[0]-a[0])*dx+(from[1]-a[1])*dz)/squared)):0;
      const point:BayPoint=[a[0]+dx*t,a[1]+dz*t],d=distance(from,point);
      if(!nearest||d<nearest.distance)nearest={index:i-1,point,distance:d};
    }
    if(!nearest||nearest.distance>2.000001)continue;
    for(const towardEnd of [false,true]){
      const rest=towardEnd?ferry.path.slice(nearest.index+1):ferry.path.slice(0,nearest.index+1).reverse();
      const ferryPoints=[from,nearest.point,...rest].filter((point,i,all)=>!i||distance(point,all[i-1])>.000001);
      const terminal=ferryPoints[ferryPoints.length-1],tail=routeBay(terminal,target);
      if(!tail.available)continue;
      const legs:BayRouteLeg[]=[{mode:'ferry',points:ferryPoints,name:ferry.name},...tail.legs];
      const points=legs.flatMap((leg,i)=>i?leg.points.slice(1):leg.points),total=routeDistance(points);
      if(!best||total<best.distance)best={available:true,points,legs,distance:total,requiresFerry:true};
    }
  }
  return best||unavailable();
}
