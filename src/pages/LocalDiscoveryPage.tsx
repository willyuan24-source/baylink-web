import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { discoveryShare, getLocalDiscovery } from '../data/local-discoveries';
import { getDiscoveryMetadata } from '../lib/discovery-metadata';
import { recordDetailOpen } from '../lib/product-events';
import { setPageMetadata } from '../lib/seo';
import { LocalDiscoveryDetail } from '../components/LocalDiscoveryDetail';
import { ReportErrorLink } from '../features/feedback/ReportErrorLink';
import NotFoundPage from './NotFoundPage';

export default function LocalDiscoveryPage({ kind }: { kind: 'event' | 'offer' | 'opening' }) {
  const { id } = useParams();
  const item = id ? getLocalDiscovery(kind, id) : undefined;
  useEffect(() => { if (item) setPageMetadata(getDiscoveryMetadata(item)); }, [item]);
  // One event_detail_open per detail opened; the kind and id never leave the browser.
  useEffect(() => { if (item) recordDetailOpen(); }, [item]);
  if (!item) return <NotFoundPage />;
  const share = discoveryShare(item);
  // "这条信息有误？" sits after the article until WEB-DETAIL moves it into the trust row (LocalDiscoveryDetail is its file).
  return <>
    <LocalDiscoveryDetail key={`${kind}-${id}`} item={item} />
    <ReportErrorLink key={`report-${kind}-${share.id}`} entity={{ kind, id: share.id }} title={share.title} />
  </>;
}
