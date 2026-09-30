import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { MONTHLY_EVENTS } from '../../data/monthly-edition';
import { getBayAreaToday } from '../../lib/monthly';
import { outings, type Outing, type OutingAiDraft, type OutingCreate, type OutingDraft, type OutingResult } from '../../lib/outings';
import { useOutingCopy } from './outing-copy';
import { outingError, type OutingSession } from './outing-session';

export const emptyOutingDraft = (eventId = '', date = ''): OutingDraft => {
  const event = MONTHLY_EVENTS.find(row => row.id === eventId);
  return { title: event ? `${event.title} · 一起去` : '', description: '', eventId: event?.id || null, date,
    startTime: '', endTime: '', city: event?.city || '', venue: event?.venue || '', capacity: 4,
    costNote: '', transport: 'own', language: 'any' };
};
type Props = { initial: OutingDraft; outing?: Outing; session: OutingSession; onSaved: (result: OutingResult) => void; onCancel: () => void; onRefresh?: () => void };
export function OutingForm({ initial, outing, session, onSaved, onCancel, onRefresh }: Props) {
  const { t, locale } = useOutingCopy();
  const [draft, setDraft] = useState(initial), [adult, setAdult] = useState(false), [publicPlace, setPublicPlace] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [intent, setIntent] = useState('');
  const [ai, setAi] = useState<OutingAiDraft | null>(null), [aiBusy, setAiBusy] = useState(false), [aiError, setAiError] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const lock = useRef(false), active = useRef(false), aiSerial = useRef(0), aiController = useRef<AbortController | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; ++aiSerial.current; aiController.current?.abort(); }; }, []);
  const event = MONTHLY_EVENTS.find(row => row.id === draft.eventId);
  const fieldNames: Record<string, string> = { title:t('小队名称','Outing title'),description:t('活动与同行说明','Activity and expectations'),eventId:t('关联活动','Linked event'),date:t('参加日期','Outing date'),startTime:t('集合时间','Meeting time'),endTime:t('预计结束时间','Expected end time'),city:t('城市','City'),venue:t('公共集合地点','Public meeting place'),capacity:t('人数上限','Capacity'),costNote:t('费用与报名说明','Costs and registration'),transport:t('出行方式','Transport'),language:t('沟通语言','Language') };
  const set = <K extends keyof OutingDraft>(key: K, value: OutingDraft[K]) => {
    setDraft(previous => ({ ...previous, [key]: value }));
    if (['date', 'startTime', 'endTime', 'venue', 'city'].includes(key)) setPublicPlace(false);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || !session.current()) return;
    if (!adult || !publicPlace) { setError(t('请先确认年满 18 岁，并已核对公共集合地点。', 'Confirm you are 18 or older and have checked the public meeting place.')); return; }
    if (!draft.date || draft.date < getBayAreaToday() || draft.endTime <= draft.startTime) { setError(t('请选择未来的日期与同一天内有效的起止时间。', 'Choose an upcoming date and a valid start and end time on the same day.')); return; }
    const value: OutingCreate = { ...draft, title: draft.title.trim(), description: draft.description.trim(), city: draft.city.trim(), venue: draft.venue.trim(), costNote: draft.costNote.trim(), adultConsent: adult, publicPlaceConsent: publicPlace };
    const payload = { mode: outing ? 'edit' : 'create', id: outing?.id, value }, key = session.key(payload), controller = session.controller();
    lock.current = true; setBusy(true); setError('');
    try {
      const { adultConsent: createOnlyConsent, ...editable } = value; void createOnlyConsent;
      const result = outing ? await outings.update(outing, editable, key, controller.signal) : await outings.create(value, key, controller.signal);
      if (!active.current || !session.current() || controller.signal.aborted) return;
      session.clearKey(payload); onSaved(result);
    } catch (reason) { if (active.current && session.current() && !controller.signal.aborted) setError(outingError(reason, t)); }
    finally { session.release(controller); if (active.current && session.current()) { lock.current = false; setBusy(false); } }
  };
  const generate = async () => {
    if (!intent.trim() || !session.current()) return;
    aiController.current?.abort(); const controller = session.controller(); aiController.current = controller;
    const serial = ++aiSerial.current; setAiBusy(true); setAiError(''); setAi(null);
    try {
      const result = await outings.draft({ intent: intent.trim(), eventId: draft.eventId, locale }, controller.signal);
      if (session.current() && !controller.signal.aborted && serial === aiSerial.current) setAi(result);
    } catch { if (session.current() && !controller.signal.aborted && serial === aiSerial.current) setAiError(t('草稿助手暂不可用。你的描述仍保留，可以直接填写下方表单。', 'The draft assistant is unavailable. Your description is preserved; you can fill in the form below.')); }
    finally { session.release(controller); if (session.current() && serial === aiSerial.current) setAiBusy(false); }
  };
  return <section className="outing-form outing-surface" aria-label={outing ? t('编辑小队安排', 'Edit outing') : t('发起小队', 'Create an outing')}>
    <button type="button" className="outing-link-button" onClick={() => setCancelConfirm(true)} disabled={busy}><ArrowLeft size={16} />{t('返回小队', 'Back to outings')}</button>
    <h2>{outing ? t('更新安排，让成员重新确认。', 'Update the plan for members to review.') : t('从一个具体的约定开始。', 'Start with a clear plan.')}</h2>
    <p className="outing-footnote">{t('2–8 人，包含发起人。这里只组织同行，不售票、不收费，也不保证对方身份。请勿填写家庭住址、电话或其他私人联系方式。', '2–8 people, including the host. This is for arranging company, not selling tickets or collecting payments. Identity is not guaranteed. Do not include home addresses, phone numbers or private contact details.')}</p>
    {cancelConfirm && <div className="outing-notice"><p>{t('返回会关闭这份未保存的草稿。', 'Going back closes this unsaved draft.')}</p><div className="outing-inline-actions"><button className="outing-secondary" onClick={onCancel}>{t('放弃草稿并返回', 'Discard draft and return')}</button><button className="outing-link-button" onClick={() => setCancelConfirm(false)}>{t('继续填写', 'Keep editing')}</button></div></div>}
    {!outing && <details className="outing-ai"><summary><Sparkles size={17} />{t('可选：让 AI 帮我起草', 'Optional: draft with AI')}</summary><p>{t('说说想去哪天、做什么、从哪座城市出发。AI 只整理草稿；地点、开放时间和费用需要你核对，不会自动发布。', 'Describe the date, activity and starting city. AI only drafts text; check places, opening hours and costs yourself. Nothing is published automatically.')}</p>
      <label>{t('描述你的同行想法', 'Describe your outing idea')}<textarea maxLength={1200} value={intent} onChange={e => { setIntent(e.target.value); ++aiSerial.current; aiController.current?.abort(); setAiBusy(false); setAi(null); }} /></label>
      <button type="button" className="outing-secondary" disabled={!intent.trim() || aiBusy || busy} onClick={() => void generate()}>{aiBusy ? t('正在整理草稿…', 'Drafting…') : t('生成草稿', 'Generate draft')}</button>
      {aiError && <p role="alert">{aiError}</p>}{ai && <div className="outing-ai-result"><p>{ai.answer}</p>{ai.questions.length > 0 && <><strong>{t('补充这些信息后，可以再次生成', 'Add these details and generate again')}</strong><ul>{ai.questions.map(question => <li key={question}>{question}</li>)}</ul></>}{ai.missing.length > 0 && <p>{t('仍需补充', 'Still needed')}：{ai.missing.map(field => fieldNames[field] || t('其他待核对信息','Other details to check')).join(' · ')}</p>}
        <button type="button" className="outing-secondary" disabled={busy} onClick={() => { const { eventId: ignoredEventId, ...values } = ai.draft; void ignoredEventId; setDraft(previous => ({ ...previous, ...values, eventId: previous.eventId })); setAdult(false); setPublicPlace(false); setAi(null); }}>{t('采用草稿后逐项检查', 'Use draft and review every field')}</button></div>}
    </details>}
    <form onSubmit={event => void submit(event)}><fieldset disabled={busy}>
      <section className="outing-form-section"><h3><span className="outing-step">01</span>{t('一起做什么', 'What you will do')}</h3>
        {event ? <div className="outing-associated">{t('关联活动', 'Linked event')} · <Link to={`/events/${event.id}`}>{event.title}</Link><p className="outing-footnote">{t('加入小队不包含门票或正式报名。每位成员自行核对主办方要求。', 'Joining the outing does not include a ticket or official registration. Each member must check the organizer’s requirements.')}</p>{!outing && <button type="button" className="outing-link-button" onClick={() => set('eventId', null)}>{t('改为独立自发小队', 'Make this an independent outing')}</button>}</div> : <p className="outing-footnote">{t('独立自发小队；请确认目的地允许公众到访。', 'An independently organized outing. Check that your destination is open to visitors.')}</p>}
        <div className="outing-fields"><label className="is-wide">{t('小队名称', 'Outing title')}<input required maxLength={100} value={draft.title} onChange={e => set('title', e.target.value)} /></label><label className="is-wide">{t('活动与同行说明', 'Activity and expectations')}<textarea required maxLength={1200} value={draft.description} onChange={e => set('description', e.target.value)} placeholder={t('例如：轻松步行看展，午后结束；请说明体力要求、需要自备的东西。', 'For example: an easy museum visit ending in the afternoon. Include access needs, physical demands and what to bring.')} /></label></div>
      </section>
      <section className="outing-form-section"><h3><span className="outing-step">02</span>{t('把时间和地点说清楚', 'Set the time and meeting place')}</h3><div className="outing-fields">
        <label>{t('参加日期', 'Outing date')}<input type="date" required min={getBayAreaToday()} value={draft.date} onChange={e => set('date', e.target.value)} /></label><label>{t('人数上限（包含你）', 'Capacity (including you)')}<select value={draft.capacity} onChange={e => set('capacity', Number(e.target.value))}>{[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        <label>{t('集合时间', 'Meeting time')}<input type="time" required value={draft.startTime} onChange={e => set('startTime', e.target.value)} /></label><label>{t('预计结束时间', 'Expected end time')}<input type="time" required value={draft.endTime} onChange={e => set('endTime', e.target.value)} /></label>
        <p className="outing-footnote is-wide">{t('日期和时间均按湾区当地时间 America/Los_Angeles。多日活动请只选本小队实际参加的一天。', 'All dates and times use America/Los_Angeles. For a multi-day event, choose the one day this outing will attend.')}</p>
        <label>{t('城市', 'City')}<input required maxLength={80} value={draft.city} onChange={e => set('city', e.target.value)} /></label><label>{t('公共集合地点', 'Public meeting place')}<input required maxLength={200} value={draft.venue} onChange={e => set('venue', e.target.value)} placeholder={t('明确场所与入口，不填私人住址', 'Name the public place and entrance, not a home address')} /></label>
        <label>{t('出行方式', 'Transport')}<select value={draft.transport} onChange={e => set('transport', e.target.value as OutingDraft['transport'])}><option value="own">{t('各自到场', 'Arrive independently')}</option><option value="transit">{t('公共交通同行', 'Public transit together')}</option><option value="walk">{t('步行同行', 'Walk together')}</option></select></label><label>{t('沟通语言', 'Language')}<select value={draft.language} onChange={e => set('language', e.target.value as OutingDraft['language'])}><option value="any">{t('不限', 'Any')}</option><option value="zh">{t('中文', 'Chinese')}</option><option value="en">{t('英文', 'English')}</option></select></label>
        <label className="is-wide">{t('费用与报名说明', 'Costs and registration')}<textarea required maxLength={300} value={draft.costNote} onChange={e => set('costNote', e.target.value)} placeholder={t('写清门票、餐饮和交通由谁支付；未知费用请写待确认，不把入场免费当作整趟免费。', 'Explain ticket, food and transport costs. Mark unknown costs as unconfirmed; free admission does not mean a free outing.')} /></label>
      </div></section>
      <section className="outing-form-section"><h3><span className="outing-step">03</span>{t('发布前确认', 'Confirm before publishing')}</h3>
        <label className="outing-check"><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} />{t('我已年满 18 岁，了解这是成年人自发同行，不是主办方报名或服务预约。', 'I am 18 or older and understand this is an independent adult outing, not official event registration or a service booking.')}</label>
        <label className="outing-check"><input type="checkbox" checked={publicPlace} onChange={e => setPublicPlace(e.target.checked)} />{t('我已自行核对集合地点为可到访的公共场所，时间、费用和到访要求已写清；不会公开私人地址或联系方式。', 'I have checked that the meeting place is publicly accessible and explained the timing, costs and entry requirements. I will not publish private addresses or contact details.')}</label>
        {outing && <p className="outing-notice">{t('修改关键安排后，已确认成员需要重新确认。不要把旧确认当作接受了新时间或地点。', 'After key changes, confirmed members must reconfirm. An earlier confirmation does not accept a new time or place.')}</p>}
      </section>
    </fieldset>{error && <div className="outing-error" role="alert"><p>{error}</p>{onRefresh && <button type="button" className="outing-secondary" disabled={busy} onClick={onRefresh}>{t('刷新最新状态', 'Refresh latest state')}</button>}{!outing && <Link to="/together?view=mine" target="_blank" rel="noopener noreferrer" className="outing-link-button">{t('在新页核对我的小队', 'Check my outings in a new tab')}</Link>}</div>}
      <div className="outing-form-footer"><span className="outing-footnote">{t('手机号验证不代表身份保证', 'Phone verification is not an identity guarantee')}</span><button className="outing-primary" type="submit" disabled={busy || !adult || !publicPlace}>{busy ? t('正在提交…', 'Submitting…') : outing ? t('保存更新', 'Save changes') : t('发布小队', 'Publish outing')}</button></div>
    </form>
  </section>;
}
