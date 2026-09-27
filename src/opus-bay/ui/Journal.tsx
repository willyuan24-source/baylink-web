import { useState, type ReactNode } from 'react';
import { BookOpen, CalendarPlus, Check, CircleHelp, Footprints, Heart, ListChecks, Mail, MapPinned, Route, Trash2 } from 'lucide-react';
import { FOOTPRINTS_TAB, Footprints as FootprintsTab } from './Footprints';
import { useGame } from '../core/store';
import type { WishItem } from '../core/types';
import { eventById, nextShowing, placeById, todayInBay, useCatalog } from '../data/catalog';
import { eventUrl, guideUrl, mapsUrl, pickPlanDate, planStopTitles, planUrl, walkingRouteUrl, type PlanStop } from '../data/links';
import { POIS } from '../data/pois';
import { POSTCARDS, activePostcardCount, activePostcardTotal } from '../data/postcards';
import { goalProgress } from '../data/sf/goals';
import { FREE_GOALS } from '../data/script';
import { wishlist } from '../data/wishlist';
import { closePanel, openEvent, openPanel, startTour, tourStops, wishPlannable } from '../game/flow';
import { flow } from '../game/flowStore';
import { poiById } from '../game/interactables';
import { useT } from '../i18n';
import { LinkButton, Sheet } from './common';
import { useImageOk } from './hooks';
import { formatDay, postcardImage } from './format';

type Tab = 'cards' | 'goals' | 'wish' | 'steps';

/** 旅行本: postcards, goals + tour progress, wishlist with a BAYLINK hand-off. */
export function Journal() {
  const { t } = useT();
  const wishCount = useGame(s => s.wishlist.length);
  // only the active world's cards count (a save may hold both worlds' ids, G2-3)
  const cards = useGame(s => activePostcardCount(s.postcards));
  const [tab, setTab] = useState<Tab>(() => (wishCount > 0 && cards === 0 ? 'wish' : 'cards'));
  const tabs: { id: Tab; label: string; icon: ReactNode; count?: string }[] = [
    { id: 'cards', label: t('明信片', 'Postcards'), icon: <Mail size={16} aria-hidden />, count: `${cards}/${activePostcardTotal() || 8}` },
    { id: 'goals', label: t('目标', 'Goals'), icon: <ListChecks size={16} aria-hidden /> },
    { id: 'wish', label: t('想去', 'Wishlist'), icon: <Heart size={16} aria-hidden />, count: wishCount ? String(wishCount) : undefined },
  ];
  // lane G1's 足迹 tab (ui/Footprints.tsx; absent until G1 turns it on)
  const steps = FOOTPRINTS_TAB;
  if (steps) tabs.push({ id: 'steps', label: t(steps.label), icon: <Footprints size={16} aria-hidden />, count: steps.count?.() });
  return (
    <Sheet eyebrow={<><BookOpen size={14} aria-hidden />{t('旅行本', 'Journal')}</>} title={t('我的湾区旅行本', 'My Bay journal')} onClose={closePanel} className="ob-journal">
      <div className="ob-tabs" role="tablist">
        {tabs.map(item => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'is-on' : ''} onClick={() => setTab(item.id)}>
            {item.icon}<span>{item.label}</span>{item.count && <small>{item.count}</small>}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'cards' && <Cards />}
        {tab === 'goals' && <Goals />}
        {tab === 'wish' && <Wishes />}
        {tab === 'steps' && <FootprintsTab />}
      </div>
    </Sheet>
  );
}

