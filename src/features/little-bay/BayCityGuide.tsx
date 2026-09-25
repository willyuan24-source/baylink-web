import { useId, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarDays, Compass, MapPin, Navigation, Sparkles, Users, X } from 'lucide-react';
import { PLANNER_EVENTS } from '../../data/planner-catalog';
import { EVENT_SCHEDULE_NOTES } from '../../data/event-calendar-dates';
import { translateText, type Locale } from '../../i18n/locale';
import { cityEventMapUrl, cityEventUrl, cityGuideAiPrompt, cityGuideMonths, cityGuidePlaces, eventsForBayCity } from './bay-city-guide';
import type { BayCity } from './bay-cities';
import { useUnifiedDialog } from './useUnifiedDialog';

export default function BayCityGuide({city,today,locale,onClose,onPreview,onNavigate,onAsk}:{city:BayCity;today:string;locale:Locale;onClose:()=>void;onPreview:(key:string)=>void;onNavigate:(key:string)=>void;onAsk?:(question:string)=>void}) {
  const {panel,closeButton,onKeyDown}=useUnifiedDialog(onClose),title=useId();
  const months=cityGuideMonths(today),[tab,setTab]=useState('places');
  const places=cityGuidePlaces(city),month=months.find(item=>item.key===tab)||months[0];
  const lists=useMemo(()=>Object.fromEntries(cityGuideMonths(today).map(item=>[item.key,eventsForBayCity(PLANNER_EVENTS,city,item.key,today)])),[city,today]);
  const events=lists[month.key]||[];
  const t=(zh:string,en:string)=>locale==='en'?en:translateText(zh,locale);
  const name=t(city.name,city.nameEn),monthName=(key:string)=>new Intl.DateTimeFormat(locale,{month:'long',timeZone:'UTC'}).format(new Date(`${key}-01T12:00:00Z`));
  return <div className="ub-overlay" onPointerDown={e=>e.stopPropagation()} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={panel} className="ub-city-guide" role="dialog" aria-modal="true" aria-labelledby={title} onKeyDown={onKeyDown}>
    <header><div><small>BAYBAY’S CITY NOTES</small><h3 id={title}>{name}</h3><p>{t(city.subtitle.zh,city.subtitle.en)}</p></div><button ref={closeButton} onClick={onClose} aria-label={t('关闭城市指南','Close city guide')}><X size={20}/></button></header>
    <nav className="ub-city-tabs" aria-label={t('城市指南内容','City guide sections')}><button aria-pressed={tab==='places'} onClick={()=>setTab('places')}><Compass size={15}/>{t('值得去','Places')}<b>{places.length}</b></button>{months.map((item,index)=><button key={item.key} aria-pressed={tab===item.key} onClick={()=>setTab(item.key)}><CalendarDays size={15}/>{monthName(item.key)}<span>{t(index?'下月':'本月',index?'Next':'Now')}</span><b>{lists[item.key]?.length||0}</b></button>)}</nav>
    <div className="ub-city-body">
      {tab==='places'?<><p className="ub-city-intro">{t('先在地图看看，再选择导航。真实地址和参观信息在地点详情中。','Preview a place, then choose a route. Place details include real-world directions and visitor information.')}</p><div className="ub-city-place-list">{places.map(place=><article key={place.key}><div><span>{place.regional?.kind==='station'?'↗':place.regional?.kind==='garden'?'❀':'⌂'}</span><div><h4>{t(place.title,place.titleEn)}</h4><p>{place.regional?t(place.regional.description,place.regional.descriptionEn):t(place.sf?.visitNote||'打开地点查看照片与攻略。',place.sf?.visitNoteEn||'Open this place for photos and guides.')}</p></div></div><footer><button onClick={()=>onPreview(place.key)}><MapPin size={14}/>{t('地图预览','Preview')}</button><button onClick={()=>onNavigate(place.key)}><Navigation size={14}/>{t('导航前往','Route here')}</button></footer></article>)}</div>{!places.length&&<p className="ub-city-empty">{t('这座城市的街区已经可以探索，具体地点正在补充。','Explore this city’s streets; individual places are still being added.')}</p>}</>:<>
      <p className="ub-city-intro">{t('只列本城已收录、尚未结束的活动；多日项目只显示已公布的举办日期。','Listed city events with upcoming confirmed dates. Multi-day programs follow their published schedule.')}</p>
      {!events.length?<div className="ub-city-empty"><CalendarDays size={28}/><h4>{t('这个月暂未收录本城活动','No listed city events this month')}</h4><p>{t('不代表当地没有活动；可以先探索常设地点，或查看地区日历。','Explore year-round places or check the regional calendar for more ideas.')}</p></div>:events.map(({event,nextDate,dates})=><article className="ub-city-event" key={event.id}>
        <div className="ub-city-event-date"><CalendarDays size={14}/><time dateTime={nextDate}>{nextDate}</time>{dates.length>1&&<span>{t(` · 本月 ${dates.length} 个举办日`,` · ${dates.length} dates this month`)}</span>}</div><h4>{translateText(event.title,locale)}</h4><p className="ub-city-event-venue"><MapPin size={14}/>{translateText(event.venue,locale)}</p><p>{translateText(event.costLabel,locale)}</p>{EVENT_SCHEDULE_NOTES[event.id]&&<small>{translateText(EVENT_SCHEDULE_NOTES[event.id],locale)}</small>}
        <div className="ub-city-event-actions"><a href={cityEventUrl(event.id,locale)} target="_blank" rel="noopener noreferrer">{t('详情与报名','Details & booking')}<ArrowUpRight size={14}/></a><a href={cityEventMapUrl(event)} target="_blank" rel="noopener noreferrer">{t('真实地址','Real directions')}<ArrowUpRight size={14}/></a><a href={`/plan?date=${nextDate}&stops=event:${encodeURIComponent(event.id)}${locale==='zh-Hans'?'':`&lang=${locale}`}#outing-plan`} target="_blank" rel="noopener noreferrer">{t('安排这一天','Plan this day')}<ArrowRight size={14}/></a><a href={cityEventUrl(event.id,locale,true)} target="_blank" rel="noopener noreferrer"><Users size={14}/>{t('想去 · 找搭子','Interested · Go together')}</a></div>
        <a className="ub-city-source" href={event.officialUrl} target="_blank" rel="noopener noreferrer">{t('官方来源','Official source')} · {t('核实于','Checked')} {event.verifiedAt}<ArrowUpRight size={12}/></a>
      </article>)}
      <a className="ub-city-calendar" href={`/calendar?date=${month.start}&region=${city.region}${locale==='zh-Hans'?'':`&lang=${locale}`}`} target="_blank" rel="noopener noreferrer">{t('查看地区完整活动日历','See the regional event calendar')}<ArrowUpRight size={15}/></a>
      </>}
    </div>
    {onAsk&&<footer className="ub-city-ai"><div><Sparkles size={19}/><span>{t('把这一城，排成半天的小旅行','Turn this city into a little half-day trip')}</span></div><button onClick={()=>onAsk(cityGuideAiPrompt(city,month.key,events,locale))}>{t('问 BAYBAY','Ask BAYBAY')}<ArrowRight size={15}/></button></footer>}
  </section></div>;
}
