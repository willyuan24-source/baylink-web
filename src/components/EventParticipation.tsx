import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Hand, RefreshCw, Users } from 'lucide-react';
import { useApp, type AppContextValue } from '../app/context';
import type { MonthlyEvent } from '../data/monthly-types';
import { getEventEngagement, setEventInterest, type EventEngagement, type EventInterest } from '../lib/event-engagement';
import { getBayAreaToday } from '../lib/monthly';
import { translateText, useLocale } from '../i18n/locale';
import { Button } from './ui/Button';
import { EventParticipationContext, useEventParticipation } from '../lib/event-participation-context';

// The 一起去 sheet (the public buddy list) loads when a reader opens it (route JS budgets).
const BuddiesSheet = lazy(() => import('../features/detail/BuddiesSheet'));

export function EventParticipationProvider({ events, children }: { events: MonthlyEvent[]; children: ReactNode }) {
  const app = useApp() as AppContextValue | undefined;
  const session = app?.user ? `${app.user.id}:${app.user.token || ''}` : 'guest';
  return <ParticipationSession key={session} events={events} app={app}>{children}</ParticipationSession>;
}
function ParticipationSession({ events, app, children }: { events: MonthlyEvent[]; app?: AppContextValue; children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, EventEngagement>>({});
  const [unknown, setUnknown] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string[]>([]);
  const revisions = useRef<Record<string, number>>({});
  const locks = useRef(new Set<string>());
  const loadedIds = useRef(new Set<string>());
  const alive = useRef(true);
  const ids = events.map(event => event.id).sort().join(',');
  const enabled = !!app;
  const requestSerial = useRef(0);
  const readController = useRef<AbortController | null>(null);
  const read = useCallback(async (force = false) => {
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    const serial = ++requestSerial.current;
    const requested = ids ? ids.split(',').filter(id => force || !loadedIds.current.has(id)) : [];
    if (!enabled || !requested.length) { setLoading(false); setFailed(false); return; }
    const before = { ...revisions.current };
    setLoading(true);
    setFailed(false);
    try {
      const response = await getEventEngagement(requested, controller.signal);
      if (!alive.current || controller.signal.aborted || serial !== requestSerial.current) return;
      setEntries(previous => {
        const next = { ...previous };
        for (const entry of response.entries) if ((before[entry.eventId] || 0) === (revisions.current[entry.eventId] || 0)) next[entry.eventId] = entry;
        return next;
      });
      // H07: an event the API does not know yet (its catalog copy lags until the API-SYNC after a content merge) has no
      // participation to show. It is not a failure, so no 重试; the next forced read (focus) asks again.
      setUnknown(previous => [...previous.filter(id => !requested.includes(id)), ...response.unknown]);
      for (const id of [...response.entries.map(entry => entry.eventId), ...response.unknown]) loadedIds.current.add(id);
      setFailed(false);
    } catch { if (alive.current && !controller.signal.aborted && serial === requestSerial.current) setFailed(true); }
    finally { if (alive.current && !controller.signal.aborted && serial === requestSerial.current) setLoading(false); }
  }, [enabled, ids]);
  const refresh = useCallback(() => { void read(true); }, [read]);
  useEffect(() => {
    alive.current = true; void read();
    const focus = () => { void read(true); };
    window.addEventListener('focus', focus);
    return () => {
      alive.current = false;
      // This is a request-generation counter, not a DOM ref. Cleanup must invalidate the latest request.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++requestSerial.current;
      readController.current?.abort();
      window.removeEventListener('focus', focus);
    };
  }, [read]);
  const update = async (id: string, value: EventInterest) => {
    if (!app?.user) { app?.setShowLogin(true); return false; }
    if (locks.current.has(id)) return false;
    locks.current.add(id); setBusy([...locks.current]);
    revisions.current[id] = (revisions.current[id] || 0) + 1;
    try {
      const entry = await setEventInterest(id, value);
      if (!alive.current) return false;
      revisions.current[id] = (revisions.current[id] || 0) + 1;
      loadedIds.current.add(id);
      setEntries(previous => ({ ...previous, [id]: entry })); setFailed(false);
      app.showToast(value.lookingForBuddy ? '已公开找搭子意向，尚未加入具体小队。' : value.interested ? '已记下想去，在「我的想去」中找回。' : '已取消想去与搭子状态。', 'success');
      return true;
    } catch {
      if (alive.current) { app.showToast('这次未能确认保存结果，请刷新后查看。', 'error'); void refresh(); }
      return false;
    } finally { locks.current.delete(id); if (alive.current) setBusy([...locks.current]); }
  };
  // A newly expanded scope must not briefly look like a complete empty result
  // before its effect starts. Cached counts belong only to this account session.
  const awaitingScope = enabled && !!ids && ids.split(',').some(id => !entries[id] && !unknown.includes(id));
  return <EventParticipationContext.Provider value={{ entries, unknown, loading: loading || (awaitingScope && !failed), failed, busy, refresh, update, app }}>{children}</EventParticipationContext.Provider>;
}

export function EventParticipationActions({ event, today = getBayAreaToday(), available = true }: { event: MonthlyEvent; today?: string; available?: boolean }) {
  const participation = useEventParticipation();
  const locale = useLocale();
  const [buddiesOpen, setBuddiesOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  // H07: the API cannot count, record or list 一起去 for an event it does not know yet; showing buttons that can only fail,
  // or "人数暂时无法加载", would be wrong. The detail page drops its 想约人一起去？ block too, or keeps a one-line note for a
  // reader who followed a link to #event-participation (LocalDiscoveryDetail).
  if (!participation || participation.unknown.includes(event.id)) return null;
  const entry = participation.entries[event.id];
  const ended = event.endDate < today;
  const unavailable = ended || !available;
  const isInterested = !!entry?.me?.interested;
  const pending = participation.busy.includes(event.id);
  const count = !entry || participation.failed ? null : entry.interestedCount;
  // FC3-02: the page's one heart is ♡ 收藏 (the save model, no sign-in). This public interest count is a different thing,
  // so it has its own name and a hand, not a heart.
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const label = unavailable && !isInterested ? ended ? t('活动已结束', 'Event ended') : t('暂无已确认场次', 'No confirmed date') : isInterested ? t('已公开想去', 'Interest shared') : t('公开想去', 'Share interest');
  // F's secondary look for both; a pressed 公开想去 shows the selected state (discovery-community.css).
  return <div className="event-participation">
    <div className="event-participation-buttons">
      <Button variant="secondary" className={isInterested ? 'event-interest is-selected' : 'event-interest'} aria-pressed={isInterested} disabled={pending || (unavailable && !isInterested) || (!!participation.app?.user && !entry)} onClick={() => { void participation.update(event.id, { interested: !isInterested, lookingForBuddy: false }); }} aria-label={`${isInterested ? t('取消公开想去', 'Withdraw interest') : t('公开想去', 'Share interest')}：${translateText(event.title, locale)}`}
        icon={isInterested ? <Check aria-hidden="true" strokeWidth={1.75} /> : <Hand aria-hidden="true" strokeWidth={1.75} />}>{label}{count !== null && count >= 3 && <span>{count}</span>}</Button>
      <Button variant="secondary" className="event-buddy-button" onClick={() => { setOpened(true); setBuddiesOpen(true); }} icon={<Users aria-hidden="true" strokeWidth={1.75} />}>{unavailable ? t('查看出行意向', 'See who is going') : t('一起去', 'Go together')}{entry && !participation.failed && entry.buddyCount >= 3 && <span>{entry.buddyCount}</span>}</Button>
    </div>
    <p className="event-participation-note">{participation.failed ? <><span>人数暂时无法加载</span><button type="button" onClick={participation.refresh}><RefreshCw size={12} />重试</button></> : count === null ? '正在读取大家的出行意向…' : locale === 'en' ? `${count >= 3 ? `${count} interested · ` : ''}Interest is not a ticket or booking.` : `${count >= 3 ? `${count} 人想去 · ` : ''}意向不等于报名或购票。`}</p>
    {opened && <Suspense fallback={null}><BuddiesSheet key={event.id} event={event} ended={unavailable} open={buddiesOpen} onClose={() => setBuddiesOpen(false)} /></Suspense>}
  </div>;
}
