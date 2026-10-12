import { useEffect, useState } from 'react';
import { ChevronRight, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUiCopy } from '../../components/ui/ui-copy';
import { outings } from '../../lib/outings';

/**
 * "这场活动有小队在招募 ›" (design.md §4.9 step 9, E2E-09): the event's open outings with a seat, read after the page
 * renders (never in prerendered HTML). Counts under 3 are not printed (D20), and nothing shows when there is none or the
 * read fails.
 */
export function SquadTeaser({ eventId }: { eventId: string }) {
  const { t } = useUiCopy();
  const [open, setOpen] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    outings.list({ eventId, seats: 'open' }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setOpen(result.outings.filter(outing => outing.status === 'open' && outing.startAt > Date.now()).length); })
      .catch(() => { /* The teaser is optional; the 一起去 sheet still lists the outings. */ });
    return () => controller.abort();
  }, [eventId]);
  if (!open) return null;
  return <Link className="detail-squad" to={`/together?event=${encodeURIComponent(eventId)}`}>
    <Users aria-hidden="true" strokeWidth={1.75} />
    <span>{open >= 3 ? t(`${open} 支小队正在招募`, `${open} outings are looking for people`) : t('这场活动有小队在招募', 'Outings for this event are looking for people')}</span>
    <ChevronRight aria-hidden="true" strokeWidth={1.75} />
  </Link>;
}
