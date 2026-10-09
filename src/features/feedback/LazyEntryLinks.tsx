import { lazy, Suspense, type ComponentProps, type ReactElement } from 'react';
import type { FeedbackLink, ReportErrorLink } from './ReportErrorLink';

type ReportProps = ComponentProps<typeof ReportErrorLink>;
type LinkProps = ComponentProps<typeof FeedbackLink>;
// A load failure (offline, a stranded deploy) renders nothing instead of reaching the page's error boundary.
const nothing = () => null;
const entries = () => import('./ReportErrorLink');
const Report = lazy(() => entries().then(module => ({ default: module.ReportErrorLink as (props: ReportProps) => ReactElement | null }), () => ({ default: nothing })));
const Link = lazy(() => entries().then(module => ({ default: module.FeedbackLink as (props: LinkProps) => ReactElement | null }), () => ({ default: nothing })));

/**
 * The entry links for pages inside a budgeted route graph (event, offer, opening and guide details, and the 404 page
 * those render for a missing id): they sit at the end of the page, so they load after it renders and keep the link,
 * its copy and its stylesheet out of the page's JS budget. Same props as ReportErrorLink / FeedbackLink.
 */
export function LazyReportErrorLink(props: ReportProps) {
  return <Suspense fallback={null}><Report {...props} /></Suspense>;
}
export function LazyFeedbackLink(props: LinkProps) {
  return <Suspense fallback={null}><Link {...props} /></Suspense>;
}
