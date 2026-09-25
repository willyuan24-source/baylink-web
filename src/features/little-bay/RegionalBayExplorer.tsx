import { Component, lazy, Suspense, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BookOpen, CalendarDays, CarFront, Check, Compass, Expand, Footprints, Map, Minus, Pause, Play, Plus, RotateCcw, Sun, TramFront, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { translateText, useLocale, type Locale } from '../../i18n/locale';
import { PLANNER_EVENTS } from '../../data/planner-catalog';
import { eventOccursOn } from '../../lib/event-calendar';
import { REGIONAL_WORLDS, type RegionalId, type RegionalPlace } from './regional-world';
import type { SfMovementInput } from './sf-movement-input';
import type { SfCameraCommand } from './sf-camera';
import SfTouchJoystick from './SfTouchJoystick';
import SfLandmarkPhoto from './SfLandmarkPhoto';
import { useSfTouchControls } from './useSfTouchControls';
import { getRegionalLandmarkPhoto } from './regional-landmark-photos';

const Scene = lazy(() => import('./RegionalBayScene'));
const makeInput = ():SfMovementInput => ({forward:false,backward:false,left:false,right:false});
const names:Record<string,[string,string]> = {sf:['旧金山','San Francisco'],peninsula:['中半岛','Peninsula'],'south-bay':['南湾','South Bay'],'east-bay':['东湾','East Bay']};
export type RegionalBayExplorerProps = {
  region:RegionalId; date:string; onTravel:(region:string)=>void; onAddPlace?:(id:string)=>void;
  onVisit?:(id:string)=>void; visitedIds?:readonly string[]; onAsk?:(question:string)=>void;
  initialPlaceId?:string; onSelectedPlace?:(id:string)=>void; onShowList?:()=>void; addedPlaceIds?:readonly string[];
};
class RegionalBoundary extends Component<{children:ReactNode;fallback:ReactNode;onError:()=>void},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.onError();}
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}

function PlacePanel({region,place,locale,onClose,onTravel,onAddPlace,onAsk,date,addedPlaceIds}:{region:RegionalId;place:RegionalPlace;locale:Locale;onClose:()=>void;onTravel:(id:string)=>void;onAddPlace?:(id:string)=>void;onAsk?:(text:string)=>void;date:string;addedPlaceIds:readonly string[]}){
  const panel=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null),id=useId();
  const [expanded,setExpanded]=useState(false);
  const added=!!place.plannerPlaceId&&addedPlaceIds.includes(place.plannerPlaceId);
  const t=(zh:string,en:string)=>locale==='en'?en:translateText(zh,locale);
  const title=locale==='en'?place.titleEn:translateText(place.title,locale);
  const photo=getRegionalLandmarkPhoto(region,place.id,locale);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();return()=>{if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
  useEffect(()=>{close.current?.focus();},[expanded]);
  const leave=()=>expanded?setExpanded(false):onClose();
  const keys=(event:KeyboardEvent<HTMLElement>)=>{
    event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();leave();return;}
    if(event.key!=='Tab')return;
    const controls=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]')||[]);
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  return <div className="regional-modal" onPointerDown={event=>event.stopPropagation()} onClick={event=>{if(event.currentTarget===event.target)leave();}}>
    <section ref={panel} role="dialog" aria-modal="true" aria-labelledby={id} onKeyDown={keys} className={`regional-panel sf-guide-panel${expanded?' regional-panel--photo':''}`}>
      <button ref={close} className="regional-close sf-guide-close" onClick={leave} aria-label={expanded?t('关闭大图','Close photograph'):t('关闭地点详情','Close place details')}><X size={20}/></button>
      <span className="regional-eyebrow">BAYLINK · {place.city}</span><h3 id={id}>{title}</h3>
      {photo&&<SfLandmarkPhoto key={`${photo.src}:${expanded}`} photo={photo} locale={locale} expanded={expanded} onExpand={()=>setExpanded(true)}/>}
      {!expanded&&<>
        <p className="regional-description">{locale==='en'?place.descriptionEn:translateText(place.description,locale)}</p>
        <div className="regional-panel-actions">
          {place.guideSlug&&<Link to={`/guides/${place.guideSlug}${locale==='en'?'?lang=en':''}`} target="_blank" rel="noopener noreferrer"><BookOpen size={16}/>{t('阅读攻略','Read the guide')}<ArrowUpRight size={14}/></Link>}
          <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer">{t('官方参观信息','Official visitor info')}<ArrowUpRight size={14}/></a>
          <a href={`https://www.google.com/maps/search/?api=1&query=${place.coordinate[1]},${place.coordinate[0]}`} target="_blank" rel="noopener noreferrer">{t('在真实地图查看','View on a real map')}<ArrowUpRight size={14}/></a>
          {place.plannerPlaceId&&onAddPlace&&<button disabled={added} onClick={()=>onAddPlace(place.plannerPlaceId!)}>{added?<Check size={16}/>:<Plus size={16}/>} {added?t('已加入我的周末','Added to my day'):t('加入我的周末','Add to my day')}</button>}
          {onAsk&&<button onClick={()=>{onAsk(t(`帮我安排 ${date} 去 ${place.titleEn} 的半日游，包含附近可以搭配的活动。`,`Plan a half-day around ${place.titleEn} on ${date}, including nearby events.`));onClose();}}><Compass size={16}/>{t('让 BAYBAY 帮我规划','Plan with BAYBAY')}</button>}
        </div>
        {!!place.travelTo?.length&&<div className="regional-transfers"><h4><TramFront size={17}/>{t('下一站，去哪里？','Where to next?')}</h4><p>{t('旅行车站会切换游戏区域。','Travel stations switch your game region.')}</p><div>{place.travelTo.map(region=><button key={region} onClick={()=>onTravel(region)}>{t(...(names[region]||[region,region]))}<ArrowUpRight size={15}/></button>)}</div></div>}
      </>}
    </section>
  </div>;
}

