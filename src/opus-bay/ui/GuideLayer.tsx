import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Footprints, Hand } from 'lucide-react';
import PHOTO_ASSETS from '../../data/sf-landmark-photo-assets.json';
import { runtime } from '../core/runtime';
import { game, useGame } from '../core/store';
import { faceCameraToward } from '../game/cinema';
import { dismissArrival, endTrip, enterPhotoMode, objectiveTarget, openPanel, skipTripLeg, tourPill, walkTo } from '../game/flow';
import { flow, useFlow } from '../game/flowStore';
import { type GuideUiState, TOAST_MS, guideUi, registerPanoramaRoot, setGuideLocalePick, setPanoramaWriter, setPhotoLookup, tripNames, tripSecondsLeft } from '../game/guideCity';
import { tripProviders } from '../game/tripProviders';
import { type TripLineInfo, tripTimeLabel } from '../game/tripPlan';
import type { TripState } from '../game/tripTypes';
import { ATTRACTION_INDEX } from '../data/sf/attractions';
import { pick, useT } from '../i18n';
import { ArrivalCard, ArrivalToast } from './ArrivalCard';
import { PanoramaTags } from './PanoramaTags';
import { placePanoramaTags } from './panoramaPlace';
import { TripCard, TripPill } from './TripPill';
import { tripPillText } from './guideText';
import { useDevice, useMedia } from './hooks';

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
  const text = tripPillText(trip, tripSecondsLeft(trip, runtime.player), { lines, phase: stage, compact: narrow, ...tripNames(trip) });
  // a tour's leg: lane C's tourPill progress (the first lesson's stops, the Grand Tour's chapters)
  const tp = trip.source === 'tour' ? tourPill() : null;
  const dots = tp ? { done: tp.done, now: tp.step - 1, total: tp.total } : null;
  return <TripPill text={text} dots={dots} onOpen={() => guideUi.set(s => ({ tripCard: !s.tripCard }))} open={open} />;
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
 */
export function GuideLeadChip() {
  const { t } = useT();
  const device = useDevice();
  const dialogue = useGame(s => !!s.dialogue.nodeId);
  const panel = useGame(s => !!s.panel.kind);
  const idleChip = useFlow(s => s.leadChip && (s.tourPhase === 'leading' || s.weekStage === 'walking'));
  const [leading, setLeading] = useState(false);
  const [coach, setCoach] = useState(false);
  const touch = device === 'touch';
  useEffect(() => {
    if (!touch) { setLeading(false); return; }
    const id = window.setInterval(() => {
      const g = runtime.guide.state, p = runtime.player, s = game.get();
      setLeading((g === 'lead' || g === 'wait') && !p.pathTarget && s.move.mode === 'foot' && s.phase === 'playing');
    }, 250);
    return () => window.clearInterval(id);
  }, [touch]);
  const touchOn = touch && leading && !dialogue && !panel;
  useEffect(() => {
    if (!touchOn || leadCoachSeen()) return;
    markLeadCoachSeen();
    setCoach(true);
    const id = window.setTimeout(() => setCoach(false), 6000);
    return () => { window.clearTimeout(id); setCoach(false); };
  }, [touchOn]);
  if ((!touchOn && !idleChip) || dialogue || panel) return null;
  const go = () => {
    const target = runtime.guide.target ?? objectiveTarget();
    if (target) walkTo(target);
    flow.set({ leadChip: false });
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
  const left = tripTimeLabel(tripSecondsLeft(trip, runtime.player));
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
