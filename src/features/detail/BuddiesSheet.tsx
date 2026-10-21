import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, RefreshCw, Users } from 'lucide-react';
import type { MonthlyEvent } from '../../data/monthly-types';
import { getEventBuddies, type EventBuddy, type EventInterest } from '../../lib/event-engagement';
import { translateText, useLocale } from '../../i18n/locale';
import { Sheet } from '../../components/ui/Sheet';
import './detail-sheet.css';
import { Button } from '../../components/ui/Button';
import { useEventParticipation } from '../../lib/event-participation-context';

/**
 * 一起去 · 活动搭子 (UI9-DETAIL): the public buddy list of one event in F's Sheet (enter and exit motion, the scrim, e2, one
 * close button, no blur). Loaded on its own when a reader opens it (EventParticipationActions). Joining needs an account;
 * the list is an interest signal, never a booking.
 */
export default function BuddiesSheet({ event, ended, open, onClose }: { event: MonthlyEvent; ended: boolean; open: boolean; onClose: () => void }) {
  const participation = useEventParticipation()!;
  const { app } = participation;
  const locale = useLocale();
  const [buddies, setBuddies] = useState<EventBuddy[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const alive = useRef(false);
  const requestSerial = useRef(0);
  const readController = useRef<AbortController | null>(null);
  const me = participation.entries[event.id]?.me;
  const busy = participation.busy.includes(event.id);
  const load = useCallback(async (next?: string) => {
    if (!alive.current || (next && readController.current)) return;
    // A refresh supersedes any initial read or pagination that started before a membership change.
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    const serial = ++requestSerial.current;
    const current = () => alive.current && !controller.signal.aborted && serial === requestSerial.current;
    setLoading(true); setFailed(false);
    try {
      const result = await getEventBuddies(event.id, next, controller.signal);
      if (!current()) return;
      setBuddies(previous => next ? [...new Map([...previous, ...result.buddies].map(buddy => [buddy.id, buddy])).values()] : result.buddies); setCursor(result.nextCursor);
    } catch { if (current()) setFailed(true); }
    finally { if (current()) { readController.current = null; setLoading(false); } }
  }, [event.id]);
  // The list is read while the sheet is open; closing it aborts the read (the sheet stays mounted for its exit motion).
  useEffect(() => {
    if (!open) return;
    alive.current = true; void load();
    return () => { alive.current = false; readController.current?.abort(); };
  }, [load, open]);
  const updateMembership = async (value: EventInterest) => {
    if (await participation.update(event.id, value) && alive.current) void load();
  };
  const join = async () => {
    if (!app?.user) { onClose(); app?.setShowLogin(true); return; }
    await updateMembership({ interested: true, lookingForBuddy: !me?.lookingForBuddy });
  };
  return <Sheet open={open} onClose={onClose} title={translateText('一起去 · 活动搭子', locale)} className="detail-sheet buddy-sheet">
    <h3>{event.title}</h3><p className="detail-sheet__small">{event.dateLabel} · {event.city}</p>
    {!ended && <div className="detail-sheet__note"><strong>{locale === 'en' ? 'Make a concrete plan together' : locale === 'zh-Hant' ? '選好日期，約一支小隊' : '选好日期，约一支小队'}</strong><p>{locale === 'en' ? '2–8 adults, including the host. Choose a date, request a place and wait for confirmation.' : locale === 'zh-Hant' ? '2–8 位成年人，包含隊長。選具體場次、申請加入，確認後在小隊內溝通。' : '2–8 位成年人，包含队长。选具体场次、申请加入，确认后在小队内沟通。'}</p><Button variant="secondary" onClick={onClose} to={`/together?event=${encodeURIComponent(event.id)}`} icon={<Users aria-hidden="true" strokeWidth={1.75} />}>{locale === 'en' ? 'Find or start a small group' : locale === 'zh-Hant' ? '查看或發起小隊' : '查看或发起小队'}</Button></div>}
    <div className="detail-sheet__note"><strong>{locale === 'en' ? 'Only sharing an interest?' : locale === 'zh-Hant' ? '還沒定日期？可以先公開找搭子意向' : '还没定日期？可以先公开找搭子意向'}</strong><p>“想去”只计入人数；加入“一起去”才会在这里显示你的昵称、头像与城市，其他用户可以通过站内私信联系你。随时退出即可从列表移除。</p><p>{locale === 'en' ? 'This public list is an interest signal; it does not reserve a place in a group.' : locale === 'zh-Hant' ? '此名單只表示意向，不代表已加入小隊或保留名額。' : '此名单只表示意向，不代表已加入小队或保留名额。'}</p></div>
    {!ended ? <Button variant="primary" disabled={busy || (!!app?.user && !me)} onClick={join} icon={<Users aria-hidden="true" strokeWidth={1.75} />}>{me?.lookingForBuddy ? '退出一起去' : app?.user ? '公开加入一起去' : '登录后加入一起去'}</Button> : me?.lookingForBuddy ? <Button variant="secondary" disabled={busy} onClick={() => { void updateMembership({ interested: false, lookingForBuddy: false }); }}>退出已结束活动</Button> : <p>活动已结束，不再接受新的出行意向。</p>}
    <div className="buddy-list-heading"><h3>正在找搭子的人</h3><Button variant="quiet" disabled={loading} onClick={() => { void load(); }} icon={<RefreshCw aria-hidden="true" strokeWidth={1.75} />}>刷新</Button></div>
    {failed ? <p role="alert">搭子列表暂时无法加载，请点刷新重试。</p> : !loading && buddies.length === 0 ? <p className="buddy-empty">还没有人公开加入。你可以先记下想去，或把活动分享给朋友。</p> : null}
    <ul className="buddy-list">{buddies.map(buddy => <li key={buddy.id}>
      <button type="button" className="buddy-person" onClick={() => { onClose(); app?.openUserProfile(buddy.id); }} aria-label={`${translateText('查看个人主页')}：${buddy.nickname}`}><span className="buddy-avatar">{buddy.avatar && /^(https:\/\/|\/(?!\/))/.test(buddy.avatar) ? <img src={buddy.avatar} alt="" width={40} height={40} /> : <Users size={20} />}</span><span><strong translate="no">{buddy.nickname}</strong>{buddy.city && <span translate="no">{buddy.city}</span>}</span></button>
      {app?.user?.id === buddy.id ? <span className="detail-sheet__small">我</span> : <Button variant="quiet" onClick={() => { onClose(); app?.openChat(buddy.id, buddy.nickname, event.title); }} icon={<MessageCircle aria-hidden="true" strokeWidth={1.75} />}>私信聊聊</Button>}
    </li>)}</ul>
    {loading && <p role="status">正在加载搭子…</p>}{cursor && !loading && <Button variant="secondary" onClick={() => { void load(cursor); }}>查看更多搭子</Button>}
    <p className="detail-sheet__small">这里是出行意向交流，不是主办方报名。先在站内沟通，在公共场所碰面；对方的个人主页提供举报与屏蔽入口。</p>
  </Sheet>;
}
