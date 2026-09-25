export const BAY_REGIONS = [
  {id:'sf',zh:'旧金山',en:'San Francisco',tagZh:'海湾、校园与城市奇遇',tagEn:'Waterfront, campuses & city curiosities',color:'#bf8568',symbol:'⌂'},
  {id:'peninsula',zh:'中半岛',en:'Peninsula',tagZh:'花园、校园与海岸小镇',tagEn:'Gardens, campuses & coastal towns',color:'#8a9a68',symbol:'❀'},
  {id:'south-bay',zh:'南湾',en:'South Bay',tagZh:'科技、果园与山间星空',tagEn:'Technology, orchards & mountain skies',color:'#6c9697',symbol:'✦'},
  {id:'east-bay',zh:'东湾',en:'East Bay',tagZh:'湖泊、红杉与港口故事',tagEn:'Lakes, redwoods & harbor stories',color:'#a98eaf',symbol:'♧'},
] as const;
export type BayRegionId = typeof BAY_REGIONS[number]['id'];
export const isBayRegion = (value:unknown):value is BayRegionId => BAY_REGIONS.some(region=>region.id===value);

/** Lightweight allowlist shared by the passport. Coverage tests keep it in sync with scenes. */
export const BAY_WORLD_PLACE_IDS: Record<BayRegionId, readonly string[]> = {
  sf:['bridge','presidio','palace','lombard','pier','alcatraz','chinatown','ferry','park','cable-car','twin-peaks','union-square','castro','skystar','coit','painted-ladies','sutro','japanese-tea-garden','academy','de-young','ocean-beach','baker-beach','lands-end','ucsf-parnassus','ucsf-mission-bay','sf-state','exploratorium','stonestown','city-hall','salesforce','transamerica','oracle-park'],
  peninsula:['san-mateo-garden','burlingame','foster-city','hiller','redwood-square','filoli','stanford','baylands','half-moon-bay','coyote-point','pulgas-temple','san-mateo-station','daly-city-bart','orange-memorial','south-sf-bart','san-bruno-park','san-bruno-bart','millbrae-transit','sfo-airport','twin-pines','burgess-park','menlo-park-station'],
  'south-bay':['tech','sj-japantown','rosicrucian','winchester','hakone','apple-visitor','computer-history','google-visitor','shoreline','alviso','lick','diridon','sunnyvale-heritage','sunnyvale-station','santa-clara-university','santa-clara-central-park','milpitas-bart','ed-levin'],
  'east-bay':['berkeley','berkeley-garden','tilden','lake-merritt','omca','jack-london','alameda-beach','hornet','chabot','redwood','ardenwood','mission-peak','hayward-garden','hayward-bart','fremont-central-park','fremont-bart'],
};
export type BayJourney = {version:1;visits:Record<string,string>};
export const emptyBayJourney = ():BayJourney => ({version:1,visits:{}});
export const bayJourneyKey = (owner?:string) => `baylink.bay-journey.v1:${owner?`user:${encodeURIComponent(owner)}`:'guest'}`;
export function validJourneyPlace(key:string) {
  const [region,id,...extra]=key.split(':');
  return !extra.length&&isBayRegion(region)&&BAY_WORLD_PLACE_IDS[region].includes(id);
}
export function parseBayJourney(raw:string|null):BayJourney {
  if(!raw||raw.length>50_000)return emptyBayJourney();
  try {
    const value=JSON.parse(raw);
    if(value?.version!==1||!value.visits||typeof value.visits!=='object'||Array.isArray(value.visits))return emptyBayJourney();
    const visits=Object.fromEntries(Object.entries(value.visits).filter(([key,date])=>validJourneyPlace(key)&&typeof date==='string'&&date.length<=40&&Number.isFinite(Date.parse(date))));
    return {version:1,visits:visits as Record<string,string>};
  }catch{return emptyBayJourney();}
}
export function visitBayPlace(journey:BayJourney,region:BayRegionId,id:string,now=new Date()):BayJourney {
  const key=`${region}:${id}`;
  if(!validJourneyPlace(key)||journey.visits[key]||!Number.isFinite(now.getTime()))return journey;
  return {version:1,visits:{...journey.visits,[key]:now.toISOString()}};
}
export const visitedInRegion = (journey:BayJourney,region:BayRegionId) => BAY_WORLD_PLACE_IDS[region].filter(id=>Boolean(journey.visits[`${region}:${id}`]));
