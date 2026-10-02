import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Footprints, Hand, MapPin, Route } from 'lucide-react';
import { DISTRICT } from '../data/district';
import { AREA_NAMES } from '../game/brain';
import { CITY_HERO_ZONE_NAMES } from '../data/cityZones';
import { useStreetName } from '../game/streets';
import PHOTO_ASSETS from '../../data/sf-landmark-photo-assets.json';
import { runtime } from '../core/runtime';
import { game, useGame } from '../core/store';
import { faceCameraToward } from '../game/cinema';
import { dismissArrival, endTrip, enterPhotoMode, objectiveTarget, openPanel, skipTripLeg, tourNext, tourPill, walkTo } from '../game/flow';
import { flow, useFlow } from '../game/flowStore';
import { type GuideUiState, TOAST_MS, foundChipText, guideUi, registerPanoramaRoot, rideNow, setGuideLocalePick, setPanoramaWriter, setPhotoLookup, shownWait, tripEtaShown, tripNames } from '../game/guideCity';
import { tripProviders } from '../game/tripProviders';
import { type TripLineInfo, tripTimeLabel } from '../game/tripPlan';
import type { TripState } from '../game/tripTypes';
import { ATTRACTION_INDEX } from '../data/sf/attractions';
import { pick, useT } from '../i18n';
import { ArrivalCard, ArrivalToast } from './ArrivalCard';
import { PanoramaTags } from './PanoramaTags';
import { placePanoramaTags } from './panoramaPlace';
import { TripCard, TripPill } from './TripPill';
import { GoChip } from './GoChip';
import { autoOn, subscribeAuto } from '../game/autoTravel';
import { autoGliding } from '../actors/moveApi';
import { isScenicLeg, scenicResumeOffered } from '../game/scenicTrip';
import { NEAR_R, tripPillText } from './guideText';
import { useDevice, useMedia } from './hooks';
import { importRetry } from '../game/importRetry';
import { ribbonNote } from '../game/attention';

/**
 * Wave 4 · lane G's guidance on screen, city mode only (a lazy chunk: ui/Hud.tsx and ui/Overlay.tsx mount these through
 * React.lazy when the page runs the city; the district never loads it). The state comes from game/guideCity.ts (the
 * same chunk family), the words from ui/guideText.ts and lane C's game/tripText.ts.
 *
 *   <TripPillSlot>   the objective pill during a trip: "[icon] 下一站 名称 · 约 N 分钟" (tap → the trip card)
 *   <GuideToasts>    the gold arrival toast in the top stack
 *   <GuideOverlay>   the arrival peek card (6 s), the panorama name tags (10 s), the trip card
 */

// the licensed photos (src/data/sf-landmark-photo-assets.json): key → the 480 w "-small" variant of srcSet
const SMALL = new Map<string, string>();
for (const p of PHOTO_ASSETS as { id: string; src: string; srcSet?: string }[]) {
  const small = p.srcSet?.split(',').map(s => s.trim().split(/\s+/)[0]).find(u => /-small\.webp$/.test(u));
  SMALL.set(p.id, small ?? p.src);
}
setPhotoLookup(key => SMALL.get(key) ?? null);
setPanoramaWriter(placePanoramaTags);

const useGuide = <S,>(sel: (s: GuideUiState) => S): S => useSyncExternalStore(guideUi.subscribe, () => sel(guideUi.get()), () => sel(guideUi.get()));

/** The planner's line table (names, kinds) for the pill and the card: read once per trip. */
function useTripLines(trip: TripState | null): ReadonlyMap<string, TripLineInfo> {
  return useMemo(() => {
    if (!trip) return new Map();
    try { return new Map((tripProviders().lines?.() ?? []).map(l => [l.id, l] as const)); } catch { return new Map(); }
  }, [trip]);
}

/** A 1 Hz re-render while mounted (the time left). */
function useSecondTick() {
  const [, setN] = useState(0);
  useEffect(() => { const id = window.setInterval(() => setN(n => (n + 1) % 1e6), 1000); return () => window.clearInterval(id); }, []);
}

