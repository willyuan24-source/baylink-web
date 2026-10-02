import { BellRing, Camera, Square } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { audioNow } from '../audio/hooks';
import { useFlow, type FlowRide } from '../game/flowStore';
import { useT } from '../i18n';
import { Keycap } from '../ui/common';
import { useDevice } from '../ui/hooks';
import { answerTimes, callTimes, cancelRiff, carMoving, leanState, mountBellPad, onRunningBoard, riffLook, riffState, setLean, startRiff, subscribeBell, tapBell } from './bell';
import { GROOVE_SECONDS, RIFF_BAR, RIFF_BEAT } from './sounds2';
import './play.css';

/**
 * Wave 5 · lane A · the bell pad in lane T's ride banner (a cable car under way): 铃声对答 starts the riff; while it runs
 * the pad shows the round's two bars (the gripman's call, then your answer: hollow until you hit it; a cursor walks the
 * beats), the big bell (H on a keyboard) and 停; in the freestyle, a jazz count. 探出身 (hold; L) leans out for the
 * classic photo. Keys are read at the capture phase while the pad is up: H is the riff's while it runs (lane T's
 * gripman bell otherwise), L is the lean.
 */

let seq = 0;
const bump = () => { seq++; };
const snap = () => seq;
/** the two bars of a round (s) */
const SPAN = RIFF_BAR * 2 * RIFF_BEAT;
const subscribe = (fn: () => void) => subscribeBell(() => { bump(); fn(); });

