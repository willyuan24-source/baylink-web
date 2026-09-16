import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Heart, MessageCircle, RefreshCw, Users, X } from 'lucide-react';
import { useApp, type AppContextValue } from '../app/context';
import type { MonthlyEvent } from '../data/monthly-types';
import { getEventBuddies, getEventEngagement, setEventInterest, type EventBuddy, type EventEngagement, type EventInterest } from '../lib/event-engagement';
import { getBayAreaToday } from '../lib/monthly';
import { translateText, useLocale } from '../i18n/locale';
import { ModalShell } from './ui/Modal';
import { EventParticipationContext, useEventParticipation } from '../lib/event-participation-context';

export function EventParticipationProvider({ events, children }: { events: MonthlyEvent[]; children: ReactNode }) {
  const app = useApp() as AppContextValue | undefined;
  return <ParticipationSession key={app?.user?.id || 'guest'} events={events} app={app}>{children}</ParticipationSession>;
}
function ParticipationSession({ events, app, children }: { events: MonthlyEvent[]; app?: AppContextValue; children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, EventEngagement>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string[]>([]);
  const revisions = useRef<Record<string, number>>({});
  const locks = useRef(new Set<string>());
  const alive = useRef(true);
  const ids = events.map(event => event.id).sort().join(',');
  const enabled = !!app;
  const requestSerial = useRef(0);
  const refresh = useCallback(async () => {
    if (!enabled || !ids) return;
    const serial = ++requestSerial.current;
    const before = { ...revisions.current };
    setLoading(true);
    try {
      const response = await getEventEngagement(ids.split(','));
      if (!alive.current || serial !== requestSerial.current) return;
      setEntries(previous => {
        const next = { ...previous };
        for (const entry of response) if ((before[entry.eventId] || 0) === (revisions.current[entry.eventId] || 0)) next[entry.eventId] = entry;
        return next;
      });
      setFailed(false);
    } catch { if (alive.current && serial === requestSerial.current) setFailed(true); }
    finally { if (alive.current && serial === requestSerial.current) setLoading(false); }
  }, [enabled, ids]);
  useEffect(() => {
    alive.current = true; void refresh();
    const focus = () => { void refresh(); };
    window.addEventListener('focus', focus);
    return () => {
      alive.current = false;
      // This is a request-generation counter, not a DOM ref. Cleanup must invalidate the latest request.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++requestSerial.current;
      window.removeEventListener('focus', focus);
    };
  }, [refresh]);
  const update = async (id: string, value: EventInterest) => {
    if (!app?.user) { app?.setShowLogin(true); return false; }
    if (locks.current.has(id)) return false;
    locks.current.add(id); setBusy([...locks.current]);
    revisions.current[id] = (revisions.current[id] || 0) + 1;
    try {
      const entry = await setEventInterest(id, value);
      if (!alive.current) return false;
      revisions.current[id] = (revisions.current[id] || 0) + 1;
      setEntries(previous => ({ ...previous, [id]: entry })); setFailed(false);
      app.showToast(value.lookingForBuddy ? '已加入一起去，可随时退出。' : value.interested ? '已记下想去，在「我的想去」中找回。' : '已取消想去与搭子状态。', 'success');
      return true;
    } catch {
      if (alive.current) { app.showToast('这次未能确认保存结果，请刷新后查看。', 'error'); void refresh(); }
      return false;
    } finally { locks.current.delete(id); if (alive.current) setBusy([...locks.current]); }
  };
  return <EventParticipationContext.Provider value={{ entries, loading, failed, busy, refresh, update, app }}>{children}</EventParticipationContext.Provider>;
}

export function EventParticipationActions({ event, today = getBayAreaToday() }: { event: MonthlyEvent; today?: string }) {
  const participation = useEventParticipation();
  const locale = useLocale();
  const [buddiesOpen, setBuddiesOpen] = useState(false);
  if (!participation) return null;
  const entry = participation.entries[event.id];
  const ended = event.endDate < today;
  const isInterested = !!entry?.me?.interested;
  const pending = participation.busy.includes(event.id);
  const count = !entry || participation.failed ? null : entry.interestedCount;
  return <div className="event-participation">
    <div className="event-participation-buttons">
      <button type="button" className={isInterested ? 'event-interest is-selected' : 'event-interest'} aria-pressed={isInterested} disabled={pending || (ended && !isInterested) || (!!participation.app?.user && !entry)} onClick={() => { void participation.update(event.id, { interested: !isInterested, lookingForBuddy: false }); }} aria-label={`${isInterested ? translateText('取消想去') : translateText('我想去')}：${translateText(event.title)}`}>
        {isInterested ? <Check size={17} /> : <Heart size={17} />}{ended && !isInterested ? '活动已结束' : isInterested ? '已想去' : '我想去'}<span>{count === null ? '—' : count}</span>
      </button>
      <button type="button" className="event-buddy-button" onClick={() => setBuddiesOpen(true)}><Users size={17} />一起去{entry && !participation.failed && <span>{entry.buddyCount}</span>}</button>
    </div>
    <p className="event-participation-note">{participation.failed ? <><span>人数暂时无法加载</span><button type="button" onClick={participation.refresh}><RefreshCw size={12} />重试</button></> : count === null ? '正在读取大家的出行意向…' : locale === 'en' ? `${count} interested · Interest is not a ticket or booking.` : `${count} 人想去 · 意向不等于报名或购票。`}</p>
    {buddiesOpen && <EventBuddies event={event} ended={ended} onClose={() => setBuddiesOpen(false)} />}
  </div>;
}

function EventBuddies({ event, ended, onClose }: { event: MonthlyEvent; ended: boolean; onClose: () => void }) {
  const participation = useEventParticipation()!;
  const { app } = participation;
  useLocale();
  const [buddies, setBuddies] = useState<EventBuddy[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const me = participation.entries[event.id]?.me;
  const busy = participation.busy.includes(event.id);
  const load = useCallback(async (next?: string, signal?: AbortSignal) => {
    setLoading(true); setFailed(false);
    try {
      const result = await getEventBuddies(event.id, next, signal);
      if (signal?.aborted) return;
      setBuddies(previous => next ? [...new Map([...previous, ...result.buddies].map(buddy => [buddy.id, buddy])).values()] : result.buddies); setCursor(result.nextCursor);
    } catch { if (!signal?.aborted) setFailed(true); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [event.id]);
  useEffect(() => { const controller = new AbortController(); void load(undefined, controller.signal); return () => controller.abort(); }, [load]);
  const join = async () => {
    if (!app?.user) { onClose(); app?.setShowLogin(true); return; }
    if (await participation.update(event.id, { interested: true, lookingForBuddy: !me?.lookingForBuddy })) void load();
  };
  return <ModalShell onClose={onClose} label="一起去 · 活动搭子" className="discovery-modal-backdrop">
    <div className="discovery-modal buddy-sheet" onClick={action => action.stopPropagation()}>
      <button type="button" className="discovery-modal-close" onClick={onClose} aria-label="关闭一起去"><X size={20} /></button>
      <span className="discovery-eyebrow">BAYLINK · GO TOGETHER</span><h2>有个搭子，出门更容易。</h2><h3>{event.title}</h3><p>{event.dateLabel} · {event.city}</p>
      <div className="discovery-inline-note"><strong>由你决定是否公开加入</strong><p>“想去”只计入人数；加入“一起去”才会在这里显示你的昵称、头像与城市，其他用户可以通过站内私信联系你。随时退出即可从列表移除。</p></div>
      {!ended ? <button type="button" className="discovery-primary" disabled={busy || (!!app?.user && !me)} onClick={join}><Users size={17} />{me?.lookingForBuddy ? '退出一起去' : app?.user ? '公开加入一起去' : '登录后加入一起去'}</button> : me?.lookingForBuddy ? <button type="button" onClick={() => { void participation.update(event.id, { interested: false, lookingForBuddy: false }).then(ok => { if (ok) void load(); }); }}>退出已结束活动</button> : <p>活动已结束，不再接受新的出行意向。</p>}
      <div className="buddy-list-heading"><h3>正在找搭子的人</h3><button type="button" disabled={loading} onClick={() => { void load(); }}><RefreshCw size={14} />刷新</button></div>
      {failed ? <p role="alert">搭子列表暂时无法加载，请点刷新重试。</p> : !loading && buddies.length === 0 ? <p className="buddy-empty">还没有人公开加入。你可以先记下想去，或把活动分享给朋友。</p> : null}
      <ul className="buddy-list">{buddies.map(buddy => <li key={buddy.id}>
        <button type="button" className="buddy-person" onClick={() => { onClose(); app?.openUserProfile(buddy.id); }} aria-label={`${translateText('查看个人主页')}：${buddy.nickname}`}><span className="buddy-avatar">{buddy.avatar && /^(https:\/\/|\/(?!\/))/.test(buddy.avatar) ? <img src={buddy.avatar} alt="" width={40} height={40} /> : <Users size={20} />}</span><span><strong translate="no">{buddy.nickname}</strong>{buddy.city && <span translate="no">{buddy.city}</span>}</span></button>
        {app?.user?.id === buddy.id ? <span className="discovery-small">我</span> : <button type="button" onClick={() => { onClose(); if (!app?.user) app?.setShowLogin(true); else app.openChat(buddy.id, buddy.nickname, event.title); }}><MessageCircle size={15} />私信聊聊</button>}
      </li>)}</ul>
      {loading && <p role="status">正在加载搭子…</p>}{cursor && !loading && <button type="button" onClick={() => { void load(cursor); }}>查看更多搭子</button>}
      <p className="discovery-small">这里是出行意向交流，不是主办方报名。先在站内沟通，在公共场所碰面；对方的个人主页提供举报与屏蔽入口。</p>
    </div>
  </ModalShell>;
}
