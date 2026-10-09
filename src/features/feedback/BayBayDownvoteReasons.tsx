import { useState } from 'react';
import { useLocale } from '../../i18n/locale';
import { recordProductEvent } from '../../lib/product-events';
import { currentRouteTemplate } from '../../lib/route-template';
import { buildFeedbackPayload, submitFeedback } from './feedback-api';
import { REASON_LABELS, say } from './feedback-copy';
import { openFeedback } from './open-feedback';
import { useFeedbackEntryStyles } from './entry-styles';

const QUICK = ['wrong-answer', 'too-slow', 'not-answered'] as const;

/**
 * BayBay 👎 reasons (G9): one tap sends the reason as a 'baybay' feedback row with the page template only; the question,
 * answer and conversation are never attached. 其他 opens the sheet so the reader can say what went wrong.
 */
export function BayBayDownvoteReasons({ send = submitFeedback }: { send?: typeof submitFeedback }) {
  const locale = useLocale();
  useFeedbackEntryStyles();
  const [state, setState] = useState<'choosing' | 'sending' | 'sent' | 'failed'>('choosing');
  const quick = async (reason: string) => {
    setState('sending');
    const routeTemplate = currentRouteTemplate();
    const result = await send(buildFeedbackPayload({ kind: 'baybay', routeTemplate, reason }));
    if (result.ok) recordProductEvent('feedback_sent', { route: routeTemplate });
    setState(result.ok ? 'sent' : 'failed');
  };
  if (state === 'sent') return <p className="baybay-downvote-done" role="status">{say({ zh: '已记下原因，谢谢！', en: 'Noted, thank you.' }, locale)}</p>;
  return <div className="baybay-downvote" role="group" aria-label={say({ zh: '哪里没答好？', en: 'What went wrong?' }, locale)}>
    <span>{say({ zh: '哪里没答好？', en: 'What went wrong?' }, locale)}</span>
    {QUICK.map(reason => <button key={reason} type="button" disabled={state === 'sending'} onClick={() => void quick(reason)}>{say(REASON_LABELS[reason], locale)}</button>)}
    <button type="button" disabled={state === 'sending'} onClick={() => void openFeedback({ kind: 'baybay', reason: 'other' })}>{say(REASON_LABELS.other, locale)}</button>
    {state === 'failed' && <p className="baybay-downvote-failed" role="alert">{say({ zh: '没发出去，请稍后再点一次。', en: 'That did not go through. Please try again shortly.' }, locale)}</p>}
  </div>;
}
