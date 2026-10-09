import { Flag, MessageSquareText } from 'lucide-react';
import { useLocale } from '../../i18n/locale';
import { say } from './feedback-copy';
import { FEEDBACK_EMAIL, openFeedback, type FeedbackEntity } from './open-feedback';
import './feedback-entry.css';

const mailFallback = (subject: string) => { window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}`; };

/**
 * "这条信息有误？" for an event, offer, opening or guide page: opens the feedback sheet with the item's kind and id.
 * Mounted after the detail component today (LocalDiscoveryPage, GuideDetailPage); the W2 template lanes (WEB-DETAIL,
 * WEB-GUIDES) move it into the trust row by rendering <ReportErrorLink entity title /> there.
 */
export function ReportErrorLink({ entity, title, className = '' }: { entity: FeedbackEntity; title?: string; className?: string }) {
  const locale = useLocale();
  return <p className={`feedback-report-row ${className}`.trim()}>
    <button type="button" className="feedback-report-link" onClick={() => void openFeedback({ kind: 'content', entity, title }).then(opened => { if (!opened) mailFallback(`BAYLINK ${entity.kind} ${entity.id}`); })}>
      <Flag size={18} aria-hidden="true" />
      <span>{say({ zh: '这条信息有误？告诉我们', en: 'Something wrong here? Tell us' }, locale)}</span>
    </button>
  </p>;
}

/** The site-wide 反馈与报错 entry for footers and help pages (WEB-SHELL2 mounts it in the global footer). */
export function FeedbackLink({ className = '' }: { className?: string }) {
  const locale = useLocale();
  return <button type="button" className={`feedback-footer-link ${className}`.trim()} onClick={() => void openFeedback({ kind: 'page' }).then(opened => { if (!opened) mailFallback('BAYLINK feedback'); })}>
    <MessageSquareText size={18} aria-hidden="true" />
    <span>{say({ zh: '反馈与报错', en: 'Feedback and error reports' }, locale)}</span>
  </button>;
}
