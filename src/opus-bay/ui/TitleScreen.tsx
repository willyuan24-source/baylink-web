import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject, type RefObject } from 'react';
import { ArrowRight, BookOpen, MapPin, Volume2, VolumeX } from 'lucide-react';
import { emit } from '../core/events';
import { game, useGame } from '../core/store';
import type { Bilingual } from '../core/types';
import { ASSETS, keyArtAlt } from '../data/assets';
import { guidesUrl } from '../data/links';
import { requestResume, resumeSpot } from '../data/save';
import { CITY_COPY } from '../data/sf/copy';
import { useT } from '../i18n';
import { BaybayFace, Keycap } from './common';
import { useDevice, useImageState } from './hooks';
import { LangPills } from './LangPills';

const typing = (el: HTMLElement | null) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
const onControl = (el: HTMLElement | null) => !!el && (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute?.('role') === 'button' || el.getAttribute?.('role') === 'tab');

/**
 * DOM title screen: key art or a brand-diorama fallback. Rendered by OpusBayPage, so it paints before three,
 * R3F and the game chunk load (those start loading once it is up). `onStart` asks the page to start; the game
 * starts as soon as its first frame is ready — until then the Start button shows `waiting`.
 */
export function TitleScreen({ onStart, waiting = false }: { onStart: () => void; waiting?: boolean }) {
  const { t, locale } = useT();
  const sound = useGame(s => s.settings.sound);
  const device = useDevice();
  const startRef = useRef<HTMLButtonElement>(null);
  const keyArt = ASSETS.keyArt;
  // Optimistic: paint the key art right away (no fallback flash); switch to the CSS diorama only if it fails.
  const artOk = useImageState(keyArt?.wide) !== 'error';
  const returning = useVisited();
  // city mode: lane G2's subtitle (data/sf/copy.ts, dependency-free); null keeps the district line
  const city = useGame(s => s.worldMode === 'city');
  const citySub = city ? CITY_COPY.titleSub : null;
  // G2's optional city greeting (sf-w2-G2 request to G1): shown as soon as data/sf/copy.ts has a `greet` line
  const cityGreet = city ? (CITY_COPY as { greet?: Bilingual | null }).greet ?? null : null;
  // lane G1 (G1-10): a saved city spot (data/save.ts only: the title chunk stays small). W5-N6 (plan MF6): then the
  // primary 继续旅程 resumes there (Enter too); the secondary starts over at the Ferry Building (progress kept)
  const resume = city ? resumeSpot('city') : null;
  const primary = useMemo(() => (resume ? () => { requestResume(); onStart(); } : onStart), [resume, onStart]);
  // lang-review: the pills stay under the pointer through a language switch (usePillsInPlace)
  const cardRef = useRef<HTMLDivElement>(null);
  const clickedAtRef = useRef<number | null>(null);
  usePillsInPlace(cardRef, clickedAtRef, locale);
  const beforeSwitch = useCallback(() => { clickedAtRef.current = pillsY(cardRef.current); }, []);

  useEffect(() => { startRef.current?.focus({ preventScroll: true }); }, []);
  // Enter / Space start from anywhere on the title (not while on another control)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (typing(el) || (e.code !== 'Enter' && e.code !== 'Space')) return;
      if (!onControl(el) || !!el?.closest('.ob-title-start')) { e.preventDefault(); primary(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [primary]);

  const toggleSound = () => {
    game.set(s => ({ settings: { ...s.settings, sound: !s.settings.sound, music: !s.settings.sound ? s.settings.music : false } }));
    emit({ type: 'ui', action: 'select' });
  };

  return (
    <div className={`ob-title ${keyArt && artOk ? 'has-art' : 'is-fallback'}`}>
      {keyArt && artOk ? (
        <picture className="ob-title-art">
          <source media="(max-aspect-ratio: 4/5)" srcSet={keyArt.tallSrcSet || keyArt.tall} sizes="100vw" />
          <img src={keyArt.wide} srcSet={keyArt.wideSrcSet || undefined} sizes="100vw" alt={keyArtAlt(locale)} draggable={false} decoding="async" />
        </picture>
      ) : (
        <div className="ob-title-fallback" aria-hidden>
          <span className="ob-title-sun" />
          <span className="ob-cloud c1" /><span className="ob-cloud c2" /><span className="ob-cloud c3" />
          <svg className="ob-title-gulls" viewBox="0 0 120 40"><path d="M10 20q6-7 12 0q6-7 12 0" /><path d="M58 10q4-5 8 0q4-5 8 0" /><path d="M90 26q5-6 10 0q5-6 10 0" /></svg>
          <img className="ob-title-diorama" src="/brand/bay-area-diorama-v2.webp" alt="" draggable={false} />
          <span className="ob-title-table-shadow" />
        </div>
      )}
      <div className="ob-title-card" ref={cardRef}>
        <span className="ob-title-mark">Opus Bay · BAYLINK</span>
        <h1 className="ob-title-h1">{t('湾区小旅', 'Little Bay Trip')}</h1>
        <p className="ob-title-sub">{citySub ? t(citySub) : t('跟 BAYBAY 从渡轮大厦走到 PIER 39：真实景点、这周活动，边玩边查。', 'Walk the Embarcadero with BAYBAY, from the Ferry Building to Pier 39 — real places, this week’s events, all playable.')}</p>
        <div className="ob-title-greet">
          <BaybayFace mood="wave" size={52} />
          <p>{returning || resume ? t('欢迎回来！接着逛吗？', 'Welcome back! Shall we keep exploring?') : cityGreet ? t(cityGreet) : t('嗨～第一次来湾区吗？我带你逛！', 'Hi! First time in the Bay? I’ll show you around!')}</p>
        </div>
        {/* the language before Start (简体 · 繁體 · English): a tap switches the title at once, saved for the site */}
        <LangPills onSwitch={beforeSwitch} />
        <div className="ob-title-actions">
          <button ref={startRef} type="button" className="ob-btn ob-btn-primary ob-btn-xl ob-title-start" onClick={primary} aria-busy={waiting || undefined}>
            <span>{returning || resume ? t('继续旅程', 'Continue') : t('开始', 'Start')}</span>
            {waiting ? <span className="ob-boot-dot" style={{ background: 'currentColor' }} aria-hidden /> : device === 'touch' ? <ArrowRight size={20} aria-hidden /> : <Keycap className="on-dark">Enter</Keycap>}
          </button>
          {resume && (
            <button type="button" className="ob-btn ob-btn-ghost ob-btn-xl ob-title-resume" onClick={onStart}>
              <MapPin size={18} aria-hidden /><span>{t('从头开始 · 渡轮大厦', 'Start over · Ferry Building')}</span>
            </button>
          )}
          <button type="button" className="ob-icon-btn ob-title-sound" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? t('关闭声音', 'Mute sound') : t('打开声音', 'Turn sound on')} title={sound ? t('声音：开', 'Sound: on') : t('声音：关', 'Sound: off')}>
            {sound ? <Volume2 size={22} aria-hidden /> : <VolumeX size={22} aria-hidden />}
          </button>
        </div>
        <a className="ob-title-link" href={guidesUrl(locale)}>
          <BookOpen size={16} aria-hidden />{t('不玩了，直接看攻略', 'Skip the game — read the guides')}<ArrowRight size={15} aria-hidden />
        </a>
        <p className="ob-title-hint">{device === 'touch' ? t('点地面走路 · 点发光的东西互动', 'Tap the ground to walk · tap glowing things to use them') : t('WASD 移动 · E 互动 · Q 问 BAYBAY · M 地图', 'WASD move · E interact · Q ask BAYBAY · M map')}</p>
      </div>
    </div>
  );
}

