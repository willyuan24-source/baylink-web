import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, Plus, RefreshCw, X } from 'lucide-react';
import { bayAreaBookingDate, bookingDisplayStatus, serviceBookings, type BookingNotifications, type BookingSettings, type ServiceAvailability, type ServiceBooking, type ServiceSlot } from '../../lib/service-bookings';
import type { PostData, UserData } from '../../lib/types';
import { ServiceAvailabilityDraft } from '../../components/ServiceAvailabilityDraft';
import { useBookingCopy, type BookingTranslate } from './booking-copy';
import { BookingError, BookingNotice, BookingReceipt } from './booking-shared';
import { bookingError, bookingSessionKey, useBookingSession, type BookingToast } from './booking-session';
import './bookings.css';

export type ServiceBookingPanelProps = { post: PostData; currentUser: UserData | null; onLoginNeeded: () => void; showToast: BookingToast; onRequestTime?: () => void };
type SlotDraft = Pick<ServiceSlot, 'date' | 'startTime' | 'endTime'>;

function ProviderAvailability({ data, busy, t, onSettings, onAdd, onRemove }: {
  data: ServiceAvailability; busy: boolean; t: BookingTranslate;
  onSettings: (settings: BookingSettings) => Promise<boolean>; onAdd: (slots: SlotDraft[]) => Promise<boolean>; onRemove: (id: string) => void;
}) {
  const [settingsDraft, setSettingsDraft] = useState<BookingSettings | null>(null);
  const settings: BookingSettings = settingsDraft || { enabled: data.enabled, mode: data.mode, minNoticeMinutes: data.minNoticeMinutes, bufferMinutes: data.bufferMinutes };
  const editSettings = (changed: Partial<BookingSettings>) => { setSettingsDraft({ ...settings, ...changed }); setSaved(false); };
  const [date, setDate] = useState(''), [start, setStart] = useState('09:00'), [end, setEnd] = useState('10:00');
  const [draft, setDraft] = useState<SlotDraft[]>([]), [error, setError] = useState(''), [showUnavailable, setShowUnavailable] = useState(false);
  const [saved, setSaved] = useState(false), [published, setPublished] = useState(false);
  const saveSettings = async (next: BookingSettings) => { setSaved(false); if (await onSettings(next)) { setSettingsDraft(null); setSaved(true); } };
  const quickSetAvailability = async (enabled: boolean) => {
    setSaved(false);
    if (await onSettings({ enabled, mode: data.mode, minNoticeMinutes: data.minNoticeMinutes, bufferMinutes: data.bufferMinutes })) {
      setSettingsDraft(previous => previous ? { ...previous, enabled } : null);
    }
  };
  const hasSettingsChanges = settings.enabled !== data.enabled || settings.mode !== data.mode || settings.minNoticeMinutes !== data.minNoticeMinutes || settings.bufferMinutes !== data.bufferMinutes;
  const applyDraft = (incoming: SlotDraft[]) => {
    const combined = [...new Map([...draft, ...incoming].map(slot => [`${slot.date}:${slot.startTime}:${slot.endTime}`, slot])).values()].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    if (combined.length > 30) { setError(t('每次最多发布 30 个时段。', 'Publish up to 30 times at once.')); return; }
    if (combined.some((slot, index) => combined.slice(0, index).some(other => other.date === slot.date && slot.startTime < other.endTime && slot.endTime > other.startTime))) { setError(t('待发布的时段不能重叠。', 'Draft times must not overlap.')); return; }
    setError(''); setDraft(combined); setSaved(false); setPublished(false);
  };
  const addDraft = () => {
    setError('');
    if (!date || date < bayAreaBookingDate() || !start || !end || end <= start) { setError(t('请选择今天或之后的日期，并让结束时间晚于开始时间。', 'Choose today or a later date, with the end after the start.')); return; }
    if (draft.length >= 30) { setError(t('每次最多发布 30 个时段。', 'Publish up to 30 times at once.')); return; }
    if (draft.some(slot => slot.date === date && start < slot.endTime && end > slot.startTime)) { setError(t('待发布的时段不能重叠。', 'Draft times must not overlap.')); return; }
    setDraft(previous => [...previous, { date, startTime: start, endTime: end }].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)));
    setSaved(false); setPublished(false);
  };
  const slots = data.slots.filter(slot => !data.enabled || showUnavailable || slot.available);
  const unavailableLabel = (slot: ServiceSlot) => !data.enabled ? t('尚未开放给顾客', 'Not open to customers yet')
    : slot.reason === '这个时段已开始或已过期。' ? t('已开始或已过期', 'Started or expired')
    : slot.reason === '未满足服务者的最短提前预约时间。' ? t('已超过最短提前预约时间', 'Too close to the start time')
    : slot.reason === '这个时段或相邻缓冲时间已有预约。' ? t('时段或相邻缓冲已被预约', 'Time or adjacent buffer is occupied')
    : t('已占用或不可约', 'Occupied or unavailable');
  return <div className="booking-provider">
    <div className="booking-availability-state"><div><strong>{data.enabled ? t('正在接受预约', 'Accepting bookings') : t('预约尚未开放', 'Bookings are not open yet')}</strong><p>{data.enabled ? t('顾客可以选择已发布的可约时段。', 'Customers can choose your published available times.') : data.slots.length ? t('时段已保存在这里，开放后顾客才能预约。', 'Your times are saved here. Open bookings when you are ready for customers.') : t('先添加日期和时间，再开放预约。', 'Add dates and times, then open bookings.')}</p></div>{data.enabled || data.slots.length > 0 ? <button type="button" className="booking-secondary" disabled={busy} onClick={() => void quickSetAvailability(!data.enabled)}>{data.enabled ? t('暂停新预约', 'Pause new bookings') : t('开放预约', 'Open bookings')}</button> : null}</div>
    <details className="booking-settings"><summary>{t('预约规则（可选）', 'Booking rules (optional)')}<span>{hasSettingsChanges ? t('规则已修改，还未保存', 'Rule changes are not saved yet') : data.mode === 'request' ? t('当前需你确认', 'Provider approval required') : t('当前立即确认', 'Instant confirmation')}</span></summary>
    <form onSubmit={async event => { event.preventDefault(); await saveSettings(settings); }}>
      <fieldset disabled={busy} className="booking-fieldset"><legend>{t('预约设置', 'Booking settings')}</legend>
        <label className="booking-check"><input type="checkbox" checked={settings.enabled} onChange={event => editSettings({ enabled: event.target.checked })} />{t('开放这个服务的预约', 'Accept bookings for this service')}</label>
        <div className="booking-fields"><label>{t('确认方式', 'Confirmation')}<select value={settings.mode} onChange={event => editSettings({ mode: event.target.value as 'request' | 'instant' })}><option value="request">{t('我确认后预约成功（推荐）', 'Request my approval (recommended)')}</option><option value="instant">{t('用户提交后立即确认', 'Confirm immediately')}</option></select></label>
          <label>{t('最短提前时间', 'Minimum notice')}<select value={settings.minNoticeMinutes} onChange={event => editSettings({ minNoticeMinutes: Number(event.target.value) })}>{[[0, t('无需提前', 'No minimum')], [60, t('1 小时', '1 hour')], [120, t('2 小时', '2 hours')], [1440, t('24 小时', '24 hours')]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>{t('预约间缓冲', 'Time between bookings')}<select value={settings.bufferMinutes} onChange={event => editSettings({ bufferMinutes: Number(event.target.value) })}>{[0, 15, 30, 60].map(minutes => <option key={minutes} value={minutes}>{minutes} {t('分钟', 'minutes')}</option>)}</select></label>
        </div><p className="booking-footnote">{t('每个时段只接受一笔预约，覆盖整个起止时间。待确认申请会暂占时段；到期后释放。', 'Each time block accepts one booking for its full duration. Pending requests hold the time until they expire.')}</p>
        <button className="booking-primary" type="submit">{busy ? t('保存中…', 'Saving…') : t('保存预约设置', 'Save booking settings')}</button>{saved && <p role="status">{t('预约设置已保存。', 'Booking settings saved.')}</p>}
      </fieldset>
    </form>
    </details>
    <div className="booking-slot-editor"><h4>{t('批量添加可约时间', 'Add available times')}</h4><p className="booking-footnote">{t('所有时间均为湾区时间（洛杉矶时区），系统会按日期处理夏令时。', 'All times are Bay Area local time (Los Angeles). Daylight saving is handled for each date.')}</p>
      <ServiceAvailabilityDraft disabled={busy} onApply={applyDraft} />
      <fieldset disabled={busy} className="booking-fieldset"><legend className="booking-sr-only">{t('新增时段', 'New time block')}</legend><div className="booking-fields booking-time-fields">
        <label>{t('日期', 'Date')}<input type="date" min={bayAreaBookingDate()} value={date} onChange={event => setDate(event.target.value)} /></label>
        <label>{t('开始时间', 'Start time')}<input type="time" value={start} onChange={event => setStart(event.target.value)} /></label>
        <label>{t('结束时间', 'End time')}<input type="time" value={end} onChange={event => setEnd(event.target.value)} /></label>
      </div><button type="button" className="booking-secondary" onClick={addDraft}><Plus size={16} aria-hidden="true" />{t('加入待发布清单', 'Add to draft')}</button>
      {error && <BookingError message={error} />}
      {!!draft.length && <div className="booking-draft"><p>{t('待发布时段', 'Draft times')} · {draft.length}/30</p><ul>{draft.map((slot, index) => <li key={slot.date + slot.startTime}><span>{slot.date} · {slot.startTime}–{slot.endTime}</span><button type="button" aria-label={`${t('移除时段', 'Remove time')} ${slot.date} ${slot.startTime}`} onClick={() => setDraft(previous => previous.filter((_, position) => position !== index))}><X size={16} aria-hidden="true" /></button></li>)}</ul>
        <button className="booking-primary" type="button" onClick={async () => { if (await onAdd(draft)) { setDraft([]); setPublished(true); } }}>{data.enabled ? t('发布这些时段', 'Publish these times') : t('保存这些时段', 'Save these times')}</button></div>}
      </fieldset>
      {published && <div className="booking-publish-result" role="status"><p>{data.enabled ? t('时段已发布，顾客可以选择当前可约的时间。', 'Times are published. Customers can choose those currently available.') : t('时段已保存，预约尚未开放。', 'Times are saved. Bookings are not open yet.')}</p>{!data.enabled && <button type="button" className="booking-primary" disabled={busy} onClick={() => void quickSetAvailability(true)}>{t('开放这些时段', 'Open these times for booking')}</button>}</div>}
    </div>
    <div className="booking-published"><h4>{t('已发布时段', 'Published times')}</h4><label className="booking-check"><input type="checkbox" checked={showUnavailable} onChange={event => setShowUnavailable(event.target.checked)} />{t('显示已占用或不可约时段', 'Show occupied or unavailable times')}</label>
      {!slots.length && <p className="booking-empty">{data.slots.length ? t('已保存的时段目前都不可约。勾选上方选项可查看原因或清理旧时段。', 'Your saved times are currently unavailable. Select the option above to see why or remove old times.') : t('还没有保存时段。先添加日期和时间。', 'No times saved yet. Add a date and time first.')}</p>}
      <ul className="booking-slot-list">{slots.map(slot => <li key={slot.id}><span><strong>{slot.date}</strong> {slot.startTime}–{slot.endTime}{!slot.available && <small>{unavailableLabel(slot)}</small>}</span><button type="button" disabled={busy} className="booking-text" onClick={() => onRemove(slot.id)} aria-label={`${t('移除已发布时段', 'Remove published time')} ${slot.date} ${slot.startTime}`}>{t('移除', 'Remove')}</button></li>)}</ul>
    </div>
  </div>;
}

function BookingPanelSession({ post, currentUser, onLoginNeeded, showToast, onRequestTime }: ServiceBookingPanelProps) {
  const { t } = useBookingCopy(), session = useBookingSession(currentUser);
  const [data, setData] = useState<ServiceAvailability | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [date, setDate] = useState(''), [slotId, setSlotId] = useState(''), [note, setNote] = useState(''), [city, setCity] = useState(currentUser?.city || '');
  const [receipt, setReceipt] = useState<{ booking: ServiceBooking; notifications: BookingNotifications } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const readVersion = useRef(0), mutating = useRef(false);
  const owner = currentUser?.id === post.authorId;
  const noteHint = post.category === '维修' ? t('请说明故障、大致位置，以及是否有照片可供之后私信查看。详细门牌可稍后再分享。', 'Describe the problem, general location and any photos you can share in messages. Share the exact address later.')
    : post.category === '清洁' ? t('请说明面积、房间数及是否提供清洁用品。详细门牌可在确认后私信。', 'Include the floor area, number of rooms and whether supplies are provided. Share the exact address after confirming.')
    : post.category === '接送' ? t('请说明起终点所在地区、人数、行李及航班（如适用）。详细门牌可后续私信。', 'Include pickup and destination areas, passengers, luggage and flight details if relevant. Share exact addresses in messages later.')
    : t('请说明需要的服务、人数或希望先确认的问题。请勿填写银行卡等敏感资料。', 'Describe the service, group size or questions to confirm. Do not include payment card details.');
  const load = useCallback(async () => {
    const version = ++readVersion.current, controller = session.controller(); setLoading(true);
    try { const response = await serviceBookings.availability(post.id, controller.signal); if (session.current() && !controller.signal.aborted && version === readVersion.current) { setData(response); setError(''); } }
    catch (reason) { if (session.current() && !controller.signal.aborted && version === readVersion.current) setError(bookingError(reason, t, 'read')); }
    finally { session.release(controller); if (session.current() && version === readVersion.current) setLoading(false); }
  }, [post.id, session, t]);
  useEffect(() => { void load(); }, [load]);
  const update = async (operation: (signal: AbortSignal) => Promise<ServiceAvailability>, payload?: unknown, context?: 'remove') => {
    if (mutating.current || !session.current()) return false;
    mutating.current = true; ++readVersion.current; setBusy(true); setError(''); const controller = session.controller();
    try { const response = await operation(controller.signal); if (!session.current()) return false; setData(response); if (payload) session.clearKey(payload); showToast(t('已保存。', 'Saved.'), 'success'); return true; }
    catch (reason) { if (session.current()) setError(bookingError(reason, t, context)); return false; }
    finally { session.release(controller); if (session.current()) { mutating.current = false; setBusy(false); setLoading(false); } }
  };
  const available = data?.slots.filter(slot => slot.available && slot.startAt > now + data.minNoticeMinutes * 60_000).sort((a, b) => a.startAt - b.startAt) || [];
  const dates = [...new Set(available.map(slot => slot.date))];
  const selected = available.find(slot => slot.id === slotId && slot.date === date);
  const bookingNote = [city.trim() ? `City: ${city.trim()}` : '', note.trim()].filter(Boolean).join('\n');
  const noteLimit = 500 - (city.trim() ? `City: ${city.trim()}\n`.length : 0);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!currentUser) { onLoginNeeded(); return; }
    if (!selected || mutating.current || !session.current() || bookingNote.length > 500) return;
    const text = bookingNote;
    const payload = { postId: post.id, slotId: selected.id, note: text }, key = session.key(payload), controller = session.controller();
    mutating.current = true; setBusy(true); setError('');
    try { const response = await serviceBookings.book(post.id, selected.id, text, key, controller.signal); if (!session.current()) return; if (response.booking.customerId !== currentUser.id || response.booking.providerId !== post.authorId) throw new Error('Unexpected booking participants'); setReceipt(response); session.clearKey(payload); setSlotId(''); const status = bookingDisplayStatus(response.booking); showToast(status === 'pending' ? t('申请已提交，等待服务者确认。', 'Request submitted; waiting for the provider.') : status === 'confirmed' ? t('预约已确认。', 'Booking confirmed.') : t('已找到这次申请的记录，请查看当前状态。', 'The existing request was found. Check its current status.'), status === 'confirmed' ? 'success' : 'info'); void load(); }
    catch (reason) { if (session.current()) setError(bookingError(reason, t)); }
    finally { session.release(controller); if (session.current()) { mutating.current = false; setBusy(false); } }
  };
  if (!loading && data && !data.eligible && !owner) return null;
  return <section className="service-booking-panel booking-surface" translate="no" aria-label={t('服务预约', 'Service bookings')} aria-busy={busy}>
    <header className="booking-heading"><span className="booking-icon"><CalendarDays size={23} aria-hidden="true" /></span><div><span className="booking-eyebrow">BAYLINK · BOOK A TIME</span><h3>{owner ? t('让合适的时间，接住新预约', 'Make time for your next booking') : t('找个合适的时间', 'Find a time that works')}</h3></div><button type="button" className="booking-icon-button" aria-label={t('刷新预约时段', 'Refresh booking times')} disabled={busy || loading} onClick={() => void load()}><RefreshCw size={17} aria-hidden="true" /></button></header>
    {loading && <p role="status">{t('正在读取最新时段…', 'Loading the latest times…')}</p>}{error && <BookingError message={error} onRetry={() => void load()} retryLabel={t('重新读取时段', 'Reload available times')} disabled={busy || loading} />}
    {data && !data.eligible && <div className="booking-empty"><p>{!data.providerVerified ? t('请先完成手机号验证或平台资料核验，再回来设置服务预约。', 'Verify your phone number or complete the platform profile review, then return to set up bookings.') : t('这个帖子暂不符合服务预约条件，请检查服务分类、账号与帖子状态。', 'This listing is not eligible for bookings. Check its service category, account and listing status.')}</p>{!data.providerVerified && <Link className="booking-secondary" to="/me">{t('前往个人主页验证', 'Go to profile to verify')}</Link>}</div>}
    {data?.eligible && owner && <ProviderAvailability data={data} busy={busy || loading} t={t} onSettings={settings => update(signal => serviceBookings.settings(post.id, settings, signal))} onAdd={slots => { const payload = { postId: post.id, slots }; return update(signal => serviceBookings.addSlots(post.id, slots, session.key(payload), signal), payload); }} onRemove={id => void update(signal => serviceBookings.removeSlot(post.id, id, signal), undefined, 'remove')} />}
    {data?.eligible && !owner && <>
      {receipt && <BookingReceipt {...receipt} t={t} now={now} />}
      {slotId && !selected && <p className="booking-selection-changed" role="status">{t('刚才选择的时段已不可约，请重新选择。你填写的需求仍然保留。', 'The selected time is no longer available. Choose again; your needs have been kept.')}</p>}
      {!receipt && (!data.enabled ? <p className="booking-empty">{t('服务者暂未开放预约，可先通过站内消息沟通。', 'The provider is not accepting bookings yet. You can ask in messages.')}</p> : !available.length ? <p className="booking-empty">{t('暂时没有可约时段。可以稍后刷新，或向服务者询问其他时间。', 'No times are available right now. Refresh later or ask the provider about another time.')}</p> : <form onSubmit={submit}>
        <p className="booking-timezone"><Clock3 size={15} aria-hidden="true" />{t('湾区时间 · America/Los_Angeles', 'Bay Area time · America/Los_Angeles')}</p>
        <fieldset disabled={busy || loading} className="booking-fieldset"><legend>{t('1 · 选择日期和时间', '1 · Choose a date and time')}</legend><label>{t('可约日期', 'Available date')}<select value={date} onChange={event => { setDate(event.target.value); setSlotId(''); }}><option value="">{t('请选择日期', 'Choose a date')}</option>{dates.map(day => <option key={day} value={day}>{day}</option>)}</select></label>
          {date && <div className="booking-times" role="group" aria-label={t('可约时段', 'Available times')}>{available.filter(slot => slot.date === date).map(slot => <button type="button" key={slot.id} aria-pressed={slotId === slot.id} onClick={() => setSlotId(slot.id)}>{slot.startTime}–{slot.endTime}</button>)}</div>}
        </fieldset>
        <fieldset disabled={busy || loading || !currentUser} className="booking-fieldset"><legend>{t('2 · 告诉对方你的需要', '2 · Tell the provider what you need')}</legend>{!currentUser && <p className="booking-footnote">{t('先登录，再补充需求并提交预约。', 'Sign in before adding your needs and submitting a booking.')}</p>}<label>{t('服务城市（选填）', 'Service city (optional)')}<input value={city} maxLength={80} autoComplete="address-level2" onChange={event => setCity(event.target.value)} /></label><label>{t('需求备注（选填）', 'What do you need? (optional)')}<textarea value={note} maxLength={noteLimit} rows={3} placeholder={noteHint} onChange={event => setNote(event.target.value)} /></label><p className="booking-footnote">{noteHint}</p><p className={bookingNote.length > 500 ? 'booking-alert' : 'booking-footnote'} role={bookingNote.length > 500 ? 'alert' : undefined}>{t('城市与备注合计', 'City and note combined')} {bookingNote.length}/500</p></fieldset>
        {selected && <div className="booking-selection-summary"><span>{t('本次选择', 'Your selected time')}</span><strong>{selected.date} · {selected.startTime}–{selected.endTime}</strong><p>{t('这次预约覆盖完整起止时间，不是在这个窗口内任选到达时间。', 'This booking covers the full time block, not any arrival time within that window.')}</p></div>}
        <p className="booking-confirmation-rule">{data.mode === 'request' ? t('提交的是预约申请，服务者确认后才算预约成功。', 'This is a booking request. It is confirmed only after the provider accepts.') : t('提交后立即确认这个完整时段，请先核对日期和时间。', 'Submitting immediately confirms the full time block. Check the date and time first.')}</p>
        <button className="booking-primary" type="submit" disabled={busy || loading || (!!currentUser && (!selected || bookingNote.length > 500))}>{busy ? t('正在提交…', 'Submitting…') : !currentUser ? t('登录后预约', 'Sign in to book') : data.mode === 'request' ? t('提交预约申请', 'Request this time') : t('确认预约这个时段', 'Confirm this booking')}</button>
      </form>)}
      {receipt && <button type="button" className="booking-text" onClick={() => { setReceipt(null); setDate(''); }}>{t('继续查看其他时段', 'See other times')}</button>}
      {onRequestTime && <button type="button" className="booking-secondary booking-negotiate" onClick={onRequestTime}>{t('商量其他时间', 'Ask about another time')}</button>}
    </>}
    <BookingNotice t={t} />{owner && <Link className="booking-text" to="/me/bookings?view=received">{t('管理收到的预约与通知', 'Manage received bookings and notifications')}</Link>}
  </section>;
}
export function ServiceBookingPanel(props: ServiceBookingPanelProps) { return <BookingPanelSession key={`${props.post.id}:${bookingSessionKey(props.currentUser)}`} {...props} />; }
