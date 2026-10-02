import { useEffect, useRef, useState } from 'react';
import { CalendarClock, Check, HelpCircle, Plus, X } from 'lucide-react';
import { getBayAreaToday } from '../../lib/monthly';
import { outings, type Outing, type OutingPollAction, type OutingPollAnswer, type OutingResult, type OutingTimeOption } from '../../lib/outings';
import { outingError, type OutingSession } from './outing-session';
import { useOutingCopy, useOutingNow } from './outing-copy';
import './outing-time-poll.css';

type Props = { outing: Outing; session: OutingSession; disabled?: boolean; onUpdated: (result: OutingResult) => void; onRefresh: () => Promise<boolean> };
export function OutingTimePoll({ outing, session, disabled = false, onUpdated, onRefresh }: Props) {
  const { t, locale } = useOutingCopy(), now = useOutingNow();
  const poll = outing.timePoll, host = outing.me?.role === 'host';
  const [creating, setCreating] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<string | null>(null), [answers, setAnswers] = useState<Record<string, OutingPollAnswer>>(poll?.myAnswers || {});
  const [options, setOptions] = useState<OutingTimeOption[]>([{ date: outing.date, startTime: outing.startTime, endTime: outing.endTime }, { date: '', startTime: outing.startTime, endTime: outing.endTime }]);
  const lock = useRef(false), previousPoll = useRef(poll?.id);
  useEffect(() => {
    // Refreshing a concurrent vote must not erase this member's unsaved choices.
    if (previousPoll.current !== poll?.id) { previousPoll.current = poll?.id; setAnswers(poll?.myAnswers || {}); }
    setSelected(null);
  }, [poll]);
  const eligible = outing.me?.status === 'confirmed';
  const upcoming = outing.status === 'open' && outing.startAt > now;
  const confirmed = outing.me?.confirmedVersion === outing.planVersion;
  const canAct = upcoming && confirmed && !disabled && !busy;
  if (!eligible || (!poll && !host)) return null;
  const day = (date: string) => new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  const run = async (action: OutingPollAction) => {
    if (lock.current || !canAct || !session.current()) return;
    const payload = { mode: 'time-poll', outingId: outing.id, ...action }, key = session.key(payload), controller = session.controller();
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = await outings.timePoll(outing, action, key, controller.signal);
      if (!session.current() || controller.signal.aborted) return;
      if (result.outing.me?.userId !== outing.me?.userId) throw new Error('Unexpected outing account');
      session.clearKey(payload); onUpdated(result); setCreating(false); setSelected(null);
      setNotice(result.notificationWarning ? t('已保存，部分通知尚未送达，请以本页最新状态为准。', 'Saved. Some notifications are pending; use the latest status on this page.') : action.action === 'vote' ? t('你的时间偏好已保存，可在投票结束前修改。', 'Your availability is saved. You can change it while voting remains open.') : action.action === 'adopt' ? t('时间选择已保存；如安排有变，成员仍需重新确认。', 'The choice is saved. Members still need to reconfirm any changed arrangement.') : action.action === 'close' ? t('投票已结束，当前安排保持不变。', 'Voting ended. The current arrangement is unchanged.') : t('投票已发起，当前安排暂不变。', 'Voting is open. The current arrangement is unchanged.'));
    } catch (reason) { if (session.current() && !controller.signal.aborted) setError(outingError(reason, t)); }
    finally { session.release(controller); if (session.current()) { lock.current = false; setBusy(false); } }
  };
  const closedLabel = poll?.status === 'adopted' ? t('已采用一个时间', 'A time was selected') : poll?.closeReason === 'arrangement-changed' ? t('安排变更，旧投票已结束', 'Closed after the arrangement changed') : t('已结束，保留原安排', 'Closed without changing the arrangement');
  const picked = poll?.options.find(option => option.id === selected);
  return <section className="outing-time-poll" aria-labelledby="outing-poll-title">
    <header className="outing-poll-heading"><span className="outing-poll-icon"><CalendarClock size={23}/></span><div><span className="outing-eyebrow">{t('一起协调，更容易成行', 'Find a time that works')}</span><h2 id="outing-poll-title">{t('小队时间投票', 'Team availability')}</h2></div>{poll && <span className={`outing-badge ${poll.status === 'open' && upcoming ? '' : 'is-muted'}`}>{poll.status === 'open' ? upcoming ? t('投票中', 'Voting open') : t('小队已开始或结束', 'Outing no longer upcoming') : closedLabel}</span>}</header>
    <div className="outing-poll-current"><span>{t('当前安排', 'Current arrangement')}</span><strong>{day(outing.date)} · {outing.startTime}–{outing.endTime}</strong><small>{t('湾区当地时间', 'Bay Area time')}</small></div>
    <p className="outing-footnote">{t('只有已加入的成员可查看和投票。投票仅表达时间偏好；队长明确采用后才会更改安排，变更后仍需成员重新确认。', 'Only confirmed members can view and vote. Votes express availability; the host must explicitly select a time to change the arrangement, and members must reconfirm changes.')}</p>
    {!confirmed && upcoming && <p className="outing-status-panel">{t('请先在上方确认最新安排，再参与协调。', 'Confirm the latest arrangement above before coordinating.')}</p>}
    {poll && <><div className="outing-poll-progress"><span>{poll.repliedCount}/{poll.eligibleCount} {t('位成员已回应', 'members replied')}</span><span>{t('显示汇总与自己的选择', 'Totals and your own choices')}</span></div><div className="outing-poll-options">{poll.options.map((option, index) => <article key={option.id} className={`outing-poll-option ${poll.selectedOptionId === option.id ? 'is-selected' : ''}`}>
      <div className="outing-poll-option-title"><span className="outing-poll-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{day(option.date)}</h3><p>{option.startTime}–{option.endTime}</p></div>{poll.selectedOptionId === option.id && <span className="outing-badge"><Check size={13}/>{t('已采用', 'Selected')}</span>}</div>
      <div className="outing-poll-counts"><span><Check size={13}/>{option.counts.yes} {t('可以', 'yes')}</span><span><HelpCircle size={13}/>{option.counts.maybe} {t('待定', 'maybe')}</span><span><X size={13}/>{option.counts.no} {t('不行', 'no')}</span></div>
      {poll.status === 'open' && upcoming ? <fieldset className="outing-poll-votes"><legend>{t('我的时间', 'My availability')} · {day(option.date)} {option.startTime}</legend>{(['yes', 'maybe', 'no'] as const).map(answer => <button type="button" key={answer} className={`is-${answer}`} aria-pressed={answers[option.id] === answer} disabled={!canAct} onClick={() => { setAnswers(previous => ({ ...previous, [option.id]: answer })); setNotice(''); }}>{answer === 'yes' ? t('可以', 'Yes') : answer === 'maybe' ? t('待定', 'Maybe') : t('不行', 'No')}</button>)}</fieldset> : poll.myAnswers && <p className="outing-footnote">{t('我的选择：', 'My choice: ')}{poll.myAnswers[option.id] === 'yes' ? t('可以', 'Yes') : poll.myAnswers[option.id] === 'maybe' ? t('待定', 'Maybe') : t('不行', 'No')}</p>}
      {option.startAt <= now && <p className="outing-footnote">{t('这个候选时间已开始，不能再采用。', 'This time has started and cannot be selected.')}</p>}
      {host && poll.status === 'open' && upcoming && <button type="button" className="outing-link-button outing-poll-adopt" disabled={!canAct || option.startAt <= now} onClick={() => setSelected(option.id)}>{t('选择这个时间…', 'Select this time…')}</button>}
    </article>)}</div>
      {poll.status === 'open' && upcoming && <div className="outing-inline-actions outing-poll-footer"><button type="button" className="outing-primary" disabled={!canAct || poll.options.some(option => !answers[option.id]) || poll.options.every(option => option.startAt <= now)} onClick={() => void run({ action: 'vote', pollId: poll.id, answers })}>{busy ? t('正在保存…', 'Saving…') : t('保存我的时间选择', 'Save my availability')}</button>{host && <button type="button" className="outing-link-button" disabled={!canAct} onClick={() => void run({ action: 'close', pollId: poll.id })}>{t('结束投票，保留原时间', 'Close voting, keep current time')}</button>}</div>}
      {picked && canAct && <div className="outing-poll-confirm" role="group" aria-label={t('确认采用时间', 'Confirm time selection')}><strong>{t('采用', 'Select')} {day(picked.date)} · {picked.startTime}–{picked.endTime}？</strong><p>{t('这会结束投票。如与当前时间不同，将更新公开的小队安排并通知成员重新确认；“可以”票不代替最终确认。', 'This closes voting. If the time changes, the public arrangement is updated and members are asked to reconfirm. A yes vote is not final confirmation.')}</p><div className="outing-inline-actions"><button type="button" className="outing-primary" onClick={() => void run({ action: 'adopt', pollId: poll.id, optionId: picked.id })}>{t('确认采用并通知成员', 'Confirm selection and notify members')}</button><button type="button" className="outing-link-button" onClick={() => setSelected(null)}>{t('继续讨论', 'Keep discussing')}</button></div></div>}
    </>}
    {host && upcoming && poll?.status !== 'open' && !creating && <button type="button" className="outing-secondary outing-poll-start" disabled={!canAct} onClick={() => { setCreating(true); setError(''); }}><Plus size={16}/>{t('提出 2–3 个候选时间', 'Suggest 2–3 times')}</button>}
    {creating && host && upcoming && <form className="outing-poll-create" onSubmit={event => { event.preventDefault(); void run({ action: 'create', options }); }}><h3>{t('给大家几个具体选择', 'Offer a few clear choices')}</h3><p className="outing-footnote">{outing.eventId ? t('已关联活动：每个日期都必须是已收录的活动场次。', 'Linked event: every proposed date must be a recorded event occurrence.') : t('请选择未来 180 天内、同一天开始和结束的时间。', 'Choose times within the next 180 days, starting and ending on the same day.')}</p>{options.map((option, index) => <fieldset className="outing-poll-create-row" key={index}><legend>{t('候选', 'Option')} {index + 1}</legend>{(['date', 'startTime', 'endTime'] as const).map(field => <label key={field}>{field === 'date' ? t('日期', 'Date') : field === 'startTime' ? t('开始', 'Start') : t('结束', 'End')}<input required type={field === 'date' ? 'date' : 'time'} min={field === 'date' ? getBayAreaToday(new Date(now)) : undefined} value={option[field]} disabled={!canAct} onChange={event => setOptions(previous => previous.map((row, i) => i === index ? { ...row, [field]: event.target.value } : row))}/></label>)}{options.length === 3 && index === 2 && <button type="button" className="outing-link-button" disabled={!canAct} onClick={() => setOptions(previous => previous.slice(0, 2))}>{t('移除', 'Remove')}</button>}</fieldset>)}<div className="outing-inline-actions">{options.length < 3 && <button type="button" className="outing-link-button" disabled={!canAct} onClick={() => setOptions(previous => [...previous, { date: '', startTime: outing.startTime, endTime: outing.endTime }])}>{t('加一个候选时间', 'Add another time')}</button>}<button type="submit" className="outing-primary" disabled={!canAct}>{t('发起投票，暂不改期', 'Start poll, keep current time')}</button><button type="button" className="outing-link-button" disabled={busy} onClick={() => setCreating(false)}>{t('取消', 'Cancel')}</button></div></form>}
    {error && <div className="outing-status-panel" role="alert"><p>{error}</p><button type="button" className="outing-link-button" disabled={busy || disabled} onClick={() => void onRefresh()}>{t('刷新小队状态', 'Refresh outing')}</button></div>}{notice && <p className="outing-status-panel" role="status">{notice}</p>}
  </section>;
}
