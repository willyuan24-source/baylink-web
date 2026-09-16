import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getLocalDiscovery } from '../data/local-discoveries';
import { getDiscoveryMetadata } from '../lib/discovery-metadata';
import { setPageMetadata } from '../lib/seo';
import { LocalDiscoveryDetail } from '../components/LocalDiscoveryDetail';
import NotFoundPage from './NotFoundPage';

export default function LocalDiscoveryPage({ kind }: { kind: 'event' | 'offer' | 'opening' }) {
  const { id } = useParams();
  const item = id ? getLocalDiscovery(kind, id) : undefined;
  useEffect(() => { if (item) setPageMetadata(getDiscoveryMetadata(item)); }, [item]);
  return item ? <LocalDiscoveryDetail key={`${kind}-${id}`} item={item} /> : <NotFoundPage />;
}
