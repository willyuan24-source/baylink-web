import { useId, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { ModalShell } from '../../components/ui/Modal';
import { translateText, useLocale } from '../../i18n/locale';
import { recordProductEvent } from '../../lib/product-events';
import { buildFeedbackPayload, FEEDBACK_CONTACT_MAX, FEEDBACK_REASONS, FEEDBACK_TEXT_MAX, isFeedbackReason, submitFeedback, type FeedbackFailure } from './feedback-api';
import { COMMON_COPY, FAILURE_COPY, REASON_LABELS, SHEET_COPY, say } from './feedback-copy';
import type { FeedbackRequest } from './open-feedback';
import { FEEDBACK_EMAIL } from './open-feedback';
import type { TesterRecord } from './tester-mode';
import './feedback.css';

type Props = {
  request: FeedbackRequest & { routeTemplate: string };
  tester?: TesterRecord | null;
  onClose: () => void;
  onLeaveTester?: () => void;
  /** test seam */
  send?: typeof submitFeedback;
};

/**
 * The one feedback form (G9): a reason chip, optional text (≤500) and contact (≤80). It sends the §3.0 Feedback body and
 * nothing else; the page's address, the BayBay conversation and the account are never attached.
 */
export default function FeedbackSheet({ request, tester, onClose, onLeaveTester, send = submitFeedback }: Props) {
  const locale = useLocale();
  const t = (copy: { zh: string; en: string }) => say(copy, locale);
  const kind = request.kind;
  const copy = SHEET_COPY[kind];
  const id = useId();
  const [reason, setReason] = useState<string>(isFeedbackReason(kind, request.reason) ? request.reason : '');
  const [text, setText] = useState('');
  // A tester's code goes where they can see, edit or clear it: the reply field. It is not sent anywhere else.
  const testerContact = tester ? `${t(COMMON_COPY.testerContact)}${tester.id}` : '';
  const [contact, setContact] = useState(testerContact);
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<'editing' | 'sending' | 'sent'>('editing');
  const [failure, setFailure] = useState<FeedbackFailure | null>(null);
  const [missingReason, setMissingReason] = useState(false);
  const [leftTester, setLeftTester] = useState(false);
  const firstChip = useRef<HTMLInputElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const submit = async () => {
    if (state === 'sending') return;
    if (!isFeedbackReason(kind, reason)) { setMissingReason(true); firstChip.current?.focus(); return; }
    setState('sending'); setFailure(null);
    const result = await send(buildFeedbackPayload({ kind, routeTemplate: request.routeTemplate, reason, text, contact, entity: request.entity, website }));
    if (result.ok) {
      recordProductEvent('feedback_sent', { route: request.routeTemplate });
      setState('sent');
      requestAnimationFrame(() => closeButton.current?.focus());
    } else {
      setFailure(result.failure);
      setState('editing');
    }
  };
  const textLength = [...text].length;
  const leaveTester = () => { onLeaveTester?.(); setLeftTester(true); if (testerContact && contact === testerContact) setContact(''); };

  return <ModalShell onClose={onClose} className="feedback-overlay" labelledBy={`${id}title`}>
    <div className="feedback-sheet" data-kind={kind}>
      <header className="feedback-sheet-header">
        <h2 id={`${id}title`}>{state === 'sent' ? t(COMMON_COPY.thanksTitle) : t(copy.title)}</h2>
        <button type="button" className="feedback-sheet-close" aria-label={t(COMMON_COPY.closeSheet)} onClick={onClose}><X size={22} aria-hidden="true" /></button>
      </header>
      {state === 'sent' ? <div className="feedback-sheet-done" role="status">
        <Check size={28} aria-hidden="true" />
        <p>{t(COMMON_COPY.thanksBody)}</p>
        <button ref={closeButton} type="button" className="feedback-primary" onClick={onClose}>{t(COMMON_COPY.close)}</button>
      </div> : <form className="feedback-sheet-form" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
        <p className="feedback-sheet-lede">{t(copy.lede)}</p>
        {kind === 'content' && request.title && <p className="feedback-sheet-subject">{t(COMMON_COPY.about)}<span translate="no">{translateText(request.title, locale)}</span></p>}
        <fieldset className="feedback-reasons" aria-describedby={missingReason ? `${id}reason-error` : undefined} aria-invalid={missingReason || undefined}>
          <legend>{t(copy.legend)}</legend>
          <div className="feedback-chip-row">{FEEDBACK_REASONS[kind].map((code, index) => <label key={code} className={`feedback-chip${reason === code ? ' is-selected' : ''}`}>
            <input ref={index === 0 ? firstChip : undefined} type="radio" name={`${id}reason`} value={code} checked={reason === code} onChange={() => { setReason(code); setMissingReason(false); }} />
            <span>{t(REASON_LABELS[code])}</span>
          </label>)}</div>
          {missingReason && <p id={`${id}reason-error`} className="feedback-field-error" role="alert">{t(COMMON_COPY.chooseOne)}</p>}
        </fieldset>
        <div className="feedback-field">
          <label htmlFor={`${id}text`}>{t(copy.textLabel)}</label>
          <textarea id={`${id}text`} rows={4} maxLength={FEEDBACK_TEXT_MAX} value={text} onChange={event => setText(event.target.value)} aria-describedby={`${id}text-hint ${id}text-count`} />
          <div className="feedback-field-meta"><span id={`${id}text-hint`}>{t(copy.textHint)}</span><span id={`${id}text-count`} aria-live="polite">{textLength}/{FEEDBACK_TEXT_MAX}</span></div>
        </div>
        <div className="feedback-field">
          <label htmlFor={`${id}contact`}>{t(COMMON_COPY.contactLabel)}</label>
          <input id={`${id}contact`} type="text" autoComplete="email" maxLength={FEEDBACK_CONTACT_MAX} value={contact} onChange={event => setContact(event.target.value)} aria-describedby={`${id}contact-hint`} />
          <span id={`${id}contact-hint`} className="feedback-field-meta">{t(COMMON_COPY.contactHint)}</span>
        </div>
        {/* Honeypot (API contract): hidden from people and assistive technology, so only a form-filling bot types here. */}
        <div className="feedback-honeypot" aria-hidden="true"><label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></label></div>
        <p className="feedback-attached">{t(COMMON_COPY.attached)} <a href="/privacy" target="_blank" rel="noopener">{t(COMMON_COPY.privacy)}</a></p>
        {failure && <p className="feedback-failure" role="alert">{t(FAILURE_COPY[failure])}{(failure === 'daily' || failure === 'global') && <> <a href={`mailto:${FEEDBACK_EMAIL}`} translate="no">{FEEDBACK_EMAIL}</a></>}</p>}
        <div className="feedback-actions">
          <button type="submit" className="feedback-primary" disabled={state === 'sending'} aria-busy={state === 'sending'}>{state === 'sending' ? t(COMMON_COPY.sending) : t(COMMON_COPY.send)}</button>
          <button type="button" className="feedback-secondary" onClick={onClose}>{t(COMMON_COPY.cancel)}</button>
        </div>
        {tester && !leftTester && <p className="feedback-tester">{t(COMMON_COPY.testerNote)} · <button type="button" onClick={leaveTester}>{t(COMMON_COPY.testerLeave)}</button></p>}
        {leftTester && <p className="feedback-tester" role="status">{t(COMMON_COPY.testerLeft)}</p>}
      </form>}
    </div>
  </ModalShell>;
}