function Cards() {
  const { t } = useT();
  const got = useGame(s => s.postcards);
  if (!POSTCARDS.length) return <p className="ob-muted">{t('明信片还在印刷中，稍后再来看看。', 'The postcards are still at the printer — check back soon.')}</p>;
  return (
    <>
      <p className="ob-muted">{t('明信片藏在主路旁边一点点的地方，留意发金光的小卡片。', 'Postcards hide just off the main path — look for little golden glints.')}</p>
      <ul className="ob-cards">
        {POSTCARDS.map((card, i) => {
          const found = got.includes(card.id);
          return (
            <li key={card.id} className={found ? 'is-found' : 'is-missing'}>
              {found ? (
                <button type="button" onClick={() => flow.set({ postcardReward: card.id })} aria-label={t(card.title)}>
                  <CardImage src={postcardImage(card.id)} n={i + 1} label={card.title.en} />
                  <span className="ob-card-title">{t(card.title)}</span>
                </button>
              ) : (
                <div className="ob-card-missing">
                  <span className="ob-card-img"><CircleHelp size={22} aria-hidden /></span>
                  <span className="ob-card-hint">{t(card.hint)}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function CardImage({ src, n, label }: { src?: string; n: number; label: string }) {
  const ok = useImageOk(src);
  return <span className={`ob-card-img ${ok ? 'has-img' : 'is-art'}`} style={ok ? { backgroundImage: `url(${src})` } : undefined} data-n={n}>{!ok && <span>{label}</span>}</span>;
}

function Goals() {
  const { t } = useT();
  const done = useGame(s => s.goalsDone);
  const completed = useGame(s => s.tour.completed);
  const active = useGame(s => s.tour.active);
  const stops = tourStops();
  return (
    <>
      <section className="ob-block">
        <h3 className="ob-h3"><Route size={15} aria-hidden />{t('湾区第一课', 'Bay 101')} · {completed.length}/{stops.length}</h3>
        <ol className="ob-stops">
          {stops.map(stop => {
            const poi = poiById(stop.poiId);
            const ok = completed.includes(stop.poiId);
            return <li key={stop.poiId} className={ok ? 'is-done' : ''}><span className="ob-check">{ok && <Check size={13} aria-hidden />}</span>{poi ? t(poi.name) : stop.poiId}</li>;
          })}
        </ol>
        {!active && completed.length < stops.length && (
          <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={() => { closePanel(); startTour(); }}>{completed.length ? t('继续导览', 'Resume the tour') : t('开始导览', 'Start the tour')}</button>
        )}
      </section>
      <section className="ob-block">
        <h3 className="ob-h3"><ListChecks size={15} aria-hidden />{t('自由探索目标', 'Explorer goals')}</h3>
        <ul className="ob-goals">
          {FREE_GOALS.map(goal => {
            const ok = done.includes(goal.id);
            const progress = goalProgress(goal.id, done);
            return (
              <li key={goal.id} className={ok ? 'is-done' : ''}>
                <span className="ob-check">{ok && <Check size={13} aria-hidden />}</span>
                <div><strong>{t(goal.label)}{progress && ` · ${progress}`}</strong><small>{t(goal.hint)}</small></div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function wishStops(items: WishItem[]): PlanStop[] {
  return items.flatMap<PlanStop>(item => {
    if (item.kind === 'event') return [{ kind: 'event', id: item.id }];
    if (item.kind === 'place') return [{ kind: 'place', id: item.id }];
    if (item.kind === 'poi') { const id = poiById(item.id)?.plannerPlaceId; return id ? [{ kind: 'place', id }] : []; }
    return [];
  });
}

/** Where a saved item is, when we know (for the Maps link and the walking route). */
function wishPoint(item: WishItem, catalog: ReturnType<typeof useCatalog>): { lat: number; lng: number } | null {
  if (item.kind === 'poi') { const info = poiById(item.id)?.realInfo; return info ? { lat: info.lat, lng: info.lng } : null; }
  if (item.kind === 'place') { const loc = placeById(catalog, item.id)?.location; return loc ? { lat: loc.lat, lng: loc.lng } : null; }
  if (item.kind === 'event') { const loc = eventById(catalog, item.id)?.location; return loc ? { lat: loc.lat, lng: loc.lng } : null; }
  return null;
}

const poiOrder = (id: string) => { const i = POIS.findIndex(poi => poi.id === id); return i < 0 ? 999 : i; };

function Wishes() {
  const { t, locale } = useT();
  const catalog = useCatalog();
  const items = useGame(s => s.wishlist);
  const today = todayInBay();
  if (!items.length) {
    return (
      <div className="ob-empty">
        <Heart size={30} aria-hidden />
        <p>{t('还没有想去的地方。在地点卡片或活动传单上点「加入想去」。', 'Nothing saved yet. Tap “Save to wishlist” on a place card or event flyer.')}</p>
      </div>
    );
  }
  // what BAYLINK's planner can take: a day every selected event is really on (+ places), ≤ 3 stops
  const pick = pickPlanDate(wishStops(items), catalog, today);
  const carried = pick.stops;
  const titles = planStopTitles(carried, catalog);
  const later = pick.rest.filter(item => item.date).map(item => ({ title: eventById(catalog, item.id)?.title ?? item.id, date: item.date! }));
  // saves the planner cannot take (waterfront spots without a planner place, ended events…) — offered as a walking route
  const notPlannable = items.filter(item => !wishPlannable(item, catalog));
  const routeItems = items.filter(item => item.kind === 'poi' && !!wishPoint(item, catalog)).sort((a, b) => poiOrder(a.id) - poiOrder(b.id));
  const route = walkingRouteUrl(routeItems.map(item => wishPoint(item, catalog)!));
  const nameOf = (item: WishItem) => { const poi = item.kind === 'poi' ? poiById(item.id) : undefined; return poi ? t(poi.name) : eventById(catalog, item.id)?.title ?? placeById(catalog, item.id)?.title ?? item.title; };
  return (
    <>
      <ul className="ob-wishes">
        {items.map(item => {
          const poi = item.kind === 'poi' ? poiById(item.id) : undefined;
          const event = item.kind === 'event' ? eventById(catalog, item.id) : undefined;
          const showing = event ? nextShowing(event) : null;
          const next = showing?.date ?? null;
          const ended = !!event && next === null;
          const title = nameOf(item);
          const open = poi ? () => openPanel('poi', poi.id) : event ? () => openEvent(event.id) : undefined;
          const point = wishPoint(item, catalog);
          return (
            <li key={`${item.kind}:${item.id}`} className={ended ? 'is-ended' : ''}>
              <span className={`ob-wish-kind k-${item.kind}`}>{item.kind === 'event' ? t('活动', 'Event') : item.kind === 'guide' ? t('攻略', 'Guide') : t('地点', 'Place')}</span>
              <span className="ob-wish-main">
                {open ? <button type="button" className="ob-wish-title" onClick={open}>{title}</button> : item.kind === 'guide' ? <a className="ob-wish-title" href={guideUrl(item.id, locale)} target="_blank" rel="noopener">{title}</a> : <span className="ob-wish-title">{title}</span>}
                {event && <small className={`ob-wish-date ${ended ? 'is-ended' : ''}`}>{ended ? t('已结束', 'Ended') : showing?.tonight ? t('今晚', 'Tonight') : formatDay(next!, locale, today)}</small>}
              </span>
              {point && <a className="ob-icon-btn ob-icon-sm" href={mapsUrl(point.lat, point.lng, title)} target="_blank" rel="noopener noreferrer" aria-label={t('在地图上看', 'Open in Maps')}><MapPinned size={16} aria-hidden /></a>}
              {event && <a className="ob-icon-btn ob-icon-sm" href={eventUrl(event.id, locale)} target="_blank" rel="noopener" aria-label={t('活动详情', 'Event page')}><CalendarPlus size={16} aria-hidden /></a>}
              <button type="button" className="ob-icon-btn ob-icon-sm" onClick={() => wishlist.remove(item.kind, item.id)} aria-label={t('移除', 'Remove')}><Trash2 size={16} aria-hidden /></button>
            </li>
          );
        })}
      </ul>
      <div className="ob-handoff">
        {carried.length > 0 && (
          <p>
            {t(`把 ${titles.join('、')} 带去 BAYLINK，排成 ${formatDay(pick.date, 'zh-Hans', today)} 的出游计划。`, `Take ${titles.join(', ')} to BAYLINK as a plan for ${formatDay(pick.date, 'en', today)}.`)}
            {later.length > 0 && <small>{t(`不在同一天：${later.map(item => `${item.title}（${formatDay(item.date, 'zh-Hans', today)}）`).join('、')}，可以单独安排。`, `On other days: ${later.map(item => `${item.title} (${formatDay(item.date, 'en', today)})`).join(', ')} — plan those separately.`)}</small>}
          </p>
        )}
        {notPlannable.length > 0 && (
          <p className="ob-handoff-note">
            {t(`这几处暂不能放进 BAYLINK 计划：${notPlannable.map(nameOf).join('、')}。`, `These can’t go into a BAYLINK plan yet: ${notPlannable.map(nameOf).join(', ')}.`)}
            {route && <small>{t('可以用步行路线把海边这几站串起来。', 'Use the walking route to string the waterfront spots together.')}</small>}
          </p>
        )}
        <div className="ob-actions">
          {carried.length > 0 && <LinkButton href={planUrl({ date: pick.date, stops: carried }, catalog, locale, today)} tone="primary" icon={<CalendarPlus size={17} aria-hidden />}>{t('带去 BAYLINK 安排', 'Plan on BAYLINK')}</LinkButton>}
          {route && <LinkButton href={route} tone={carried.length ? 'soft' : 'primary'} external icon={<Footprints size={17} aria-hidden />}>{t(`步行路线（${routeItems.length} 处）`, `Walking route (${routeItems.length})`)}</LinkButton>}
        </div>
      </div>
    </>
  );
}
