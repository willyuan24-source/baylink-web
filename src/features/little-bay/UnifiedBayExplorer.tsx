import { Component, lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Camera, CarFront, Check, Compass, Expand, Footprints, Leaf, Map, MapPin, Minus, Navigation, Pause, Play, Plus, RotateCcw, Search, Sparkles, Stamp, Sun, X } from 'lucide-react';
import { translateText, useLocale } from '../../i18n/locale';
import { BAY_REGIONS, type BayJourney, type BayRegionId } from './bay-journey';
import { UNIFIED_BAY_PLACES, BAY_REGION_FOCI, baySpawn, type BayPoint } from './unified-bay-world';
import { routeBay } from './unified-bay-routing';
import type { UnifiedBaySceneProps } from './UnifiedBayScene';
import type { SfCameraCommand } from './sf-camera';
import type { SfMovementInput } from './sf-movement-input';
import SfTouchJoystick from './SfTouchJoystick';
import { useSfTouchControls } from './useSfTouchControls';
import UnifiedBayMiniMap from './UnifiedBayMiniMap';
import UnifiedPlacePanel from './UnifiedPlacePanel';
import BayAdventureJournal from './BayAdventureJournal';
import { useBayAdventures } from './useBayAdventures';
import { useSfExploration } from './useSfExploration';
import { SF_EXPLORATION_STOP_BY_ID } from './sf-exploration';
import SfExplorationPanel from './SfExplorationPanel';
import { BAY_CITIES, bayCityForPlace } from './bay-cities';
import { useBayCityArrival } from './useBayCityArrival';
import { BAY_DISCOVERIES } from './bay-discoveries';
import { useBayDiscoveries } from './useBayDiscoveries';
import BayDiscoveryPanel from './BayDiscoveryPanel';
import BayFieldGuide from './BayFieldGuide';
import BayCityGuide from './BayCityGuide';
import { cityEventCounts, cityGuidePlaces } from './bay-city-guide';
import { todayInBay } from '../../lib/planner';
import { PLANNER_EVENTS } from '../../data/planner-catalog';

const Scene = lazy(()=>import('./UnifiedBayScene'));
const emptyInput=():SfMovementInput=>({forward:false,backward:false,left:false,right:false});
class BaySceneBoundary extends Component<{children:ReactNode;fallback:ReactNode;onError:()=>void},{failed:boolean}> {
  state={failed:false};static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.onError();}
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}
export type UnifiedBayExplorerProps={
  date:string;ownerId?:string;journey:BayJourney;persistent:boolean;
  regionFocus?:{id:number;region:BayRegionId};onRegionChange?:(region:BayRegionId)=>void;
  onVisit:(region:BayRegionId,id:string)=>void;onAddPlace?:(id:string)=>void;addedPlaceIds:readonly string[];
  onAsk?:(question:string)=>void;onShowList:()=>void;onOpenTown?:()=>void;
};

