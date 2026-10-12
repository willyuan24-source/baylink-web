import { FEEDBACK_EMAIL } from '../features/feedback/contact';

/**
 * 反馈 from the site chrome (global footer, 更多): WEB-FEEDBACK's sheet, loaded on first use so the shell carries none of
 * it. If the sheet cannot load (offline, a stale deploy), the reader's mail app opens instead.
 */
export function openSiteFeedback(): void {
  void import('../features/feedback/open-feedback')
    .then(feedback => feedback.openFeedback({ kind: 'page' }), () => false)
    .then(opened => { if (!opened) window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('BAYLINK feedback')}`; });
}