function RegionalSession({region,date,onTravel,onAddPlace,onVisit,visitedIds=[],onAsk,initialPlaceId,onSelectedPlace,onShowList,addedPlaceIds=[]}:RegionalBayExplorerProps){
  const world=REGIONAL_WORLDS[region],locale=useLocale(),touch=useSfTouchControls();
  const t=(zh:string,en:string)=>locale==='en'?en:translateText(zh,locale);
  const label=(place:RegionalPlace)=>locale==='en'?place.titleEn:translateText(place.title,locale);
  const validInitial=world.places.some(p=>p.id===initialPlaceId)?initialPlaceId!:world.startId;
  const [startId,setStartId]=useState(validInitial),[selectedId,setSelectedId]=useState<string|null>(validInitial);
  const [mode,setMode]=useState<'walk'|'drive'|'overview'>('walk'),[running,setRunning]=useState(true),[visible,setVisible]=useState(true);
  const [golden,setGolden]=useState(true),[expanded,setExpanded]=useState(false),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  const [resetToken,setResetToken]=useState(0),[arrival,setArrival]=useState<string|null>(null),[panelId,setPanelId]=useState<string|null>(null);
  const [cameraOpen,setCameraOpen]=useState(false),[cameraCommand,setCameraCommand]=useState<SfCameraCommand>();
  const input=useRef(makeInput()),stage=useRef<HTMLElement>(null),sequence=useRef(0);
  const selected=world.places.find(p=>p.id===selectedId),nearby=world.places.find(p=>p.id===arrival),panel=world.places.find(p=>p.id===panelId);
  const shown=mode==='overview'?selected:nearby,live=running&&visible&&!panel;
  const events=PLANNER_EVENTS.filter(event=>event.region===region&&eventOccursOn(event,date));
  const release=useCallback(()=>{input.current=makeInput();},[]);
  const sceneReady=useCallback(()=>setReady(true),[]),sceneError=useCallback(()=>{setFailed(true);setRunning(false);},[]);
  const sceneArrival=useCallback((id:string|null)=>setArrival(id),[]);
  const select=useCallback((id:string)=>{release();setSelectedId(id);setMode('overview');setCameraOpen(false);onSelectedPlace?.(id);},[release,onSelectedPlace]);
  useEffect(()=>{if(!live)release();},[live,release]);
  useEffect(()=>{release();},[touch,release]);
  useEffect(()=>{
    let inView=true;
    const update=()=>{setVisible(inView&&document.visibilityState!=='hidden');release();};
    const observer=typeof IntersectionObserver==='undefined'?undefined:new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;update();},{threshold:.02});
    if(stage.current)observer?.observe(stage.current);
    document.addEventListener('visibilitychange',update);window.addEventListener('blur',release);
    return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',update);window.removeEventListener('blur',release);release();};
  },[release]);
  useEffect(()=>{
    if(!expanded)return;
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    const escape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'&&!panel){if(cameraOpen)setCameraOpen(false);else setExpanded(false);}};
    window.addEventListener('keydown',escape);return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',escape);};
  },[expanded,panel,cameraOpen]);
  const move=(next:'walk'|'drive')=>{
    if(mode==='overview'&&selectedId){setStartId(selectedId);setResetToken(v=>v+1);}
    setMode(next);setRunning(true);setCameraOpen(false);release();
    stage.current?.querySelector('canvas')?.focus({preventScroll:true});
  };
  const camera=(action:SfCameraCommand['action'])=>setCameraCommand({id:++sequence.current,action});
  const fallback=<div className="regional-loading"><Map size={28}/><h3>{t('继续发现这片湾区','Keep discovering the Bay')}</h3><p>{t('当前设备未能打开 3D，可用下方地点选择查看攻略。','3D could not open on this device. Choose a place below for visitor information.')}</p>{onShowList&&<button onClick={onShowList}>{t('打开地点列表','Open place list')}</button>}</div>;
  return <div className="regional-explorer">
    <section ref={stage} className={`sf-stage regional-stage${expanded?' is-expanded':''}${touch?' has-touch-controls':''}`} aria-label={locale==='en'?world.titleEn:translateText(world.title,locale)}>
      <div className="regional-canvas">{failed?fallback:<RegionalBoundary fallback={fallback} onError={sceneError}><Suspense fallback={null}><Scene world={world} mode={mode} running={live} golden={golden} input={input} selectedId={selectedId} startId={startId} resetToken={resetToken} onSelect={select} onArrival={sceneArrival} onVisit={onVisit} onReady={sceneReady} onError={sceneError} locale={locale==='en'?'en':'zh'} visitedIds={visitedIds} cameraCommand={cameraCommand}/></Suspense></RegionalBoundary>}</div>
      {!ready&&!failed&&<div className="regional-loading" role="status"><Compass size={28}/><p>{t('BAYBAY 正在准备小城…','BAYBAY is getting the little world ready…')}</p></div>}
      <div className="regional-topbar">
        <label className="regional-destination"><Map size={17}/><span className="sr-only">{t('选择地点','Choose a place')}</span><select value={selectedId||''} onChange={e=>e.target.value?select(e.target.value):(setSelectedId(null),setMode('overview'))}><option value="">{t('全区地图','Region overview')}</option>{world.places.map(p=><option key={p.id} value={p.id}>{label(p)}</option>)}</select></label>
        {selected&&<button className="regional-selected-info" title={t('景点照片与攻略','Place photos and guide')} aria-label={t('景点照片与攻略','Place photos and guide')} onClick={()=>setPanelId(selected.id)}><BookOpen size={18}/></button>}
        <button className="regional-overview" title={t('全区地图','Region overview')} aria-label={t('全区地图','Region overview')} onClick={()=>{release();setSelectedId(null);setMode('overview');}}><Map size={18}/><span>{t('全区','Overview')}</span></button>
        <label className="regional-transfer-select"><TramFront size={16}/><span className="sr-only">{t('前往其他地区','Travel to another region')}</span><select value="" onChange={event=>{if(event.target.value)onTravel(event.target.value);}}><option value="">{t('环游湾区','Travel the bay')}</option>{Object.entries(names).filter(([id])=>id!==region).map(([id,title])=><option key={id} value={id}>{t(...title)}</option>)}</select></label>
        <div className="regional-top-tools"><button onClick={()=>setGolden(v=>!v)} aria-label={t('切换光线','Change lighting')} aria-pressed={golden}><Sun size={18}/></button><button onClick={()=>setRunning(v=>!v)} aria-label={running?t('暂停','Pause'):t('继续探索','Resume exploring')} aria-pressed={!running}>{running?<Pause size={17}/>:<Play size={17}/>}</button><button onClick={()=>setExpanded(v=>!v)} aria-label={expanded?t('退出全屏','Exit fullscreen'):t('全屏探索','Explore fullscreen')}>{expanded?<X size={18}/>:<Expand size={18}/>}</button></div>
      </div>
      <div className="regional-heading"><span>BAYBAY’S LITTLE BAY</span><h2>{locale==='en'?world.titleEn:translateText(world.title,locale)}</h2><p>{t(`走近景点，收集本区 ${world.places.length} 枚到访章。`,`Walk up to places to collect ${world.places.length} visit stamps.`)} <b>{world.places.filter(p=>visitedIds.includes(p.id)).length}/{world.places.length}</b></p></div>
      {shown&&!panel&&<div className="regional-arrival" role="status"><div><small>{mode==='overview'?t('下一站','YOUR NEXT STOP'):t('你来到了','YOU ARE HERE')}</small><strong>{label(shown)}</strong></div><div>{mode==='overview'&&<button onClick={()=>move('walk')}><Footprints size={16}/>{t('到这里探索','Explore here')}</button>}<button onClick={()=>setPanelId(shown.id)}>{shown.travelTo?<TramFront size={16}/>:<BookOpen size={16}/>} {shown.travelTo?t('旅行车站','Travel station'):t('照片与攻略','Place details')}</button></div></div>}
      {!failed&&<>
        {mode!=='overview'&&(touch?<SfTouchJoystick input={input} disabled={!live} label={t('拖动摇杆移动 BAYBAY','Drag the joystick to move BAYBAY')}/>:<div className="regional-key-hint"><kbd>W</kbd><span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><p>{t('点击地面也能走过去','Or click the ground to walk')}</p></div>)}
        <div className="regional-bottom-tools"><div className="regional-mode-toggle"><button className={mode==='walk'?'is-active':''} aria-pressed={mode==='walk'} onClick={()=>move('walk')}><Footprints size={17}/>{t('走路','Walk')}</button><button className={mode==='drive'?'is-active':''} aria-pressed={mode==='drive'} onClick={()=>move('drive')}><CarFront size={17}/>{t('开车','Drive')}</button></div><button onClick={()=>setCameraOpen(v=>!v)} aria-expanded={cameraOpen} aria-label={t('调整视角','Adjust view')}><Compass size={19}/></button></div>
        {cameraOpen&&<div className="regional-camera-tools" aria-label={t('视角控制','Camera controls')}><button onClick={()=>camera('left')} aria-label={t('向左转','Rotate left')}><ArrowLeft size={18}/></button><button onClick={()=>camera('right')} aria-label={t('向右转','Rotate right')}><ArrowRight size={18}/></button><button onClick={()=>camera('up')} aria-label={t('提高视角','Tilt up')}><ArrowUp size={18}/></button><button onClick={()=>camera('down')} aria-label={t('降低视角','Tilt down')}><ArrowDown size={18}/></button><button onClick={()=>camera('zoom-in')} aria-label={t('拉近','Zoom in')}><Plus size={18}/></button><button onClick={()=>camera('zoom-out')} aria-label={t('拉远','Zoom out')}><Minus size={18}/></button><button onClick={()=>camera('reset')} aria-label={t('重置视角','Reset view')}><RotateCcw size={18}/></button></div>}
      </>}
      <div className="regional-footnote">{touch?t('摇杆移动 · 空白处拖动转视角 · 双指缩放','Joystick to move · Drag to orbit · Pinch to zoom'):t('WASD / 方向键移动 · 拖动转视角 · 滚轮缩放','WASD / arrows to move · Drag to orbit · Scroll to zoom')}</div>
      {panel&&<PlacePanel key={panel.id} region={region} place={panel} locale={locale} date={date} onClose={()=>setPanelId(null)} onTravel={onTravel} onAddPlace={onAddPlace} onAsk={onAsk?question=>{setExpanded(false);onAsk(question);}:undefined} addedPlaceIds={addedPlaceIds}/>}
    </section>
    <div className="regional-below"><div><span className="regional-eyebrow">A LITTLE JOURNEY, A REAL PLACE</span><h3>{locale==='en'?world.subtitleEn:translateText(world.subtitle,locale)}</h3><p>{t('地标依真实经纬度定位；建筑放大，海岸和道路简化为游戏地图。','Real geographic landmark positions; enlarged models and simplified game coastlines and roads.')}</p></div><Link className="regional-calendar-link" to={`/calendar?date=${date}&region=${region}`}><CalendarDays size={18}/>{t('这一天的地区活动','Regional events for this day')}<b>{events.length}</b><ArrowUpRight size={15}/></Link></div>
    <details className="regional-place-index"><summary>{t('发现所有地点','Discover all places')} <span>{world.places.length}</span></summary><div>{world.places.map(place=><button key={place.id} onClick={()=>{if(failed)setPanelId(place.id);else select(place.id);stage.current?.scrollIntoView({block:'nearest',behavior:'smooth'});}}>{visitedIds.includes(place.id)?<Check size={16}/>:<Compass size={16}/>}<span>{label(place)}<small>{place.city}</small></span><ArrowUpRight size={14}/></button>)}</div></details>
  </div>;
}

export default function RegionalBayExplorer(props:RegionalBayExplorerProps){return <RegionalSession key={props.region} {...props}/>;}