function PlaceSearch({selectedKey,onSelect,onCitySelect,onClose}:{selectedKey:string|null;onSelect:(key:string)=>void;onCitySelect:(id:string)=>void;onClose:()=>void}) {
  const locale=useLocale(),t=(zh:string,en:string)=>locale==='en'?en:translateText(zh,locale);
  const [query,setQuery]=useState(''),[region,setRegion]=useState('all');
  const panel=useRef<HTMLElement>(null),field=useRef<HTMLInputElement>(null),title=useId();
  useEffect(()=>{const old=document.activeElement as HTMLElement|null;field.current?.focus();return()=>{if(old?.isConnected)old.focus({preventScroll:true});};},[]);
  const items=UNIFIED_BAY_PLACES.filter(p=>(region==='all'||p.region===region)&&`${p.title} ${p.titleEn} ${p.regional?.city||''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const cities=BAY_CITIES.filter(city=>(region==='all'||city.region===region)&&`${city.name} ${city.nameEn}`.toLowerCase().includes(query.trim().toLowerCase()));
  const keys=(event:KeyboardEvent<HTMLElement>)=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();onClose();}if(event.key==='Tab'){const controls=[...(panel.current?.querySelectorAll<HTMLElement>('input,button:not(:disabled),[tabindex="0"]')||[])];const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
  return <div className="ub-overlay" onPointerDown={e=>e.stopPropagation()} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section className="ub-search-panel" role="dialog" aria-modal="true" aria-labelledby={title} ref={panel} onKeyDown={keys}>
    <header><div><small>ONE BAY · MANY LITTLE DISCOVERIES</small><h3 id={title}>{t('下一站，想去哪里？','Where would you like to go?')}</h3></div><button onClick={onClose} aria-label={t('关闭地点搜索','Close place search')}><X size={20}/></button></header>
    <label className="ub-search-input"><Search size={19}/><input ref={field} value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('搜索景点、校园或城市','Search a place, campus or city')} aria-label={t('搜索全湾区地点','Search all Bay Area places')}/></label>
    <div className="ub-search-regions"><button aria-pressed={region==='all'} onClick={()=>setRegion('all')}>{t('全部','All')}</button>{BAY_REGIONS.map(item=><button key={item.id} aria-pressed={region===item.id} onClick={()=>setRegion(item.id)}>{t(item.zh,item.en)}</button>)}</div>
    <p className="ub-result-count">{cities.length} {t('座城市与社区','cities & communities')} · {items.length} {t('处景点 · 点选只浏览','places · Preview only')}</p>
    <div className="ub-search-results">{!!cities.length&&<div className="ub-city-search"><small>{t('先逛一座城','EXPLORE A CITY')}</small><div>{cities.map(city=><button key={city.id} onClick={()=>onCitySelect(city.id)}><MapPin size={14}/>{t(city.name,city.nameEn)}</button>)}</div></div>}{items.map(place=>{const city=bayCityForPlace(place);return <button key={place.key} onClick={()=>onSelect(place.key)} aria-pressed={selectedKey===place.key}><span>{place.region==='sf'?'⌂':place.region==='peninsula'?'❀':place.region==='south-bay'?'✦':'♧'}</span><div><strong>{t(place.title,place.titleEn)}</strong><small>{city?t(city.name,city.nameEn):t(BAY_REGIONS.find(r=>r.id===place.region)!.zh,BAY_REGIONS.find(r=>r.id===place.region)!.en)}</small></div><ArrowRight size={17}/></button>;})}{!items.length&&!cities.length&&<p>{t('没有找到，试试景点的英文名称。','No matches. Try another place name.')}</p>}</div>
  </section></div>;
}

export default function UnifiedBayExplorer({date,ownerId,journey,persistent,regionFocus,onRegionChange,onVisit,onAddPlace,addedPlaceIds,onAsk,onShowList,onOpenTown}:UnifiedBayExplorerProps){
  const locale=useLocale(),touch=useSfTouchControls(),t=(zh:string,en:string)=>locale==='en'?en:translateText(zh,locale);
  const stage=useRef<HTMLElement>(null),input=useRef(emptyInput()),sequence=useRef(0);
  const [position,setPosition]=useState<BayPoint>(()=>{const spawn=baySpawn('sf:park');return [spawn.x,spawn.z];});
  const positionRef=useRef(position),[currentRegion,setCurrentRegion]=useState<BayRegionId>('sf');
  const [mode,setMode]=useState<'walk'|'drive'|'overview'>('overview');
  const [selectedKey,setSelectedKey]=useState<string|null>(null),[nearKey,setNearKey]=useState<string|null>(null);
  const [selectedCityId,setSelectedCityId]=useState<string|null>(null),[fieldGuide,setFieldGuide]=useState(false),[discoveryId,setDiscoveryId]=useState<string|null>(null),[nearbyDiscoveryId,setNearbyDiscoveryId]=useState<string|null>(null);
  const [guideCityId,setGuideCityId]=useState<string|null>(null),[today,setToday]=useState(todayInBay);
  const cityCounts=useMemo(()=>cityEventCounts(PLANNER_EVENTS,today),[today]);
  const [running,setRunning]=useState(true),[golden,setGolden]=useState(true),[expanded,setExpanded]=useState(false),[visible,setVisible]=useState(true);
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false),[search,setSearch]=useState(false),[journal,setJournal]=useState(false),[sfJournal,setSfJournal]=useState(false);
  const [panelKey,setPanelKey]=useState<string|null>(null),[cameraOpen,setCameraOpen]=useState(false),[notice,setNotice]=useState('');
  const [focusCommand,setFocusCommand]=useState<UnifiedBaySceneProps['focusCommand']>({id:0,overview:true});
  const [spawnCommand,setSpawnCommand]=useState<UnifiedBaySceneProps['spawnCommand']>();
  const [cameraCommand,setCameraCommand]=useState<SfCameraCommand>();
  const [navigation,setNavigation]=useState<(NonNullable<UnifiedBaySceneProps['navigation']>&{targetKey:string;distance:number;requiresFerry:boolean})|null>(null);
  const [autoTravel,setAutoTravel]=useState(false),[remaining,setRemaining]=useState(0),[onWater,setOnWater]=useState(false);
  const adventure=useBayAdventures(ownerId),sfExploration=useSfExploration(ownerId);
  const discoveries=useBayDiscoveries(ownerId),cityPresence=useBayCityArrival();
  const {report:reportCity,reset:resetCity}=cityPresence;
  const discoveryMarkers=useMemo(()=>BAY_DISCOVERIES.map(item=>({id:item.id,position:item.position,radius:item.radius,kind:item.kind,collected:!!discoveries.progress.memories[item.id],color:item.color})),[discoveries.progress.memories]);
  const selectedCity=BAY_CITIES.find(city=>city.id===selectedCityId),nearbyDiscovery=BAY_DISCOVERIES.find(item=>item.id===nearbyDiscoveryId);
  const guideCity=BAY_CITIES.find(city=>city.id===guideCityId);
  const selected=UNIFIED_BAY_PLACES.find(p=>p.key===selectedKey),near=UNIFIED_BAY_PLACES.find(p=>p.key===nearKey),panel=UNIFIED_BAY_PLACES.find(p=>p.key===panelKey);
  const destination=navigation?UNIFIED_BAY_PLACES.find(p=>p.key===navigation.targetKey):undefined;
  const physicalNear=mode==='overview'?null:nearKey;
  const sfNear=physicalNear?.startsWith('sf:')?physicalNear.slice(3):null;
  const overlay=search||journal||sfJournal||fieldGuide||!!discoveryId||!!panel||!!guideCity;
  const live=running&&visible&&!overlay;
  const release=useCallback(()=>{input.current=emptyInput();},[]);
  const sceneReady=useCallback(()=>setReady(true),[]),sceneError=useCallback(()=>setFailed(true),[]);
  const select=useCallback((key:string)=>{release();resetCity();setSelectedCityId(null);setSelectedKey(key);setMode('overview');setAutoTravel(false);setSearch(false);setCameraOpen(false);setFocusCommand({id:++sequence.current,key});},[release,resetCity,setSelectedKey,setMode,setAutoTravel,setSearch,setCameraOpen,setFocusCommand]);
  const selectCity=useCallback((id:string)=>{if(!BAY_CITIES.some(city=>city.id===id))return;release();resetCity();setSelectedCityId(id);setSelectedKey(null);setMode('overview');setAutoTravel(false);setSearch(false);setNotice('');setCameraOpen(false);setFocusCommand({id:++sequence.current,cityId:id});},[release,resetCity,setSearch]);
  const overview=()=>{release();resetCity();setMode('overview');setAutoTravel(false);setSelectedKey(null);setSelectedCityId(null);setNotice('');setCameraOpen(false);setFocusCommand({id:++sequence.current,overview:true});};
  const follow=(next:'walk'|'drive')=>{release();setMode(next);setRunning(true);setCameraOpen(false);stage.current?.querySelector('canvas')?.focus({preventScroll:true});};
  const quickTravel=(key:string)=>{
    const spawn=baySpawn(key),point:BayPoint=[spawn.x,spawn.z];
    // The destination is already known. Do not plan the next route from the
    // previous position while waiting for the scene's throttled frame report.
    positionRef.current=point;setPosition(point);setOnWater(false);setRemaining(0);setNearbyDiscoveryId(null);resetCity();
    release();setAutoTravel(false);setNavigation(null);setNearKey(null);setSpawnCommand({id:++sequence.current,key});setMode('walk');setRunning(true);setNotice(t('已到附近，走近景点继续探索。','You are nearby. Walk up to the place to explore.'));
  };
  const navigate=(key:string)=>{
    const route=routeBay(positionRef.current,key);
    if(!route.available){setNotice(t('暂时找不到连续路线。可以浏览景点，或使用快速前往。','A continuous route is unavailable. Preview the place or use quick travel.'));return;}
    release();setSelectedKey(key);setSelectedCityId(null);setPanelKey(null);setSearch(false);setJournal(false);setSfJournal(false);setFieldGuide(false);setDiscoveryId(null);setMode('drive');setRunning(true);setAutoTravel(false);setRemaining(route.distance);
    // The city preview trigger disappears when routing starts. Keep keyboard
    // movement inside the world instead of leaving focus on the document body.
    stage.current?.querySelector('canvas')?.focus({preventScroll:true});
    if(route.distance<.15){setNavigation(null);setNotice('__arrived__');return;}
    setNavigation({...route,id:++sequence.current,targetKey:key});setNotice('');
  };
  const toggleAutoTravel=()=>{
    if(autoTravel){setAutoTravel(false);return;}
    if(!navigation)return;
    release();
    // A manual detour can put BAYBAY beyond a bridge or earlier ferry bend.
    // Rejoin safely from the actual position, never chase a stale waypoint.
    const route=routeBay(positionRef.current,navigation.targetKey);
    if(!route.available){setNotice(t('暂时找不到连续路线，请重新选择目的地。','A continuous route is unavailable. Choose your destination again.'));return;}
    if(route.distance<.15){setNavigation(null);setAutoTravel(false);setNotice('__arrived__');return;}
    setNavigation({...route,id:++sequence.current,targetKey:navigation.targetKey});setRemaining(route.distance);
    setMode('drive');setRunning(true);setAutoTravel(true);
  };
  const completed=useCallback(()=>{setAutoTravel(false);setNavigation(null);setNotice('__arrived__');},[]);
  const manual=useCallback(()=>setAutoTravel(false),[]);
  const progress=useCallback<NonNullable<UnifiedBaySceneProps['onProgress']>>(value=>{
    positionRef.current=[value.x,value.z];setPosition([value.x,value.z]);setRemaining(value.remaining);setOnWater(value.travelMode==='ferry');
    if(mode==='overview'||live)reportCity(value.x,value.z,mode!=='overview'&&value.travelMode!=='ferry');
    if(value.region&&BAY_REGIONS.some(r=>r.id===value.region)){setCurrentRegion(value.region as BayRegionId);if(mode!=='overview')onRegionChange?.(value.region as BayRegionId);}
  },[onRegionChange,mode,live,reportCity]);
  const discoveryNearby=useCallback((id:string|null)=>setNearbyDiscoveryId(id),[]);
  const openDiscovery=useCallback((id:string)=>{if(!BAY_DISCOVERIES.some(item=>item.id===id))return;release();setFieldGuide(false);setDiscoveryId(id);setCameraOpen(false);},[release,setFieldGuide,setDiscoveryId]);
  const arrived=useCallback((key:string|null)=>setNearKey(key),[]);
  const visited=useCallback((key:string)=>{const place=UNIFIED_BAY_PLACES.find(p=>p.key===key);if(place)onVisit(place.region,place.id);},[onVisit]);
  const lastFocus=useRef(0);
  useEffect(()=>{if(!regionFocus||regionFocus.id===lastFocus.current)return;lastFocus.current=regionFocus.id;select(BAY_REGION_FOCI[regionFocus.region]);},[regionFocus,select]);
  useEffect(()=>{if(!live)release();},[live,release]);
  useEffect(()=>{release();},[touch,release]);
  useEffect(()=>{setJournal(false);setSfJournal(false);setFieldGuide(false);setDiscoveryId(null);},[ownerId]);
  useEffect(()=>{const refresh=()=>setToday(todayInBay());const timer=window.setInterval(refresh,60_000);window.addEventListener('focus',refresh);return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
  useEffect(()=>{const interact=(event:globalThis.KeyboardEvent)=>{if(event.key.toLowerCase()!=='e'||event.repeat||overlay||!live||mode==='overview'||!nearbyDiscoveryId)return;if((event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]')||!stage.current?.contains(document.activeElement))return;event.preventDefault();openDiscovery(nearbyDiscoveryId);};window.addEventListener('keydown',interact);return()=>window.removeEventListener('keydown',interact);},[overlay,live,mode,nearbyDiscoveryId,openDiscovery]);
  useEffect(()=>{
    let inView=true;const update=()=>{setVisible(inView&&document.visibilityState!=='hidden');release();};
    const observer=typeof IntersectionObserver==='undefined'?undefined:new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;update();},{threshold:.02});if(stage.current)observer?.observe(stage.current);
    window.addEventListener('blur',release);document.addEventListener('visibilitychange',update);return()=>{observer?.disconnect();window.removeEventListener('blur',release);document.removeEventListener('visibilitychange',update);release();};
  },[release]);
  useEffect(()=>{if(!expanded)return;const bodyOverflow=document.body.style.overflow,rootOverflow=document.documentElement.style.overflow;document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';const esc=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'&&!overlay){if(cameraOpen)setCameraOpen(false);else setExpanded(false);}};window.addEventListener('keydown',esc);return()=>{document.body.style.overflow=bodyOverflow;document.documentElement.style.overflow=rootOverflow;window.removeEventListener('keydown',esc);};},[expanded,overlay,cameraOpen]);
  useEffect(()=>{if(overlay&&!expanded){const rect=stage.current?.getBoundingClientRect();if(rect&&(rect.top<0||rect.bottom>window.innerHeight))stage.current?.scrollIntoView({block:'start',behavior:'instant'});}},[overlay,expanded]);
  const camera=(action:SfCameraCommand['action'])=>setCameraCommand({id:++sequence.current,action});
  const ask=(question:string)=>{release();setPanelKey(null);setExpanded(false);setRunning(false);onAsk?.(question);};
  const moveButton=(key:keyof Pick<SfMovementInput,'forward'|'backward'|'left'|'right'>,name:string,icon:ReactNode)=><button type="button" aria-label={name} onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);input.current[key]=true;setAutoTravel(false);}} onPointerUp={()=>{input.current[key]=false;}} onPointerCancel={()=>{input.current[key]=false;}} onLostPointerCapture={()=>{input.current[key]=false;}} onKeyDown={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();input.current[key]=true;setAutoTravel(false);}}} onKeyUp={()=>{input.current[key]=false;}} onBlur={()=>{input.current[key]=false;}}>{icon}</button>;
  const shown=mode==='overview'?selected:near;
  return <div className="ub-explorer"><section ref={stage} data-unified-bay-stage className={`sf-stage ub-stage${mode==='overview'?' is-overview':''}${expanded?' is-expanded':''}${touch?' has-touch-controls':''}`} aria-label={t('连续湾区 3D 世界','Continuous Bay Area 3D world')}>
    <div className="ub-canvas"><BaySceneBoundary onError={sceneError} fallback={<div className="ub-loading"><Map size={32}/><p>{t('当前设备无法打开 3D，景点照片和攻略仍可查看。','3D is unavailable on this device. Place photos and guides are still available.')}</p><button onClick={()=>setSearch(true)}>{t('打开全部地点','Browse all places')}</button></div>}><Suspense fallback={null}><Scene mode={mode} running={live} golden={golden} input={input} selectedKey={selectedKey} focusCommand={focusCommand} spawnCommand={spawnCommand} navigation={navigation} autoTravel={autoTravel} locale={locale} visitedKeys={Object.keys(journey.visits)} cameraCommand={cameraCommand} onSelect={select} onCitySelect={selectCity} cityEventCounts={cityCounts} discoveries={discoveryMarkers} onDiscovery={openDiscovery} onNearbyDiscovery={discoveryNearby} onArrival={arrived} onVisit={visited} onProgress={progress} onNavigationComplete={completed} onManualInput={manual} onReady={sceneReady} onError={sceneError}/></Suspense></BaySceneBoundary></div>
    {!ready&&!failed&&<div className="ub-loading" role="status"><Compass size={30}/><strong>{t('正在铺开一整片湾区…','Unfolding the whole bay…')}</strong></div>}
    <nav className="ub-topbar" aria-label={t('全湾区游戏导航','Bay world controls')}><div><button className="ub-search-toggle" aria-label={t('想去哪里','Find a place')} onClick={()=>setSearch(true)}><Search size={18}/><span>{t('想去哪里','Find a place')}</span></button><button onClick={overview} aria-label={t('全湾鸟瞰','Whole bay overview')} title={t('全湾鸟瞰','Whole bay overview')}><Map size={19}/></button><button onClick={()=>setJournal(true)} aria-label={t('打开湾区任务本','Open Bay adventure journal')}><Sparkles size={18}/><span>{t('任务','Quests')}</span></button><button className="ub-field-toggle" onClick={()=>setFieldGuide(true)} aria-label={t('打开沿途发现册','Open field notes')} title={t('沿途发现册','Field notes')}><Leaf size={18}/><b>{Object.keys(discoveries.progress.memories).length}</b></button></div><div><button aria-label={t('切换光线','Change lighting')} aria-pressed={golden} onClick={()=>setGolden(v=>!v)}><Sun size={17}/></button><button aria-label={running?t('暂停世界','Pause world'):t('继续世界','Resume world')} onClick={()=>setRunning(v=>!v)}>{running?<Pause size={17}/>:<Play size={17}/>}</button><button aria-label={expanded?t('退出全屏','Exit fullscreen'):t('全屏探索','Explore fullscreen')} onClick={()=>setExpanded(v=>!v)}>{expanded?<X size={19}/>:<Expand size={18}/>}</button></div></nav>
    <div className="ub-heading"><small>BAYBAY’S OPEN BAY</small><h2>{mode==='overview'?selected?t(selected.title,selected.titleEn):selectedCity?t(selectedCity.name,selectedCity.nameEn):t('一片海湾，连着每一站。','One bay. Every little adventure.'):cityPresence.city?t(cityPresence.city.name,cityPresence.city.nameEn):t(BAY_REGIONS.find(r=>r.id===currentRegion)!.zh,BAY_REGIONS.find(r=>r.id===currentRegion)!.en)}</h2><span>{onWater?t('渡轮航行中','Sailing across the bay'):mode==='overview'?t('拖动环顾 · 选择景点出发','Drag to explore · Choose a place'):mode==='drive'?t('自由驾驶','Free driving'):t('跟 BAYBAY 漫步','Walking with BAYBAY')} · {Object.keys(journey.visits).length}/{UNIFIED_BAY_PLACES.length}</span>{mode!=='overview'&&cityPresence.city&&<button className="ub-city-heading-button" onClick={()=>setGuideCityId(cityPresence.city!.id)}><MapPin size={12}/>{t('城市指南','City guide')}<b>{cityCounts[cityPresence.city.id]?` · ${cityCounts[cityPresence.city.id]} ${t('场活动','events')}`:''}</b></button>}</div>
    {selectedCity&&mode==='overview'&&!overlay&&!cameraOpen&&<aside className="ub-city-card"><div><strong>{t(selectedCity.name,selectedCity.nameEn)}</strong><small>{cityGuidePlaces(selectedCity).length} {t('处去处','places')} · {cityCounts[selectedCity.id]||0} {t('场本月 / 下月活动','events this / next month')}</small></div><button onClick={()=>setGuideCityId(selectedCity.id)}>{t('打开城市指南','Open city guide')}<ArrowRight size={16}/></button></aside>}
    {cityPresence.arrival&&mode!=='overview'&&!overlay&&<div className="ub-city-arrival" role="status"><span>{t('走进这一站','A NEW LITTLE CHAPTER')}</span><strong>{t(cityPresence.arrival.name,cityPresence.arrival.nameEn)}</strong><p>{t(cityPresence.arrival.subtitle.zh,cityPresence.arrival.subtitle.en)}</p></div>}
    <UnifiedBayMiniMap position={position} route={navigation?.points} selectedKey={selectedKey} onOverview={overview} label={t('打开全湾鸟瞰小地图','Open whole bay overview map')}/>
    {navigation&&destination&&<div className="ub-route-card"><div><Navigation size={18}/><span><small>{t('游戏导航','GAME ROUTE')}{navigation.requiresFerry?` · ${t('含渡轮','with ferry')}`:''}</small><strong>{t(destination.title,destination.titleEn)}</strong></span><button aria-label={t('取消导航','Cancel navigation')} onClick={()=>{setAutoTravel(false);setNavigation(null);}}><X size={17}/></button></div><div className="ub-route-meter"><i style={{width:`${Math.max(0,Math.min(100,(1-remaining/Math.max(1,navigation.distance))*100))}%`}}/></div><button className="ub-route-go" onClick={toggleAutoTravel}>{autoTravel?<Pause size={15}/>:<Play size={15}/>} {autoTravel?t('暂停自动前进','Pause auto-travel'):t('沿路线自动前进','Follow the route') }</button><small>{t('手动移动可随时接管','Move manually to take over')}</small></div>}
    {notice&&!navigation&&<button className="ub-notice" onClick={()=>setNotice('')} aria-label={t('关闭提示','Dismiss notice')}>{notice==='__arrived__'?t('抵达啦，看看这里藏着什么。','You have arrived. Discover this little stop.'):notice}<X size={13}/></button>}
    {adventure.activeQuest&&adventure.nextKey&&!navigation&&<button className="ub-quest-tracker" onClick={()=>setJournal(true)}><Sparkles size={15}/><span>{t('下一枚小回忆','Your next little memory')}<strong>{t(UNIFIED_BAY_PLACES.find(p=>p.key===adventure.nextKey)!.title,UNIFIED_BAY_PLACES.find(p=>p.key===adventure.nextKey)!.titleEn)}</strong></span><ArrowRight size={16}/></button>}
    {shown&&!overlay&&!cameraOpen&&<aside className="ub-place-card" aria-label={t('当前景点','Current attraction')}><div><small>{mode==='overview'?t('目的地预览','DESTINATION'):t('你来到了','YOU ARE HERE')}</small><strong>{t(shown.title,shown.titleEn)}</strong></div><div><button onClick={()=>setPanelKey(shown.key)}><Camera size={16}/>{t('照片攻略','Photos & guide')}</button>{mode==='overview'?<><button onClick={()=>navigate(shown.key)}><Navigation size={16}/>{t('导航','Route')}</button><button onClick={()=>quickTravel(shown.key)}><Footprints size={16}/>{t('快速前往','Quick travel')}</button></>:<>{sfNear&&!nearbyDiscovery&&SF_EXPLORATION_STOP_BY_ID[sfNear]&&<button onClick={()=>setSfJournal(true)}><Stamp size={16}/>{t('小彩蛋','Discover')}</button>}{nearbyDiscovery&&<button className="ub-nearby-action" onClick={()=>openDiscovery(nearbyDiscovery.id)}><Leaf size={16}/>{t('互动','Interact')}{!touch&&<kbd>E</kbd>}</button>}{adventure.nextKey===physicalNear&&<button className="is-primary" onClick={()=>setJournal(true)}><Check size={16}/>{t('完成这一站','Check in here')}</button>}</>}</div></aside>}
    {nearbyDiscovery&&mode!=='overview'&&!shown&&!overlay&&!cameraOpen&&<button className="ub-discovery-prompt" onClick={()=>openDiscovery(nearbyDiscovery.id)}><span>{nearbyDiscovery.symbol}</span><span><small>{t('附近有个小发现','SOMETHING TO DISCOVER')}</small><strong>{t(nearbyDiscovery.title.zh,nearbyDiscovery.title.en)}</strong></span><b>{touch?t('互动','Interact'):'E'}</b></button>}
    {!failed&&mode!=='overview'&&(touch?<SfTouchJoystick input={input} disabled={!live} label={t('拖动摇杆移动 BAYBAY','Drag joystick to move BAYBAY')}/>:<div className="ub-direction-pad" aria-label={t('方向控制','Movement controls')}>{moveButton('forward',t('前进','Forward'),<ArrowUp size={20}/>)}<div>{moveButton('left',t('左移','Left'),<ArrowLeft size={20}/>)}{moveButton('backward',t('后退','Back'),<ArrowDown size={20}/>)}{moveButton('right',t('右移','Right'),<ArrowRight size={20}/>)}</div></div>)}
    <div className="ub-bottom-tools"><div className="ub-mode"><button aria-pressed={mode==='walk'} onClick={()=>follow('walk')}><Footprints size={17}/>{t('走路','Walk')}</button><button aria-pressed={mode==='drive'} onClick={()=>follow('drive')}><CarFront size={18}/>{t('开车','Drive')}</button></div><button aria-label={t('调整视角','Adjust view')} aria-expanded={cameraOpen} onClick={()=>setCameraOpen(v=>!v)}><Compass size={19}/></button></div>
    {cameraOpen&&<div className="ub-camera-tools" role="group" aria-label={t('视角控制','Camera controls')}>{([['left','向左转','Rotate left',ArrowLeft],['right','向右转','Rotate right',ArrowRight],['up','提高视角','Tilt up',ArrowUp],['down','降低视角','Tilt down',ArrowDown],['zoom-in','拉近','Zoom in',Plus],['zoom-out','拉远','Zoom out',Minus],['reset','回到角色','Reset view',RotateCcw]] as const).map(([action,zh,en,Icon])=><button key={action} aria-label={t(zh,en)} onClick={()=>camera(action)}><Icon size={18}/></button>)}</div>}
    <div className="ub-hint">{mode==='overview'?t('一个连续世界 · 桥梁连接海湾两岸','One continuous world · Bridges connect the bay'):touch?t('摇杆移动 · 拖动转视角 · 双指缩放','Joystick to move · Drag to orbit · Pinch to zoom'):t('WASD / 方向键移动 · E 互动 · 拖动转视角','WASD / arrows to move · E to interact · Drag to orbit')}</div>
    {search&&<PlaceSearch selectedKey={selectedKey} onSelect={select} onCitySelect={selectCity} onClose={()=>setSearch(false)}/>}
    {guideCity&&<BayCityGuide key={guideCity.id} city={guideCity} today={today} locale={locale} onClose={()=>setGuideCityId(null)} onPreview={key=>{setGuideCityId(null);select(key);}} onNavigate={key=>{setGuideCityId(null);navigate(key);}} onAsk={onAsk?question=>{setGuideCityId(null);ask(question);}:undefined}/>}
    {fieldGuide&&<BayFieldGuide locale={locale} collectedIds={Object.keys(discoveries.progress.memories)} onSelect={openDiscovery} onClose={()=>setFieldGuide(false)}/>}
    {discoveryId&&<BayDiscoveryPanel key={(ownerId||'guest')+':'+discoveryId} discoveryId={discoveryId} locale={locale} discovery={discoveries} context={{position,mode,arrived:mode!=='overview'&&nearbyDiscoveryId===discoveryId}} onNavigate={navigate} onClose={()=>setDiscoveryId(null)}/>}
    {panel&&<UnifiedPlacePanel key={panel.key} place={panel} locale={locale} date={date} addedPlaceIds={addedPlaceIds} onAddPlace={onAddPlace} onCityGuide={()=>{const city=bayCityForPlace(panel);if(city){setPanelKey(null);setGuideCityId(city.id);}}} onAsk={onAsk?ask:undefined} onClose={()=>setPanelKey(null)} onNavigate={navigate}/>}
    {journal&&<BayAdventureJournal key={ownerId?'user:'+ownerId:'guest'} locale={locale} adventure={adventure} nearKey={physicalNear} onNavigate={navigate} onClose={()=>setJournal(false)}/>}
    {sfJournal&&<SfExplorationPanel key={ownerId?'user:'+ownerId:'guest'} locale={locale} progress={sfExploration.progress} currentNearId={sfNear} initialTab="encounter" onCollect={(id,choice)=>sfExploration.collect(id,sfNear,choice)} onStartRoute={sfExploration.startRoute} onTravel={id=>navigate(`sf:${id}`)} onGuide={id=>{setSfJournal(false);setPanelKey(`sf:${id}`);}} onClose={()=>setSfJournal(false)}/>}
  </section><div className="ub-below"><div><strong>{t('把整片湾区，变成自己的小旅行','Make the whole bay your little adventure')}</strong><p>{t('地标沿真实地理关系排列；地形、道路和桥梁经过游戏化简化。导航仅用于这个迷你世界。','Landmarks follow geographic positions; terrain, streets and bridges are simplified for this game. Routes guide you through the miniature world.')}</p><small>{persistent?t('游戏足迹保存在此浏览器。','Virtual visits stay in this browser.'):t('浏览器储存不可用，足迹仅保留在当前会话。','Browser storage unavailable; visits last for this session.')}</small></div><div><button onClick={()=>setJournal(true)}><Sparkles size={17}/>{t('领取探索任务','Find an adventure')}</button>{onOpenTown&&<button onClick={onOpenTown}><BookOpen size={17}/>{t('旧金山花园与缆车','SF garden & cable car')}</button>}<button onClick={onShowList}><Map size={17}/>{t('真实活动与行程','Real events & itineraries')}</button></div></div></div>;
}