export function TripPillSlot() {
  const trip = useFlow(s => s.trip);
  const stage = useFlow(s => s.ride?.stage ?? null);
  const narrow = useMedia('(max-width: 720px)');
  const open = useGuide(s => s.tripCard);
  const lines = useTripLines(trip);
  const { locale } = useT();
  useSecondTick();
  useEffect(() => { setGuideLocalePick(b => pick(b, locale)); }, [locale]);
  // the pill replaces the postcards pill that opened the goals card: fold it (it does not pop back when the trip ends)
  useEffect(() => { if (flow.get().goalsCard) flow.set({ goalsCard: false }); }, []);
  if (!trip || trip.leg >= trip.legs.length) return null;
  // (W9-N2, review R§5 #6) one source: the smoothed trip ETA; waiting, the banner's live wait + the ride
  const eta = tripEtaShown('pill', trip, runtime.player);
  const cur = trip.legs[trip.leg];
  const r = cur.via === 'line' && stage === 'waiting' ? rideNow() : null;
  // (W9-N-review N-RC-1) a live wait that stood still says 车快到了 (shownWait), not a frozen number
  const wait = r && r.waitLeft !== undefined && cur.via === 'line' ? { ...shownWait(trip, r.waitLeft), ride: Math.max(0, cur.seconds - cur.wait) } : null;
  const end = trip.legs[trip.legs.length - 1].to;
  const near = Math.hypot(end.x - runtime.player.x, end.z - runtime.player.z) <= NEAR_R;
  const text = tripPillText(trip, eta.seconds, { lines, phase: stage, compact: narrow, ...tripNames(trip), wait, near, detour: eta.detour });
  // a tour's leg: lane C's tourPill progress (the first lesson's stops, the Grand Tour's chapters)
  const tp = trip.source === 'tour' ? tourPill() : null;
  const dots = tp ? { done: tp.done, now: tp.step - 1, total: tp.total } : null;
  return <TripPill text={text} dots={dots} onOpen={() => guideUi.set(s => ({ tripCard: !s.tripCard }))} open={open} />;
}

const SF_NAME = { zh: '旧金山', en: 'San Francisco' };

/**
 * The city's area pill (ui/Hud AreaLabel in city mode; moved here unchanged with the wave-4 integration so GameRoot does
 * not carry it): a DataSF neighbourhood (game/brain AREA_NAMES), else the whole city — never "The Embarcadero" out
 * there — and under it the nearest named street (lane G1, G1-9) unless the street is named like the place (Pier 39).
 */
export function CityAreaLabel() {
  const { t, locale } = useT();
  const area = useGame(s => s.area);
  const zone = DISTRICT.zones?.find(item => item.id === area);
  // CP-13: the hero waterfront zones by their city names (the district's frozen ones mix in English)
  const name = (area ? CITY_HERO_ZONE_NAMES[area] : undefined) ?? zone?.name ?? (area ? AREA_NAMES.get(area) : undefined) ?? SF_NAME;
  const streetName = useStreetName();
  const street = streetName && streetName.toLowerCase() !== name.en.toLowerCase() ? streetName : null;
  const [fresh, setFresh] = useState(true);
  useEffect(() => {
    setFresh(true);
    const id = window.setTimeout(() => setFresh(false), 4000);
    return () => window.clearTimeout(id);
  }, [area]);
  return (
    <div className={`ob-area ob-area-city ${fresh ? 'is-fresh' : ''} ${street ? 'has-street' : ''}`} key={area ?? 'default'}>
      <MapPin size={15} aria-hidden />
      <span className="ob-area-lines">
        <span className="ob-area-top">
          <span className="ob-area-name">{t(name)}</span>
          {locale !== 'en' && <span className="ob-area-en" translate="no">{name.en}</span>}
        </span>
        {street && <span className="ob-area-street" translate="no">{street}</span>}
      </span>
      <FoundChipView />
    </div>
  );
}

/**
 * W5-N7 · the quiet discovery chip under the area pill (plan MF6): minor finds batch into "+3 个地点" (one find: "+1 ·
 * 名称") for 4.5 s after the last one, instead of a gold toast each (12 toasts in 50 s at wave 4).
 */
function FoundChipView() {
  const found = useGuide(s => s.found);
  // (W9-F2, lane F surgical — review R§5 #5: "+1 · 渡轮大厦" was one more message beside the arrival banner and card) the
  // finds join the one progress ribbon (game/attention.ts: the arrival card's row, else the ribbon in the top stack)
  useEffect(() => { if (found) ribbonNote(foundChipText(found), 'found'); }, [found]);
  return null;
}

