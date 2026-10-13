import { useEffect, useMemo, useState } from 'react';
import { useUiCopy } from './ui/ui-copy';
import { HOME_INTENTS, type HomeIntentId } from '../data/home-pathways';
import { createCoverPage, distinctNeighbourTones, getCover, type CoverContext } from '../lib/cover';
import { eventTone } from '../lib/event-facts';
import { getBayAreaToday } from '../lib/monthly';
import { getHomeWeekend, getWeeklyCardDays, getWeeklyCardHref } from '../lib/home-weekend';
import { getGuideBySlug, guideCount, GUIDE_IMAGES, HOME_OFFERS, MONTHLY_EDITION, type HomeEvent, type HomeGuide } from '../lib/home-catalog';
import { selectHomeOffers } from '../lib/home-offers';
import { HomeHead } from '../features/home/HomeHead';
import { HeroPicks } from '../features/home/HeroPicks';
import { MoodCircles } from '../features/home/MoodCircles';
import { WeekendFeed } from '../features/home/WeekendFeed';
import { BayBayDemoCard } from '../features/home/BayBayDemoCard';
import { GuideRail } from '../features/home/GuideRail';
import { OfferTickets } from '../features/home/OfferTickets';
import { ShareStrip } from '../features/home/ShareStrip';
import { Home3DTile } from '../features/home/Home3DTile';
import { HomeImageCredits } from '../features/home/HomeImageCredits';

const INTENT_KEY = 'baylink.home-intent.v1';
const isIntent = (value: string | null): value is HomeIntentId => HOME_INTENTS.some(intent => intent.id === value);
function readSavedIntent(): HomeIntentId | undefined {
  try { const saved = window.localStorage.getItem(INTENT_KEY); return isIntent(saved) ? saved : undefined; } catch { return undefined; }
}

/**
 * The home page (plan WEB-HOME, 1007 §4.2): nine sections in one 1216 container — ① the question headline with the ask
 * box, ② this weekend's picks (a 4:5 rail on phones, the cover mosaic beside the headline on desktop), ③ 按心情找,
 * ④ the weekend's two-column feed, ⑤ 问 BayBay, ⑥ the guide intents with 长辈与家属, ⑦ free days and deals, ⑧ the
 * family-chat share card and ⑨ the neighborhood line and the 3D tile. Every cover comes from getCover on one page context
 * (no image twice, no AI art on a listing); every section renders eagerly, so the prerendered page carries all of it
 * (OPUS contract: the /opus-bay?from=home tile and the client-side 按日历看 link). Props are the OPUS contract's.
 */
export function HomeDiscovery({ onAskBayBay, onBrowseCommunity, onSearch, today: suppliedToday }: {
  onAskBayBay: (question?: string) => void; onBrowseCommunity: () => void;
  onSearch?: (query: string) => void; today?: string;
}) {
  const { t } = useUiCopy();
  const [intent, setIntent] = useState<HomeIntentId>('weekend');
  const [localToday, setLocalToday] = useState(getBayAreaToday);
  // The saved intent is read after the first render, so the prerendered page and the first client render agree.
  useEffect(() => { const saved = readSavedIntent(); if (saved) setIntent(saved); }, []);
  useEffect(() => {
    const refresh = () => setLocalToday(getBayAreaToday());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const today = suppliedToday || localToday;
  const choose = (next: HomeIntentId) => { setIntent(next); try { window.localStorage.setItem(INTENT_KEY, next); } catch { /* the choice still applies on this visit */ } };

  const weekend = useMemo(() => getHomeWeekend(today), [today]);
  const offers = useMemo(() => selectHomeOffers(HOME_OFFERS, today), [today]);
  const guides = useMemo(() => HOME_INTENTS.find(item => item.id === intent)!.slugs.map(getGuideBySlug).filter((guide): guide is HomeGuide => !!guide), [intent]);
  // One page context in display order — picks, feed, guides, offers — so an image appears once (VISUAL-10) and the
  // ladder decides every label (SV-04: an AI illustration is never an event's cover).
  const covers = useMemo(() => {
    const context: CoverContext = { images: GUIDE_IMAGES, today, page: createCoverPage() };
    const event = (item: HomeEvent) => getCover({ kind: 'event', id: item.id, imageKey: item.imageKey }, context);
    return {
      picks: weekend.picks.map(pick => event(pick.event as HomeEvent)),
      feed: weekend.feed.map(entry => event(entry.event as HomeEvent)),
      guides: guides.map(guide => getCover({ kind: 'guide', id: guide.slug, imageKey: guide.imageKey }, context)),
      offers: offers.map(offer => getCover({ kind: 'offer', id: offer.id, imageKey: offer.imageKey }, context)),
    };
  }, [weekend, guides, offers, today]);
  // ⑧ offers the share card only on days the build wrote a card for (the week after it): on a later day the undated card is
  // an earlier weekend's, so saving it would send the family the wrong three until the next build.
  const cardHref = getWeeklyCardDays().includes(today) ? getWeeklyCardHref(today) : null;
  const feedTones = distinctNeighbourTones(weekend.feed.map((entry, index) => covers.feed[index].tier === 'type' ? eventTone(entry.event) : null));

  return <section className="home-discovery" aria-label={t('湾区去哪、怎么办', 'Where to go and how to get it done in the Bay')}>
    <div className="home-top">
      <HomeHead today={today} weekendTotal={weekend.total} guideCount={guideCount} checkedAt={MONTHLY_EDITION.checkedAt} onAskBayBay={onAskBayBay} onSearch={onSearch} />
      <HeroPicks picks={weekend.picks} covers={covers.picks} today={today} start={weekend.start} end={weekend.end} total={weekend.total} />
      <MoodCircles />
    </div>
    <WeekendFeed feed={weekend.feed as { event: HomeEvent; date: string }[]} covers={covers.feed} tones={feedTones} today={today} total={weekend.total} />
    <BayBayDemoCard onAsk={question => onAskBayBay(question)} />
    <GuideRail intent={intent} onIntent={choose} guides={guides} covers={covers.guides} guideCount={guideCount} />
    <OfferTickets offers={offers} covers={covers.offers} today={today} />
    <div className="home-end">
      {cardHref && <ShareStrip picks={weekend.picks} start={weekend.start} end={weekend.end} cardHref={cardHref} />}
      <Home3DTile />
    </div>
    <p className="home-community"><button type="button" onClick={onBrowseCommunity}>{t('邻里信息（测试中）· 去看看', 'Neighborhood board (beta) · Take a look')}</button></p>
    <HomeImageCredits covers={[...covers.picks, ...covers.feed, ...covers.guides, ...covers.offers]} />
  </section>;
}