/**
 * lang-review · a language switch re-flows the title card: English runs longer (a two-line title, one more line of the
 * subtitle and of the greeting) and a desktop centres the card, so the pills just clicked jumped ≈ 60 px from under the
 * pointer (1440 × 900: from y 469 to 528 — a second click on the same spot hit the greeting). The pills stay where they
 * were clicked: the card is moved (it is position: relative; `top`) by the difference, as far as the title has room; a
 * resize lets it settle where the layout puts it. Phones dock the card at the bottom: the difference is 0 there.
 * Layout positions (offsetTop), not the screen's: the card's entrance animation is a transform. `clickedAtRef`: the pills' y
 * when a pill was clicked (TitleScreen's `beforeSwitch`, LangPills `onSwitch`); a switch from elsewhere moves nothing.
 */
function usePillsInPlace(cardRef: RefObject<HTMLDivElement | null>, clickedAtRef: MutableRefObject<number | null>, locale: string) {
  useLayoutEffect(() => {
    const card = cardRef.current, before = clickedAtRef.current, now = pillsY(card);
    clickedAtRef.current = null;
    if (!card || before === null || now === null || now === before) return;
    const room = card.offsetParent instanceof HTMLElement ? card.offsetParent.clientHeight : Infinity;
    const shift = Math.max(-card.offsetTop, Math.min(room - card.offsetTop - card.offsetHeight, before - now));
    card.style.top = `${(parseFloat(card.style.top) || 0) + shift}px`;
  }, [cardRef, clickedAtRef, locale]);
  useEffect(() => {
    const settle = () => { if (cardRef.current) cardRef.current.style.top = ''; };
    window.addEventListener('resize', settle);
    return () => window.removeEventListener('resize', settle);
  }, [cardRef]);
}

/** The language pills' top in the title's layout (px from the title's top edge), null before they are laid out. */
function pillsY(card: HTMLElement | null): number | null {
  const pills = card?.querySelector<HTMLElement>('.ob-lang');
  return card && pills ? card.offsetTop + pills.offsetTop : null;
}

function useVisited() {
  const done = useGame(s => s.tour.completed.length + s.postcards.length);
  return done > 0;
}
