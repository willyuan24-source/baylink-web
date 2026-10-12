import { Component, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { recordDetailOpen } from '../lib/product-events';
import { setPageMetadata } from '../lib/seo';
import { LocalDiscoveryDetail } from '../components/LocalDiscoveryDetail';
import { ErrorState } from '../components/ui';
import { useUiCopy } from '../components/ui/ui-copy';
import { preloadDetailRecord, readDetailRecord, retryDetailRecord, type DetailKind } from '../features/detail/load-detail';
import { routePathname } from '../app/route-table';
import { isChunkLoadFailure } from '../lib/chunk-recovery';
import NotFoundPage from './NotFoundPage';

const KINDS = { events: 'event', offers: 'offer', openings: 'opening' } as const;
// The record of the URL this page boots on starts loading with the page's own code, before React renders (ENGSEC-01).
if (typeof window !== 'undefined') {
  const boot = /^\/(events|offers|openings)\/([^/]+)$/.exec(routePathname(window.location.pathname));
  if (boot) { try { preloadDetailRecord(KINDS[boot[1] as keyof typeof KINDS], decodeURIComponent(boot[2])); } catch { /* A malformed URL renders 404. */ } }
}

/**
 * /events/:id, /offers/:id, /openings/:id. The page reads one generated record (features/detail/load-detail.ts) and
 * suspends while its bucket loads, so the prerendered page stays on screen at boot. A failed load shows a retry state.
 */
export default function LocalDiscoveryPage({ kind }: { kind: DetailKind }) {
  const { id } = useParams();
  const [attempt, setAttempt] = useState(0);
  if (!id) return <NotFoundPage />;
  return <DetailLoadBoundary key={`${kind}-${id}-${attempt}`} onRetry={() => { retryDetailRecord(kind, id); setAttempt(value => value + 1); }}>
    <DetailRoute kind={kind} id={id} />
  </DetailLoadBoundary>;
}

function DetailRoute({ kind, id }: { kind: DetailKind; id: string }) {
  const record = readDetailRecord(kind, id);
  useEffect(() => { if (record) setPageMetadata(record.metadata); }, [record]);
  // One event_detail_open per detail opened; the kind and id never leave the browser.
  useEffect(() => { if (record) recordDetailOpen(); }, [record]);
  if (!record) return <NotFoundPage />;
  return <LocalDiscoveryDetail key={`${kind}-${id}`} record={record} />;
}

/**
 * RC-25: the record could not load (offline, a stranded deploy): say so and offer 重试 instead of a blank page. Only a
 * failed load is caught here (load-detail marks it, isChunkLoadFailure); a render bug in the page is thrown on to the
 * app's ErrorBoundary, which reports it, rather than being shown to the reader as a network problem.
 */
class DetailLoadBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { error: unknown }> {
  state: { error: unknown } = { error: undefined };
  static getDerivedStateFromError(error: unknown) { return { error: error ?? new Error('Detail render failed') }; }
  render() {
    const { error } = this.state;
    if (error === undefined) return this.props.children;
    if (isChunkLoadFailure(error)) return <DetailLoadError onRetry={this.props.onRetry} />;
    throw error;
  }
}

function DetailLoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useUiCopy();
  return <div className="detail-load-error">
    <ErrorState title={t('这一页没加载完', 'This page did not finish loading')} body={t('可能是网络不稳定。请检查网络后重试。', 'The connection may be unstable. Check it and try again.')} onRetry={onRetry} />
  </div>;
}
