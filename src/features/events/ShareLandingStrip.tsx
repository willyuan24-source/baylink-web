import { useUiCopy } from '../../components/ui/ui-copy';
import { SkeletonRow } from '../../components/ui';
import type { ResolvedCover } from '../../lib/cover';
import type { IndexEvent } from './events-index-types';
import { monthDay, regionLabel, type CardRegion } from './events-model';
import { EventRowCard } from './EventCards';
import { nextOccurrence } from '../../lib/monthly';

export type StripState =
  | { status: 'idle' | 'loading' | 'error' }
  | { status: 'ready'; ids: string[]; range?: { start: string; end: string } };

/**
 * Landing parity for the weekly share card (plan §2 IA: `/n/{region}` → `/events?region=…&from=card-…`): the reader who
 * scanned the card sees the card's own items first — the ids come from the card's manifest — then the full list below.
 * While the manifest loads the strip keeps its height (skeleton rows); if it cannot load, the strip says so in one line.
 */
export function ShareLandingStrip({ region, state, events, covers, today }: { region: CardRegion; state: StripState; events: IndexEvent[]; covers: ResolvedCover[]; today: string }) {
  const { t, pick } = useUiCopy();
  const place = region === 'all' ? t('湾区', 'Bay Area') : pick(regionLabel(region));
  const range = state.status === 'ready' && state.range ? ` · ${monthDay(state.range.start)}–${monthDay(state.range.end)}` : '';
  return <section className="ev-strip" aria-labelledby="ev-strip-heading" data-testid="share-landing-strip" data-card-ids={state.status === 'ready' ? state.ids.join(' ') : undefined}>
    <h2 id="ev-strip-heading" className="ev-section-title">{t(`分享卡上的 ${place}周末`, `From the share card: ${place} this weekend`)}{range}</h2>
    {state.status === 'loading' || state.status === 'idle' ? <div aria-busy="true"><p className="ui-visually-hidden" role="status">{t('正在载入分享卡', 'Loading the share card')}</p><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
      : state.status === 'error' ? <p className="ev-strip__note" role="status">{t('分享卡的清单暂时没能载入，下面是这个周末的全部活动。', 'The share card’s list didn’t load; every event this weekend is below.')}</p>
      : events.length ? <div className="ev-strip__rows">{events.map((event, index) => <EventRowCard key={event.id} event={event} cover={covers[index]} today={today} day={nextOccurrence(event, today) ?? today} />)}</div>
      : <p className="ev-strip__note">{t('分享卡上的活动都已结束，下面是这个周末的全部活动。', 'The card’s events have ended; every event this weekend is below.')}</p>}
  </section>;
}
