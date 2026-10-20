import { Component, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { recordDetailOpen } from '../lib/product-events';
import { setPageMetadata } from '../lib/seo';
import { LocalDiscoveryDetail } from '../components/LocalDiscoveryDetail';
import { ErrorState } from '../components/ui';
import { MoreLink } from '../components/ui/TextLink';
import { useUiCopy } from '../components/ui/ui-copy';
import { endSkeletonHold, preloadDetailRecord, readDetailRecord, retryDetailRecord, skeletonDelay, skeletonHold, type DetailKind } from '../features/detail/load-detail';
import { DETAIL_BACK, type DetailRecord } from '../features/detail/detail-record';
import { DetailBack, DetailSkeleton } from '../features/detail/DetailSkeleton';
import { routePathname } from '../app/route-table';
import { isChunkLoadFailure } from '../lib/chunk-recovery';
import NotFoundPage from './NotFoundPage';

const KINDS = { events: 'event', offers: 'offer', openings: 'opening' } as const;
/** The detail this page boots on: its prerendered HTML stays on screen while the record loads (no skeleton over it). */
let bootKey: string | null = null;
// The record of the URL this page boots on starts loading with the page's own code, before React renders (ENGSEC-01).
if (typeof window !== 'undefined') {
  const boot = /^\/(events|offers|openings)\/([^/]+)$/.exec(routePathname(window.location.pathname));
  if (boot) { try { const kind = KINDS[boot[1] as keyof typeof KINDS], id = decodeURIComponent(boot[2]); bootKey = `${kind}:${id}`; preloadDetailRecord(kind, id); } catch { /* A malformed URL renders 404. */ } }
}

/**
 * /events/:id, /offers/:id, /openings/:id. The page reads one generated record (features/detail/load-detail.ts) and
 * suspends while its bucket loads, so the prerendered page stays on screen at boot. On an in-app tap that takes longer than
 * 300 ms, the detail skeleton shows instead (at least 400 ms, so it never flickers). A failed load shows a retry state.
 */
export default function LocalDiscoveryPage({ kind }: { kind: DetailKind }) {
  const { id } = useParams();
  const [attempt, setAttempt] = useState(0);
  if (!id) return <NotFoundPage />;
  return <DetailLoadBoundary key={`${kind}-${id}-${attempt}`} kind={kind} onRetry={() => { retryDetailRecord(kind, id); setAttempt(value => value + 1); }}>
    <DetailRoute kind={kind} id={id} />
  </DetailLoadBoundary>;
}

/** The record, or 'wait' while the skeleton shows: a tap's first 300 ms suspend (the old page stays), then the skeleton. */
function useDetailRecord(kind: DetailKind, id: string): DetailRecord | null | 'wait' {
  const key = `${kind}:${id}`;
  const [, rerender] = useState(0);
  let record: DetailRecord | null | undefined;
  let pending: Promise<unknown> | undefined;
  try { record = readDetailRecord(kind, id); } catch (thrown) {
    if (!(thrown instanceof Promise) || key === bootKey) throw thrown;
    pending = thrown;
  }
  const hold = skeletonHold(key);
  const waiting = !!hold && (!!pending || !hold.done);
  useEffect(() => {
    if (!hold) return;
    if (!waiting) { endSkeletonHold(key); return; }
    let live = true;
    void Promise.all([Promise.resolve(pending).catch(() => {}), hold.held]).then(() => { if (live) rerender(value => value + 1); });
    return () => { live = false; };
  });
  if (pending && !hold) throw skeletonDelay(key, pending);
  return waiting ? 'wait' : record ?? null;
}

function DetailRoute({ kind, id }: { kind: DetailKind; id: string }) {
  const record = useDetailRecord(kind, id);
  const ready = record !== 'wait' ? record : null;
  useEffect(() => { if (ready) setPageMetadata(ready.metadata); }, [ready]);
  // One event_detail_open per detail opened; the kind and id never leave the browser.
  useEffect(() => { if (ready) recordDetailOpen(); }, [ready]);
  if (record === 'wait') return <DetailSkeleton kind={kind} />;
  if (!record) return <NotFoundPage />;
  return <LocalDiscoveryDetail key={`${kind}-${id}`} record={record} />;
}

/**
 * RC-25: the record could not load (offline, a stranded deploy): say so and offer 重试 instead of a blank page. Only a
 * failed load is caught here (load-detail marks it, isChunkLoadFailure); a render bug in the page is thrown on to the
 * app's ErrorBoundary, which reports it, rather than being shown to the reader as a network problem.
 */
class DetailLoadBoundary extends Component<{ children: ReactNode; kind: DetailKind; onRetry: () => void }, { error: unknown }> {
  state: { error: unknown } = { error: undefined };
  static getDerivedStateFromError(error: unknown) { return { error: error ?? new Error('Detail render failed') }; }
  render() {
    const { error } = this.state;
    if (error === undefined) return this.props.children;
    if (isChunkLoadFailure(error)) return <DetailLoadError kind={this.props.kind} onRetry={this.props.onRetry} />;
    throw error;
  }
}

/** The error state in the detail's own frame: the back link, ErrorState with 重试 as the primary, a quiet way back. */
function DetailLoadError({ kind, onRetry }: { kind: DetailKind; onRetry: () => void }) {
  const { t, pick } = useUiCopy();
  return <article className="local-discovery-detail detail-page detail-load-error">
    <DetailBack kind={kind} />
    <div className="detail-layout"><div className="detail-main">
      <ErrorState title={t('这一页没加载完', 'This page did not finish loading')} body={t('可能是网络不稳定。请检查网络后重试。', 'The connection may be unstable. Check it and try again.')} onRetry={onRetry} homeTo="" />
      <MoreLink to={DETAIL_BACK[kind].to}>{t(`回到${pick(DETAIL_BACK[kind].label)}`, `Back to ${pick(DETAIL_BACK[kind].label)}`)}</MoreLink>
    </div></div>
  </article>;
}
