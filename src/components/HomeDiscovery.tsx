import { createElement, lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from 'react';
import { ArrowRight } from 'lucide-react';
import { useUiCopy } from './ui/ui-copy';
import { HOME_INTENTS, type HomeIntentId } from '../data/home-pathways';
import { coverItemFor, createCoverPage, getCover, type CoverContext } from '../lib/cover';
import { leadImageKey } from '../lib/close-up-faces';
import { getBayAreaToday } from '../lib/monthly';
import { getHomeWeekend, getWeeklyCardDays, getWeeklyCardHref } from '../lib/home-weekend';
import { ELDER_CALLS, getGuideBySlug, guideCount, GUIDE_IMAGES, HOME_OFFERS, HOME_TILES, type HomeEvent, type HomeGuide } from '../lib/home-catalog';
import { homeOfferCount, offerHasPhoto, offerLeadsRail, selectHomeOffers } from '../lib/home-offers';
import { HomeHead } from '../features/home/HomeHead';
import { HeroPicks } from '../features/home/HeroPicks';
import { MoodCircles } from '../features/home/MoodCircles';
import { WeekendFeed } from '../features/home/WeekendFeed';
import { BayBayDemoCard } from '../features/home/BayBayDemoCard';
import { GuideRailView as GuideRailNow } from '../features/home/GuideRailView';
import { OfferTicketsView as OfferTicketsNow } from '../features/home/OfferTicketsView';
import { TOPIC_LABELS } from '../features/home/home-model';
import { ShareStrip } from '../features/home/ShareStrip';
import { ElderCalls } from '../features/home/ElderCalls';
import { Home3DTile } from '../features/home/Home3DTile';
import { HomeImageCredits } from '../features/home/HomeImageCredits';
import { COMMUNITY_VISIBLE } from '../data/site-flags';
import { chunkLoader } from '../lib/chunk-recovery';

// The two sections below the fold (free days and deals, the guide intents) load after the page in a production build
// (captain 10-19 15:15: home route JS ≤ the 200dfb4 base). Each has its own Suspense boundary (captain 10-20), so the page
// commits without waiting for them (UI9-HOME measured +0.97 s to the first commit when the layout's boundary waited); the
// fallback is the prerendered copy of the same section (SectionHold), so its box keeps its height and nothing shifts (CLS
// 0) until the real one replaces it. Node (the prerender and the tests) and the dev server render them as they are
// (`import.meta.env?.PROD`, as cover-defer does), so the prerendered page carries both sections. A load that still fails
// after chunkLoader's retry leaves the section out rather than the page. The views take the home's intents, topic names
// and ticket count as props and import nothing from the home's own modules, so the home's chunk exports nothing to them and
// keeps its manifest entry (src/pages/HomePage.tsx, which scripts/verify-release.mjs reads).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- React.lazy's own constraint
const afterPage = <C extends ComponentType<any>>(load: () => Promise<C>) =>
  lazy(() => load().then(component => ({ default: component }), () => ({ default: (() => null) as unknown as C })));
const GuideRail = import.meta.env?.PROD ? /* @__PURE__ */ afterPage(chunkLoader(() => import('../features/home/GuideRailView'), module => module.GuideRailView)) : GuideRailNow;
const OfferTickets = import.meta.env?.PROD ? /* @__PURE__ */ afterPage(chunkLoader(() => import('../features/home/OfferTicketsView'), module => module.OfferTicketsView)) : OfferTicketsNow;

/**
 * An after-page section's place while its chunk loads: at boot, the prerendered section itself (same element, attributes and
 * markup, read once from the page before React's first commit replaces it), so the box and what it shows stay put; after a
 * client navigation (nothing prerendered to copy) an empty box that holds about a screen.
 */
function SectionHold({ selector }: { selector: string }) {
  const [copy] = useState(() => {
    const section = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(`#root ${selector}`);
    if (!section) return null;
    const props: Record<string, unknown> = { dangerouslySetInnerHTML: { __html: section.innerHTML } };
    for (const { name, value } of section.attributes) if (name !== 'style') props[name === 'class' ? 'className' : name] = value;
    return createElement(section.localName, props);
  });
  return copy ?? <div className="home-rail-hold" style={{ minHeight: '60vh' }} aria-busy="true" />;
}

const INTENT_KEY = 'baylink.home-intent.v1';
const isIntent = (value: string | null): value is HomeIntentId => HOME_INTENTS.some(intent => intent.id === value);
function readSavedIntent(): HomeIntentId | undefined {
  try { const saved = window.localStorage.getItem(INTENT_KEY); return isIntent(saved) ? saved : undefined; } catch { return undefined; }
}

/**
 * The home page (UI9-HOME content arrangement): ① the masthead and ② this weekend's picks (the lead beside the masthead on
 * a desktop), the trust line, ③ 按需要找 and the family-chat card; ④ the weekend's feed with the 3D strip; ⑤ free days and
 * deals; ⑥ 问 BayBay; ⑦ the guide intents; ⑧ 长辈常用电话 beside the 3D tile; ⑨ the credits line. Events (去哪) first, then
 * the band, then help (怎么办). Every cover comes from getCover on one page context in the order picks, feed, guides,
 * offers (no image twice, no AI art on a listing); every section renders in the prerender, so the prerendered page carries
 * all of it (OPUS contract: the /opus-bay?from=home tile and strip, the client-side 按日历看 link), and the browser's first
 * commit waits for the two after-page sections (above) instead of drawing placeholders. 简洁 and 家人版 are CSS only
 * (`data-simple="hide" | "only"`, home-discovery.css). Props are the OPUS contract's.
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
  // H19: the generator's photo tests (src/lib/home-offers.ts) on the images the page ships.
  const offers = useMemo(() => selectHomeOffers(HOME_OFFERS, today, 6, offerHasPhoto(GUIDE_IMAGES, today), offerLeadsRail(GUIDE_IMAGES, today)), [today]);
  const guides = useMemo(() => HOME_INTENTS.find(item => item.id === intent)!.slugs.map(getGuideBySlug).filter((guide): guide is HomeGuide => !!guide), [intent]);
  // One page context in display order — picks, feed, offers, guides — so an image appears once (VISUAL-10), a ③④ pool
  // picture comes back only ADJACENT_CARDS cards later as the page shows them, and the ladder decides every label (SV-04).
  const covers = useMemo(() => {
    const context: CoverContext = { images: GUIDE_IMAGES, today, page: createCoverPage() };
    const event = (item: HomeEvent) => getCover(coverItemFor('event', item), context);
    const picks = weekend.picks.map(({ event: item }, index) => index ? event(item as HomeEvent) : getCover(coverItemFor('event', item, { imageKey: leadImageKey(item.imageKey), lead: true }), context));
    const feed = weekend.feed.map(entry => event(entry.event as HomeEvent));
    const offerCovers = offers.map(offer => getCover(coverItemFor('offer', offer), context));
    return {
      // DECISIONS 15: the lead (16:9) never shows a close-up face photo; it draws its type cover (the photo stays a card's).
      picks,
      feed,
      offers: offerCovers,
      guides: guides.map(guide => getCover(coverItemFor('guide', { id: guide.slug, imageKey: guide.imageKey, imageKeys: guide.imageKeys }), context)),
      // 长辈常用电话 rows show their guide's picture (UI9-IMG-A1b): the same item as its rail card, so the same picture.
      calls: ELDER_CALLS.map(call => getGuideBySlug(call.slug)).map((guide, index) => getCover(coverItemFor('guide', { id: ELDER_CALLS[index].slug, imageKey: guide?.imageKey, imageKeys: guide?.imageKeys }), context)),
    };
  }, [weekend, guides, offers, today]);
  // The family-chat card only on days the build wrote a card for (the week after it): on a later day the undated card is
  // an earlier weekend's, so saving it would send the family the wrong three until the next build. Without one, the card's
  // place holds 看本周末全部 and 订阅日历 (ShareStrip), so the desktop row beside picks 2–3 is never blank.
  const cardHref = getWeeklyCardDays().includes(today) ? getWeeklyCardHref(today) : null;
  // The tickets shown (three after a wide one, else four): the rail draws them and the credits line credits only these.
  const offerCount = offers.length ? homeOfferCount(offers, covers.offers, today) : 0;

  return <section className="home-discovery" aria-label={t('湾区去哪、怎么办', 'Where to go and how to get it done in the Bay')}>
    <div className="home-top">
      <HomeHead today={today} start={weekend.start} end={weekend.end} known={weekend.total !== null} onAskBayBay={onAskBayBay} onSearch={onSearch} />
      <HeroPicks picks={weekend.picks} covers={covers.picks} today={today} start={weekend.start} end={weekend.end} total={weekend.total} checked={weekend.checked} />
      <MoodCircles seniors={weekend.seniors} />
      <ShareStrip count={weekend.picks.length} cardHref={cardHref} total={weekend.total} />
    </div>
    <WeekendFeed feed={weekend.feed as { event: HomeEvent; date: string }[]} covers={covers.feed} today={today} total={weekend.total} />
    {offers.length > 0 && <Suspense fallback={<SectionHold selector="section.home-offers" />}><OfferTickets offers={offers} covers={covers.offers} today={today} count={offerCount} /></Suspense>}
    <BayBayDemoCard onAsk={question => onAskBayBay(question)} />
    <Suspense fallback={<SectionHold selector="section.home-guides" />}><GuideRail intents={HOME_INTENTS} topicLabels={TOPIC_LABELS} intent={intent} onIntent={choose} guides={guides} covers={covers.guides} guideCount={guideCount} /></Suspense>
    <div className="home-end">
      <ElderCalls calls={ELDER_CALLS} covers={covers.calls} />
      <Home3DTile />
    </div>
    <HomeImageCredits covers={[...covers.picks, ...covers.feed, ...covers.guides, ...covers.calls, ...covers.offers.slice(0, offerCount)]} tiles={Object.values(HOME_TILES)}>
      {COMMUNITY_VISIBLE && <button type="button" className="home-section-head__more home-community" data-simple="hide" onClick={onBrowseCommunity}>{t('邻里信息（测试中）· 去看看', 'Neighborhood board (beta) · Take a look')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></button>}
    </HomeImageCredits>
  </section>;
}
