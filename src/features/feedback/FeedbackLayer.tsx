import { MessageSquareText } from 'lucide-react';
import { useLocale } from '../../i18n/locale';
import FeedbackSheet from './FeedbackSheet';
import TesterConsentSheet from './TesterConsentSheet';
import { say } from './feedback-copy';
import { openFeedback, type FeedbackRequest } from './open-feedback';
import type { TesterRecord } from './tester-mode';

export type FeedbackLayerState = { feedback: (FeedbackRequest & { routeTemplate: string }) | null; opened: number; consent: string | null; tester: TesterRecord | null };
export type FeedbackLayerActions = { closeFeedback: () => void; agree: (code: string) => void; decline: () => void; leaveTester: () => void };

/** Tester mode only: the 反馈 button on every page (feedback.css places it above the phone tab bar). */
function TesterButton() {
  const locale = useLocale();
  return <button type="button" className="feedback-tester-button" onClick={() => void openFeedback({ kind: 'page' })}>
    <MessageSquareText size={20} aria-hidden="true" /><span>{say({ zh: '反馈', en: 'Feedback' }, locale)}</span>
  </button>;
}

export function FeedbackLayer({ feedback, opened, consent, tester, actions }: FeedbackLayerState & { actions: FeedbackLayerActions }) {
  return <>
    {tester && <TesterButton />}
    {consent && <TesterConsentSheet code={consent} onAgree={() => actions.agree(consent)} onDecline={actions.decline} />}
    {feedback && <FeedbackSheet key={opened} request={feedback} tester={tester} onClose={actions.closeFeedback} onLeaveTester={actions.leaveTester} />}
  </>;
}
