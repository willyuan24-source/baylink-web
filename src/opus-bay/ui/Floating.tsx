import { useCallback } from 'react';
import { Footprints, Navigation } from 'lucide-react';
import { runtime } from '../core/runtime';
import { useGame } from '../core/store';
import { skipCinema } from '../game/cinema';
import { skipTravel, travelActive, useTravelView } from '../game/fastTravel';
import { acceptRealTime, dismissFreeHint, objectiveTarget, walkTo } from '../game/flow';
import { flow, useFlow } from '../game/flowStore';
import { BAYBAY_ID, interactableById } from '../game/interactables';
import { registerAnchor } from '../game/projector';
import { useT } from '../i18n';
import { BaybayFace, Keycap } from './common';
import { useDevice } from './hooks';

/** Speech bubble projected over BAYBAY / NPCs (position written per frame by the Canvas ticker). */
export function SpeechBubble() {
  const { t } = useT();
  const bubble = useFlow(s => s.bubble);
  const dialogue = useGame(s => s.dialogue.nodeId);
  const reward = useFlow(s => !!s.postcardReward || !!s.postcardFly);
  const ref = useCallback((el: HTMLDivElement | null) => registerAnchor('bubble', el), []);
  const visible = !!bubble && !dialogue && !reward;
  return (
    <div ref={ref} className="ob-bubble-anchor" aria-hidden={!visible}>
      {visible && (
        <div key={bubble.key} className={`ob-bubble tone-${bubble.tone ?? 'bark'} ${bubble.who === BAYBAY_ID ? 'is-baybay' : 'is-npc'}`} role="status">
          {bubble.who === BAYBAY_ID && <span className="ob-bubble-face" aria-hidden><BaybayFace size={28} /></span>}
          <span>{t(bubble.text)}</span>
        </div>
      )}
    </div>
  );
}

/** Objective waypoint: floats over the destination, sticks to the screen edge with an arrow when off-screen. */
export function Waypoint() {
  const { t } = useT();
  const ref = useCallback((el: HTMLDivElement | null) => registerAnchor('waypoint', el), []);
  const label = useCallback((el: HTMLSpanElement | null) => registerAnchor('waypointLabel', el), []);
  const soft = useFlow(s => !!s.freeHint);
  return (
    <div ref={ref} className="ob-waypoint" data-show="0" aria-hidden={!soft}>
      <span className="ob-waypoint-arrow"><Navigation size={16} /></span>
      <span className="ob-waypoint-pin" />
      <span ref={label} className="ob-waypoint-label" />
      {soft && <button type="button" className="ob-waypoint-dismiss" onClick={dismissFreeHint} aria-label={t('不用提示了', 'Hide this hint')}>×</button>}
    </div>
  );
}

const TIME_WORDS = { morning: { zh: '早上', en: 'morning' }, day: { zh: '白天', en: 'daytime' }, golden: { zh: '傍晚', en: 'golden hour' }, night: { zh: '晚上', en: 'night' } } as const;
const TIME_ACTION = { morning: { zh: '看此刻的早晨', en: 'See this morning' }, day: { zh: '看此刻的白天', en: 'See it now' }, golden: { zh: '看此刻', en: 'See it now' }, night: { zh: '看夜景', en: 'See the night view' } } as const;

/** F11: first visit opened at golden hour — one tap switches to the real Bay time right now (this visit only). */
export function TimeOffer() {
  const { t, locale } = useT();
  const offer = useFlow(s => s.timeOffer);
  if (!offer) return null;
  const clock = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const word = TIME_WORDS[offer], act = TIME_ACTION[offer];
  return (
    <div className="ob-time-offer" role="status">
      <span>{t(`现在湾区是${word.zh} ${clock} · 看看此刻的样子？`, `It's ${word.en} in the Bay right now (${clock}). Want to see it?`)}</span>
      <button type="button" className="ob-btn ob-btn-primary ob-btn-sm" onClick={acceptRealTime}>{t(act.zh, act.en)}</button>
      <button type="button" className="ob-icon-btn ob-icon-sm" onClick={() => flow.set({ timeOffer: null })} aria-label={t('不用了', 'No thanks')}>×</button>
    </div>
  );
}

/** F2: after ~20 s standing still while BAYBAY leads — one tap and you walk there together. */
export function LeadChip() {
  const { t } = useT();
  const on = useFlow(s => s.leadChip && (s.tourPhase === 'leading' || s.weekStage === 'walking'));
  const dialogue = useGame(s => !!s.dialogue.nodeId);
  const panel = useGame(s => !!s.panel.kind);
  if (!on || dialogue || panel) return null;
  const go = () => {
    const target = runtime.guide.target ?? objectiveTarget();
    if (target) walkTo(target);
    flow.set({ leadChip: false });
  };
  return (
    <button type="button" className="ob-lead-chip" onClick={go}>
      <Footprints size={18} aria-hidden /><span>{t('让 BAYBAY 带我过去', 'Let BAYBAY take me there')}</span>
    </button>
  );
}

/** Letterbox, caption, telescope vignette, skip. */
export function CinematicLayer() {
  const { t } = useT();
  const cinematic = useFlow(s => s.cinematic);
  const caption = useFlow(s => s.caption);
  const sub = useFlow(s => s.captionSub);
  const device = useDevice();
  const travel = useTravelView();
  if (!cinematic) return null;
  return (
    <div className={`ob-cinema kind-${cinematic}`}>
      {cinematic === 'telescope' && <div className="ob-telescope" aria-hidden />}
      {cinematic === 'travel' && <div className={`ob-travel-veil ${travel.veil ? 'is-on' : ''}`} aria-hidden><i /><i /><i /><i /></div>}
      <div className="ob-letterbox top" aria-hidden />
      <div className="ob-letterbox bottom" aria-hidden />
      {caption && (
        <div key={caption.en} className={`ob-cinema-caption ${sub ? 'has-sub' : ''}`} role="status">
          <strong>{t(caption)}</strong>
          {sub && <span>{t(sub)}</span>}
        </div>
      )}
      <button type="button" className="ob-cinema-skip" onClick={() => (travelActive() ? skipTravel() : skipCinema())}>
        {t('跳过', 'Skip')}{device === 'keyboard' && <Keycap className="on-dark">Esc</Keycap>}
      </button>
    </div>
  );
}

export function Toasts() {
  const { t } = useT();
  const toasts = useGame(s => s.toasts);
  return (
    <div className="ob-toasts" role="status" aria-live="polite">
      {toasts.map(item => <div key={item.id} className={`ob-toast tone-${item.tone ?? 'info'}`}>{item.bi ? t(item.bi) : item.text}</div>)}
    </div>
  );
}

/** Screen-reader announcements (focus changes, arrivals, collectibles). */
export function LiveRegion() {
  const { t } = useT();
  const announce = useFlow(s => s.announce);
  const focus = useGame(s => s.focus);
  const it = interactableById(focus);
  return (
    <>
      <div className="ob-sr" aria-live="polite">{typeof announce === 'string' ? announce : t(announce)}</div>
      <div className="ob-sr" aria-live="polite">{it ? `${t(it.name)} · ${t('按 E', 'press E to')} ${t(it.verb)}` : ''}</div>
    </>
  );
}

export function DebugOverlay() {
  const ref = useCallback((el: HTMLPreElement | null) => registerAnchor('debug', el), []);
  return <pre ref={ref} className="ob-debug" aria-hidden translate="no">…</pre>;
}
