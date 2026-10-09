import { Link } from 'react-router-dom';
import { CalendarCheck, Info, Users } from 'lucide-react';
import { useUiCopy } from '../../components/ui/ui-copy';
import { noticeEnglish, noticeKindLabel, parseSystemNotice } from './system-notice';
import './messages-hub.css';

/**
 * A booking or group update inside a conversation (E2E-14): a card with the kind, the status, the item and its time,
 * and one in-app link. The server text's URL and record id never reach the reader.
 */
export function SystemNoticeCard({ content, messageId, createdAt, dateLocale, onNavigate }: {
  content: string; messageId: string; createdAt: number; dateLocale: string; onNavigate?: () => void;
}) {
  const { t, english } = useUiCopy();
  const notice = parseSystemNotice(content, messageId);
  const Icon = notice.kind === 'booking' ? CalendarCheck : notice.kind === 'outing' ? Users : Info;
  const date = new Date(createdAt);
  const line = (text: string) => english ? noticeEnglish(text) : text;
  const linkLabel = notice.kind === 'booking' ? t('查看预约', 'View booking') : notice.kind === 'outing' ? t('查看小队', 'View group') : t('查看详情', 'View details');
  return <article className="msg-notice" data-message-id={messageId} data-kind={notice.kind} aria-label={t('系统通知', 'System notification')}>
    <header className="msg-notice__head">
      <span className="msg-notice__icon" aria-hidden="true"><Icon strokeWidth={1.75} /></span>
      <span className="msg-notice__kind">{noticeKindLabel(notice.kind, english)}</span>
      <time dateTime={date.toISOString()}>{new Intl.DateTimeFormat(dateLocale, { hour: 'numeric', minute: '2-digit' }).format(date)}</time>
    </header>
    {notice.status && <p className="msg-notice__status" translate="no">{line(notice.status)}</p>}
    {notice.lines.map((text, index) => <p key={index} className="msg-notice__line" translate="no">{line(text)}</p>)}
    {notice.to && <Link className="msg-notice__link" to={notice.to} onClick={onNavigate}>{linkLabel}</Link>}
  </article>;
}