/** The Grand Tour between its stops (ui/Hud Objective, city only): lane C's tourPill — chapter, step / total, next, dots. */
export function CityTourPill() {
  const { t } = useT();
  // the tour's progress lives in lane C's runner: read it with the store's changes and once a second
  useGame(s => s.tour);
  useSecondTick();
  const tp = tourPill();
  if (!tp) return null;
  return (
    <button type="button" className="ob-objective" onClick={() => openPanel('journal')} aria-label={t('查看旅行本', 'Open journal')}>
      <span className="ob-objective-icon"><Route size={16} aria-hidden /></span>
      <span className="ob-objective-text">
        <strong>{t(tp.name)} <em>{tp.step}/{tp.total}</em></strong>
        {tp.next && <small>{t('下一站', 'Next')} · {t(tp.next)}</small>}
      </span>
      <span className="ob-progress-dots" aria-hidden>{Array.from({ length: tp.total }, (_, i) => <i key={i} className={i < tp.done ? 'done' : i === tp.step - 1 ? 'now' : ''} />)}</span>
    </button>
  );
}

export function GuideToasts() {
  const toast = useGuide(s => s.toast);
  // 3.2 s from when it is on screen (an arrival in the first moments of play can come before this chunk)
  const key = toast?.key ?? -1;
  useEffect(() => {
    if (key < 0) return;
    const id = window.setTimeout(() => { if (guideUi.get().toast?.key === key) guideUi.set({ toast: null }); }, TOAST_MS);
    return () => window.clearTimeout(id);
  }, [key]);
  if (!toast) return null;
  return <ArrivalToast key={toast.key} arrival={{ name: toast.name, quiet: toast.quiet }} text={toast.text} />;
}

export function GuideOverlay() {
  const card = useGuide(s => s.card);
  const pano = useGuide(s => s.panorama);
  const tripCard = useGuide(s => s.tripCard);
  const trip = useFlow(s => s.trip);
  const { locale } = useT();
  useEffect(() => { setGuideLocalePick(b => pick(b, locale)); }, [locale]);
  // the trip card closes with the trip
  const live = !!trip && trip.leg < trip.legs.length;
  useEffect(() => { if (!live && guideUi.get().tripCard) guideUi.set({ tripCard: false }); }, [live]);
  return (
    <>
      {card && (
        <ArrivalCard
          key={`card-${card.key}`}
          arrival={{ place: card.place, name: card.name, tier: card.tier, photo: card.photo, quiet: card.quiet, color: card.color }}
          onInfo={() => openPanel('poi', `sf:${card.place}`)}
          onPhoto={() => { enterPhotoMode(); faceCameraToward(card.x, card.z, { uncapped: true }); }}
          onClose={() => { if (guideUi.get().card?.key === card.key) guideUi.set({ card: null }); dismissArrival(); }}
        />
      )}
      {pano && (
        <PanoramaTags
          key={`pano-${pano.key}`}
          tags={pano.tags}
          register={registerPanoramaRoot}
          onPick={id => { const a = ATTRACTION_INDEX.get(id); openPanel('map', a?.placeId ?? id); }}
        />
      )}
      {tripCard && live && <TripCardSlot trip={trip} />}
    </>
  );
}

/** W4-G5 · the one-time touch coach mark for leads (this device). */
const LEAD_COACH_KEY = 'opus-bay:coach-lead:v1';
const leadCoachSeen = () => { try { return localStorage.getItem(LEAD_COACH_KEY) === '1'; } catch { return false; } };
const markLeadCoachSeen = () => { try { localStorage.setItem(LEAD_COACH_KEY, '1'); } catch { /* storage blocked: this visit */ } };

/**
 * W4-G5 · the lead chip in the city. Touch: "自动跟上 BAYBAY" from the start of every lead (a tour stop, the week board, a
 * trip, a free lead: whenever BAYBAY leads and you are not already auto-walking), so nobody has to hold the stick for a
 * long walk; the first time, a coach mark says so ("点箭头转向目标 · 点「自动跟上」就不用一直按"). Keyboard / pad: the
 * district's chip after 20 s standing still (unchanged).
 * W5-N3: during a trip (not a tour stop) on every device: "BAYBAY 带路中 · 碰摇杆接管" while auto-travel carries the
 * player, "自动跟上 BAYBAY" after a takeover (touch at once; keyboard / pad once they stop steering).
 */
