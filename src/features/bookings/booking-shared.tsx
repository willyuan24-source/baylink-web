import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { bookingDisplayStatus, type BookingNotifications, type ServiceBooking } from '../../lib/service-bookings';
import type { BookingTranslate } from './booking-copy';
export function BookingError({ message, onRetry, retryLabel, disabled }: { message: string; onRetry?: () => void; retryLabel?: string; disabled?: boolean }) {
  return <div className="booking-alert" role="alert"><AlertCircle size={17} aria-hidden="true" /><div><p>{message}</p>{onRetry && <button type="button" className="booking-text" onClick={onRetry} disabled={disabled}>{retryLabel}</button>}</div></div>;
}
export function BookingNotice({ t }: { t: BookingTranslate }) {
  return <p className="booking-footnote">{t('这里不收取线上付款。价格、地点和服务范围请双方通过站内消息确认。', 'No online payments are collected here. Agree on price, location and service details in messages.')}</p>;
}
export function BookingStatusLabel({ booking, t, now }: { booking: ServiceBooking; t: BookingTranslate; now: number }) {
  const status = bookingDisplayStatus(booking, now);
  const labels = { pending: t('待服务者确认', 'Awaiting provider'), confirmed: t('预约已确认', 'Confirmed'), declined: t('未获接受', 'Declined'), cancelled: t('已取消', 'Cancelled'), expired: t('申请已到期', 'Request expired'), completed: t('已完成', 'Completed') };
  return <span className={`booking-status booking-status-${status}`}>{labels[status]}</span>;
}
export function BookingNotificationNotice({ notifications, conversationId, t }: { notifications: BookingNotifications; conversationId?: string; t: BookingTranslate }) {
  const inApp = notifications.inApp === 'sent' ? t('站内通知已写入消息。', 'An in-app message was saved.')
    : notifications.inApp === 'failed' ? t('预约状态已保存，但站内通知未发送成功。无需重复预约，可以进入消息联系对方。', 'Your booking status is saved, but the in-app notification failed. Do not book again; contact the other person in messages.')
    : notifications.inApp === 'pending' ? t('预约状态已保存，站内通知仍在处理中。无需重复提交。', 'Your booking status is saved. The in-app notification is still processing; do not submit again.')
    : t('本次没有发送新的站内通知，请以预约状态为准。', 'No new in-app notification was sent this time. Refer to the booking status.');
  const sms = notifications.sms === 'sent' ? t('短信已提交给短信服务商，尚不代表手机已收到。', 'The SMS provider accepted the message; delivery to the phone is not confirmed.')
    : notifications.sms === 'failed' ? t('短信未发送成功，预约状态仍已保存。可使用站内消息沟通。', 'SMS could not be sent. Your booking status is still saved; use in-app messages to communicate.')
    : notifications.sms === 'unconfigured' ? t('短信提醒当前不可用，请查看站内预约状态。', 'SMS alerts are currently unavailable. Check your booking status here.')
    : ['unknown', 'pending'].includes(notifications.sms) ? t('短信发送结果尚未确认，请勿依赖短信判断预约是否成功。', 'SMS delivery is not confirmed. Use the booking status to check your appointment.') : '';
  const needsHelp = notifications.inApp === 'failed' || ['failed', 'unknown'].includes(notifications.sms);
  return <div className={`booking-footnote booking-notification${needsHelp ? ' booking-notification-warning' : ''}`} role="status"><p>{inApp} {sms}</p>{needsHelp && <Link className="booking-text" to={conversationId ? `/messages/${encodeURIComponent(conversationId)}` : '/messages'}>{t('进入站内消息', 'Open messages')}</Link>}</div>;
}
export function BookingReceipt({ booking, notifications, t, now }: { booking: ServiceBooking; notifications: BookingNotifications; t: BookingTranslate; now: number }) {
  const status = bookingDisplayStatus(booking, now);
  const descriptions = {
    pending: t('申请已提交，等对方确认后才算预约成功。', 'Request submitted. Your appointment is only booked when the provider confirms it.'),
    confirmed: t('时段已确认，请与服务者确认具体安排。', 'Your time is confirmed. Agree on the details with the provider.'),
    cancelled: t('这笔预约已取消，当前没有为你保留这个时段。', 'This booking was cancelled. This time is not currently held for you.'),
    declined: t('这次申请未获接受，可以和服务者商量其他时间。', 'This request was declined. Ask the provider about another time.'),
    expired: t('这次申请已到期，需要重新选择可约时段。', 'This request expired. Choose an available time again.'),
    completed: t('这笔预约已标记完成，以下为历史记录。', 'This booking is marked complete. This is its saved record.'),
  };
  return <div className="booking-receipt" role="status"><CheckCircle2 size={22} aria-hidden="true" /><div><BookingStatusLabel booking={booking} t={t} now={now} /><p>{descriptions[status]}</p><p translate="no">{booking.date} · {booking.startTime}–{booking.endTime}</p><Link to="/me/bookings">{t('查看我的预约', 'View my bookings')}</Link></div><BookingNotificationNotice notifications={notifications} conversationId={booking.conversationId} t={t} /></div>;
}
