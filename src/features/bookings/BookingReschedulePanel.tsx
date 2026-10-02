import { useEffect, useState } from 'react';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { serviceBookings, type BookingRescheduleAction, type ServiceBooking, type ServiceSlot } from '../../lib/service-bookings';
import type { UserData } from '../../lib/types';
import { useBookingCopy } from './booking-copy';
import { bookingError, useBookingSession } from './booking-session';

type Props = { booking: ServiceBooking; user: UserData; now: number; disabled: boolean; onAction: (action: BookingRescheduleAction) => void };
export function BookingReschedulePanel({ booking, user, now, disabled, onAction }: Props) {
  const { t } = useBookingCopy(), session = useBookingSession(user);
  const [open, setOpen] = useState(false), [slots, setSlots] = useState<ServiceSlot[]>([]), [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open || !session.current()) return;
    const controller = session.controller(); let active = true;
    setLoading(true); setError(''); setSlots([]); setSelected('');
    void serviceBookings.rescheduleOptions(booking, controller.signal).then(rows => {
      if (active && session.current() && !controller.signal.aborted) setSlots(rows.filter(slot => slot.available));
    }).catch(reason => { if (active && session.current() && !controller.signal.aborted) setError(bookingError(reason, t, 'read')); })
      .finally(() => { session.release(controller); if (active && session.current()) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [open, attempt, booking, session, t]);
  const proposal = booking.reschedule;
  const pending = proposal?.status === 'pending' && proposal.expiresAt > now;
  if (booking.status !== 'confirmed' || booking.startAt <= now) return null;
  return <section className="booking-reschedule" aria-label={t('协商改期', 'Reschedule together')}>
    {pending ? <>
      <h3><CalendarClock size={17} aria-hidden="true" />{proposal.proposedBy === user.id ? t('已提出改期，等对方回应', 'Reschedule proposed · awaiting reply') : t('对方提出改期，等你回应', 'Reschedule proposed · your reply needed')}</h3>
      <div className="booking-reschedule-comparison"><div><span>{t('当前已确认', 'Currently confirmed')}</span><strong>{booking.date}</strong><time>{booking.startTime}–{booking.endTime}</time></div><ArrowRight size={18} aria-hidden="true" /><div><span>{t('提议改为', 'Proposed time')}</span><strong>{proposal.date}</strong><time>{proposal.startTime}–{proposal.endTime}</time></div></div>
      <p>{t('双方同意且新时段仍可约后才会改期。在此之前保留原预约，新时段暂不占用。', 'Your original booking stays confirmed until both agree and the new time is still available. The proposed time is not held.')}</p>
      <p>{t('请在', 'Reply by')} {new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(proposal.expiresAt)} {t('前回应（湾区时间）。', '(Bay Area time).')}</p>
      <div className="booking-record-actions">{proposal.proposedBy === user.id ? <button type="button" className="booking-secondary" disabled={disabled} onClick={() => onAction({ action: 'withdraw', proposalId: proposal.id })}>{t('撤回改期提议', 'Withdraw proposal')}</button> : <>
        <button type="button" className="booking-primary" disabled={disabled} onClick={() => onAction({ action: 'accept', proposalId: proposal.id })}>{t('同意改到这个时间', 'Accept this new time')}</button>
        <button type="button" className="booking-secondary" disabled={disabled} onClick={() => onAction({ action: 'decline', proposalId: proposal.id })}>{t('婉拒，保留原预约', 'Decline · keep original')}</button>
      </>}</div>
    </> : <>
      {proposal && ['declined', 'withdrawn', 'expired'].includes(proposal.status === 'pending' ? 'expired' : proposal.status) && <p>{t('上次改期未生效，仍按上方的已确认时间安排。', 'The last proposal did not take effect. Your confirmed time above still applies.')}</p>}
      <button type="button" className="booking-secondary" disabled={disabled} aria-expanded={open} onClick={() => setOpen(value => !value)}><CalendarClock size={16} aria-hidden="true" />{open ? t('收起改期选项', 'Close reschedule options') : t('协商改期', 'Propose a new time')}</button>
      {open && <div className="booking-reschedule-form">
        <p>{t('从这项服务已发布的时段中选择，再由对方明确同意。提交提议不会取消原预约。', 'Choose a published time for the other person to approve. Sending a proposal does not cancel your original booking.')}</p>
        {loading && <p role="status">{t('正在核对可改约时间…', 'Checking available times…')}</p>}
        {error && <div role="alert"><p>{error}</p><button type="button" className="booking-text" disabled={disabled || loading} onClick={() => setAttempt(value => value + 1)}>{t('重新读取时段', 'Reload times')}</button></div>}
        {!loading && !error && !slots.length && <p>{t('暂时没有其他可约时段。可以通过站内消息协商，请服务者先发布新时段，再回来提议。', 'No other times are available. Discuss a time in messages and ask the provider to publish it first.')}</p>}
        {!loading && !error && slots.length > 0 && <>
          <label>{t('提议的新时间', 'Proposed new time')}<select value={selected} disabled={disabled} onChange={event => setSelected(event.target.value)}><option value="">{t('请选择日期与时间', 'Choose a date and time')}</option>{slots.map(slot => <option key={slot.id} value={slot.id}>{slot.date} · {slot.startTime}–{slot.endTime}</option>)}</select></label>
          <button type="button" className="booking-primary" disabled={disabled || !selected} onClick={() => onAction({ action: 'propose', slotId: selected })}>{t('发送改期提议', 'Send reschedule proposal')}</button>
        </>}
      </div>}
    </>}
  </section>;
}