export function GuideLeadChip() {
  const { t } = useT();
  const device = useDevice();
  const dialogue = useGame(s => !!s.dialogue.nodeId);
  const panel = useGame(s => !!s.panel.kind);
  const onFoot = useGame(s => s.move.mode === 'foot');
  const idleChip = useFlow(s => s.leadChip && (s.tourPhase === 'leading' || s.weekStage === 'walking'));
  // W5-N3: a trip (not a tour stop) carries the player; its chip (ui/GoChip) takes the lead chip's place
  const tripLive = useFlow(s => !!s.trip && s.trip.leg < s.trip.legs.length && s.trip.source !== 'tour' && s.trip.legs[s.trip.leg].via !== 'fly');
  const auto = useSyncExternalStore(subscribeAuto, autoOn, autoOn);
  const [leading, setLeading] = useState(false);
  const [handIdle, setHandIdle] = useState(false);
  // W5-N9: a scenic flight whose wings the player took (gliding on their own, not lane F's auto-glide)
  const [ownWings, setOwnWings] = useState(false);
  const scenicLeg = useFlow(s => !!s.trip && s.trip.leg < s.trip.legs.length && isScenicLeg(s.trip.legs[s.trip.leg]));
  const [coach, setCoach] = useState(false);
  const touch = device === 'touch';
  useEffect(() => {
    const id = window.setInterval(() => {
      const g = runtime.guide.state, p = runtime.player, s = game.get();
      setLeading(touch && (g === 'lead' || g === 'wait') && !p.pathTarget && s.move.mode === 'foot' && s.phase === 'playing');
      // keyboard / pad players who took over are offered 自动跟上 once they stop steering
      setHandIdle(!p.moving);
      // (review) only where lane F's auto-glide takes the wings back (60–900 u from the leg's end): else the chip did nothing
      const tr = flow.get().trip;
      setOwnWings(scenicResumeOffered({ gliding: s.move.mode === 'glide', autoGliding: autoGliding(), leg: tr && tr.leg < tr.legs.length ? tr.legs[tr.leg] : null, pos: p }));
    }, 250);
    return () => window.clearInterval(id);
  }, [touch]);
  const tripChip = tripLive && onFoot && !dialogue && !panel;
  const touchOn = touch && leading && !dialogue && !panel && !tripChip;
  useEffect(() => {
    if (!touchOn || leadCoachSeen()) return;
    markLeadCoachSeen();
    setCoach(true);
    const id = window.setTimeout(() => setCoach(false), 6000);
    return () => { window.clearTimeout(id); setCoach(false); };
  }, [touchOn]);
  if (scenicLeg && ownWings && !dialogue && !panel) {
    return <GoChip auto={false} fly device={device} onResume={() => { void importRetry(() => import('../game/tripRun')).then(m => m.resumeScenicGlide()); }} />;
  }
  if (tripChip) {
    if (auto) return <GoChip auto device={device} />;
    if (touch || handIdle) return <GoChip auto={false} device={device} onResume={() => { void importRetry(() => import('../game/tripRun')).then(m => m.resumeAutoTravel()); }} />;
    return null;
  }
  if (tripLive || (!touchOn && !idleChip) || dialogue || panel) return null;
  const go = () => {
    flow.set({ leadChip: false });
    // (W9-N1, review R§5 #7: the chip walked the same blocked way again) a Grand Tour stop: BAYBAY carries the player
    // again (the watchdog and the stuck card included), as 继续：带我去… in the call menu does
    const f = flow.get();
    if (f.tourPhase === 'leading' && f.trip?.source === 'tour') { tourNext(); return; }
    const target = runtime.guide.target ?? objectiveTarget();
    if (target) walkTo(target);
  };
  return (
    <>
      {coach && <div className="ob-coach is-touch ob-lead-coach" role="status"><span className="ob-coach-line"><Hand size={18} aria-hidden />{t('点箭头转向目标 · 点「自动跟上」就不用一直按', 'Tap the arrow to face the goal · tap Auto-follow instead of holding the stick')}</span></div>}
      <button type="button" className="ob-lead-chip" onClick={go}>
        <Footprints size={18} aria-hidden /><span>{touchOn ? t('自动跟上 BAYBAY', 'Auto-follow BAYBAY') : t('让 BAYBAY 带我过去', 'Let BAYBAY take me there')}</span>
      </button>
    </>
  );
}

function TripCardSlot({ trip }: { trip: TripState }) {
  const lines = useTripLines(trip);
  useSecondTick();
  const names = tripNames(trip);
  const left = tripTimeLabel(tripEtaShown('card', trip, runtime.player).seconds);
  const title = names.destination ?? trip.legs[trip.legs.length - 1]?.to.name ?? { zh: '行程', en: 'Trip' };
  const close = () => guideUi.set({ tripCard: false });
  return (
    <TripCard
      trip={trip}
      title={title}
      left={{ zh: `还要${left.zh}`, en: `${left.en} to go` }}
      lines={lines}
      onSkip={skipTripLeg}
      onChange={() => { close(); openPanel('map', trip.placeId); }}
      onEnd={() => { close(); endTrip(); }}
      onClose={close}
    />
  );
}
