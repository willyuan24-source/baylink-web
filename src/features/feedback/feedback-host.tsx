import { createRoot, type Root } from 'react-dom/client';
import { FeedbackLayer, type FeedbackLayerActions, type FeedbackLayerState } from './FeedbackLayer';
import type { FeedbackRequest } from './open-feedback';
import { activeTester, endTesterMode, startTesterMode } from './tester-mode';

/**
 * The feedback layer lives in its own React root at the end of <body>, loaded on first use. It works on every page,
 * outside the router and on the error page, and touches no shared layout file (AppLayout and main.tsx belong to the
 * shell lanes).
 */
let state: FeedbackLayerState = { feedback: null, opened: 0, consent: null, tester: null };
let root: Root | null = null;

const actions: FeedbackLayerActions = {
  closeFeedback: () => update({ feedback: null }),
  agree: code => update({ consent: null, tester: startTesterMode(code) }),
  decline: () => update({ consent: null }),
  leaveTester: () => { endTesterMode(); update({ tester: null }); },
};

function update(next: Partial<FeedbackLayerState>) {
  state = { ...state, ...next };
  if (!root) {
    const host = document.createElement('div');
    host.id = 'baylink-feedback-root';
    document.body.append(host);
    root = createRoot(host);
  }
  root.render(<FeedbackLayer {...state} actions={actions} />);
}

export function showFeedback(request: FeedbackRequest & { routeTemplate: string }) {
  update({ feedback: request, opened: state.opened + 1, tester: activeTester() });
}
export function showTesterConsent(code: string) { update({ consent: code, tester: activeTester() }); }
export function showTesterButton() { update({ tester: activeTester() }); }
