import { ChevronRight, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOutingCopy } from '../features/outings/outing-copy';

/** Carries a catalog reference, never an arbitrary image URL or private draft. */
export function OutingInspirationLink({ kind, id }: { kind: 'guide' | 'offer' | 'opening'; id: string }) {
  const { t } = useOutingCopy();
  const params = new URLSearchParams({ coverKind: kind, coverId: id });
  return <Link className="outing-inspiration-link" to={`/together?${params}`}>
    <span className="outing-inspiration-icon"><Users size={20} aria-hidden="true" /></span>
    <span><strong>{t('想约人一起去？', 'Want some company?')}</strong><small>{t('带上这篇内容的配图，发起一个小队', 'Start an outing with this article’s cover')}</small></span>
    <ChevronRight size={18} aria-hidden="true" />
  </Link>;
}
