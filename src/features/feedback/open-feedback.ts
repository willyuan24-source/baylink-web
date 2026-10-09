import { recordProductEvent } from '../../lib/product-events';
import { currentRouteTemplate } from '../../lib/route-template';

/** What a report is about. Ids are catalog ids; the API accepts these kinds (lib/feedback.js). */
export type FeedbackEntity = { kind: 'event' | 'offer' | 'opening' | 'guide' | 'place' | 'post'; id: string };
export type FeedbackKind = 'page' | 'content' | 'baybay';
export type FeedbackRequest = {
  kind: FeedbackKind;
  /** content: the item the reader is looking at */
  entity?: FeedbackEntity;
  /** content: the item's displayed title, shown in the sheet only (never sent) */
  title?: string;
  /** a reason chip to preselect, e.g. the BayBay 👎 reason already tapped */
  reason?: string;
  /** the page the sheet was opened from; defaults to the current page */
  routeTemplate?: string;
};

/**
 * Open the feedback sheet from anywhere: footer links, "这条信息有误？", BayBay 👎, the error page, the tester button.
 * The sheet and its styles load on first use (home budget), into their own root so it works outside the router and on
 * the error page. Resolves false when the sheet could not load (offline, stale deploy); callers may then offer email.
 */
export function openFeedback(request: FeedbackRequest): Promise<boolean> {
  const routeTemplate = request.routeTemplate ?? currentRouteTemplate();
  recordProductEvent('feedback_open', { route: routeTemplate });
  return import('./feedback-host')
    .then(host => { host.showFeedback({ ...request, routeTemplate }); return true; })
    .catch(() => false);
}

export const FEEDBACK_EMAIL = 'Baylink.us@gmail.com';