export default function BellPad({ ride }: { ride: FlowRide }) {
  const { t, locale } = useT();
  const device = useDevice();
  useSyncExternalStore(subscribe, snap, snap);
  const [, setTick] = useState(0);
  const flash = useFlow(s => s.photoFlash);
  const [flashing, setFlashing] = useState(false);
  const seenFlash = useRef(flash);
  const r = riffState();
  const lean = leanState();
  const caption = () => {
    const date = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date());
    return `${t('湾区小旅', 'Little Bay Trip')} · ${t('叮当车探身照', 'Hanging off a cable car')} · ${date}`;
  };
  const captionRef = useRef(caption);
  useEffect(() => { captionRef.current = caption; });

  useEffect(() => mountBellPad(), []);
  // the beat cursor while the riff runs. (W6-K1) The cursor and the freestyle meter move by direct style writes every
  // frame; React re-renders only when something else the clock changes does (a dot lit or missed, the bell's flash:
  // bell.riffLook) — before, the whole pad re-rendered every frame of the 20 s riff
  const running = !!r;
  const cursorRef = useRef<HTMLElement>(null);
  const meterRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!running) return;
    let id = 0, look = NaN;
    const tick = () => {
      const rr = riffState(), now = audioNow(), c = cursorRef.current, m = meterRef.current;
      if (rr) {
        const tt = now - rr.t0;
        if (c) c.style.left = `${Math.min(100, (tt / SPAN) * 100)}%`;
        if (m) m.style.width = `${Math.min(100, (tt / GROOVE_SECONDS) * 100)}%`;
        const k = riffLook(now);
        if (k !== look) { look = k; setTick(n => (n + 1) % 1e6); }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [running]);
  // keys: H rings (while the riff runs), L leans out (held)
  useEffect(() => {
    const typing = (e: KeyboardEvent) => { const el = e.target as HTMLElement | null; return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable); };
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
      if (e.code === 'KeyH' && riffState()) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) tapBell(); }
      else if (e.code === 'KeyL') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) setLean(true, captionRef.current()); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'KeyL') setLean(false); };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => { window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); setLean(false); };
  }, []);
  useEffect(() => {
    if (flash === seenFlash.current) return;
    seenFlash.current = flash;
    if (!leanState().shot) return;
    setFlashing(true);
    const id = window.setTimeout(() => setFlashing(false), 260);
    return () => window.clearTimeout(id);
  }, [flash]);

  const keys = device !== 'touch';
  // press and hold: a pointer that leaves the button still lets go (capture where the browser grants it, and the window's
  // pointerup either way)
  const press = (down: boolean) => (e: ReactPointerEvent) => {
    e.preventDefault();
    if (!down) { setLean(false); return; }
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch { /* not a live pointer */ }
    setLean(true, caption());
    const up = () => { setLean(false); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); };
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  };
  // (W9-C5, lane C surgical) the lean button follows the car: disabled while it stands (bell.ts re-renders the pad on the flip)
  const board = onRunningBoard(), moving = carMoving();
  // (W9-C5, review R§6: say how — hold, and the key — and why it is off: not on the running board, or the car standing)
  const leanBtn = (
    <button
      type="button" className={`ob-btn ob-btn-soft ob-btn-sm ob-play-lean${lean.on ? ' is-on' : ''}`} aria-pressed={lean.on} disabled={!board || !moving}
      title={!board ? t('站到踏板上才能探身', 'Stand on the running board first') : !moving ? t('车开起来才能探身', 'Lean out once the car is moving') : undefined}
      onPointerDown={press(true)} onPointerUp={press(false)} onPointerCancel={press(false)} onContextMenu={e => e.preventDefault()}
    >
      <Camera size={15} aria-hidden /> {keys ? t('按住 L 探身', 'Hold L to lean out') : t('按住探身', 'Hold to lean out')}
    </button>
  );
  const flashEl = flashing && typeof document !== 'undefined' ? createPortal(<div className="ob-play-flash" aria-hidden />, document.body) : null;
  void ride;

  if (!r) {
    return (
      <span className="ob-play-pad">
        <button type="button" className="ob-btn ob-btn-sm ob-play-riff-go" onClick={() => { startRiff(); }}>
          <BellRing size={15} aria-hidden /> {t('铃声对答', 'Bell riff')}
        </button>
        {leanBtn}
        {flashEl}
      </span>
    );
  }
  const now = audioNow(), tt = now - r.t0;
  const free = r.phase === 'free';
  const at = (s: number) => `${Math.max(0, Math.min(100, (s / SPAN) * 100))}%`;
  return (
    <span className={`ob-play-pad is-riff is-${r.phase}`}>
      {free ? (
        <span className="ob-play-riff-free" aria-live="polite">
          <span className="ob-play-riff-meter"><i ref={meterRef} style={{ width: `${Math.min(100, (tt / GROOVE_SECONDS) * 100)}%` }} /></span>
          <b>{t('即兴', 'Jazz')} {r.jazzSlots.size}</b>
        </span>
      ) : (
        <span className="ob-play-riff-track" aria-label={t(r.phase === 'call' ? '听……' : '到你了！', r.phase === 'call' ? 'Listen…' : 'Your turn!')}>
          <span className="ob-play-riff-bar is-call" />
          <span className="ob-play-riff-bar is-answer" />
          {callTimes(r.round).map((s, i) => <i key={`c${i}`} className={`ob-play-riff-dot is-call${tt >= s ? ' is-on' : ''}`} style={{ left: at(s) }} />)}
          {answerTimes(r.round).map((s, i) => <i key={`a${i}`} className={`ob-play-riff-dot is-answer${r.hitNow.has(i) ? ' is-hit' : tt > s + 0.2 ? ' is-miss' : ''}`} style={{ left: at(s) }} />)}
          <em ref={cursorRef} className="ob-play-riff-cursor" style={{ left: at(tt) }} />
          <small>{r.phase === 'call' ? t('听', 'Listen') : t('到你了', 'You')} · {r.round + 1}/3</small>
        </span>
      )}
      <button
        type="button" className={`ob-play-bell${r.last && now - r.last.at < 0.18 ? ` is-${r.last.kind}` : ''}`} aria-label={t('摇铃', 'Ring')}
        onPointerDown={e => { e.preventDefault(); tapBell(); }} onContextMenu={e => e.preventDefault()}
      >
        <BellRing size={22} aria-hidden />{keys && <Keycap>H</Keycap>}
      </button>
      <button type="button" className="ob-play-btn is-quiet" onClick={cancelRiff} aria-label={t('停', 'Stop')}><Square size={14} aria-hidden /></button>
      {flashEl}
    </span>
  );
}
