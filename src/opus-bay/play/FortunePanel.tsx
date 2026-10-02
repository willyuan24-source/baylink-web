import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { playSound } from '../audio/hooks';
import { useGame } from '../core/store';
import { useT } from '../i18n';
import type { OverlayProps } from '../ui/slots';
import { FORTUNE_WORK_MS, fortunePanelGone, fortunePanelUp, type Fortune } from './fortune';
import { FORTUNE_NAME } from './sfgamesLines';
import './sfgames.css';

/**
 * Wave 7 · lane M · the fortune-teller automaton (overlay 'play-fortune', its own chunk): a little glass booth with a
 * glowing crystal ball and a mechanical hand passing over it; after FORTUNE_WORK_MS a card slides out of the slot — the
 * fortune, a real San Francisco fact and where it comes from. 好的 / ✕ / Esc close it.
 */

export default function FortunePanel({ props, close }: OverlayProps) {
  const { t } = useT();
  // (W9-G-review G-RV-2) Settings pauses the game: the panel hides under the sheet like the wave-8 panels (sfgames8.css)
  const paused = useGame(s => s.paused);
  const p = props as { fortune?: Fortune; n?: number } | undefined;
  const [out, setOut] = useState(false);
  useEffect(() => {
    setOut(false);
    playSound('m-coin');
    const whir = window.setTimeout(() => playSound('m-whir', { gain: 0.7 }), 250);
    const id = window.setTimeout(() => { setOut(true); playSound('m-ding'); }, FORTUNE_WORK_MS);
    return () => { window.clearTimeout(whir); window.clearTimeout(id); };
  }, [p]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.code === 'Escape' || (e.code === 'Enter' && out)) { e.preventDefault(); e.stopPropagation(); close(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [close, out]);
  // however the card goes (好的, ✕, Esc, walking away), the fortune's activity ends with it (a tick later: a StrictMode
  // remount in dev keeps it)
  useEffect(() => { fortunePanelUp(); return () => { fortunePanelGone(); }; }, []);
  const f = p?.fortune;
  if (!f) return null;
  let host = '';
  try { host = new URL(f.source).hostname.replace(/^www\./, ''); } catch { /* keep it empty */ }
  return (
    <div className={`ob-sfg-panel is-fortune${paused ? ' is-paused' : ''}`} role="dialog" aria-label={t(FORTUNE_NAME)}>
      <div className="ob-sfg-head">
        <strong>{t(FORTUNE_NAME)}</strong>
        <button type="button" className="ob-sfg-x" onClick={close} aria-label={t('关闭', 'Close')}><X size={20} /></button>
      </div>
      <div className={`ob-sfg-booth${out ? ' is-out' : ''}`} aria-hidden="true">
        <svg viewBox="0 0 120 96" width="100%" height="100%">
          <rect x="14" y="4" width="92" height="84" rx="10" fill="#6b2f3a" stroke="#3b2a20" strokeWidth="2" />
          <rect x="22" y="16" width="76" height="52" rx="6" fill="#23363b" />
          {Array.from({ length: 9 }, (_, i) => <circle key={i} className="ob-sfg-bulb" style={{ animationDelay: `${(i % 3) * 0.25}s` }} cx={22 + i * 9.5} cy="10" r="2.2" fill="#ffd98a" />)}
          <path d="M40 66 Q60 38 80 66 Z" fill="#8a5c7a" />
          <circle cx="60" cy="42" r="9" fill="#f1d9b8" stroke="#3b2a20" strokeWidth="1.2" />
          <path d="M50 38 Q60 26 70 38 Q60 33 50 38 Z" fill="#c34a33" />
          <circle cx="56.5" cy="43" r="1.2" fill="#3b2a20" /><circle cx="63.5" cy="43" r="1.2" fill="#3b2a20" />
          <path d="M57 47 Q60 49 63 47" stroke="#3b2a20" strokeWidth="1" fill="none" />
          <circle className="ob-sfg-ball" cx="60" cy="61" r="7" fill="#bfe6ea" stroke="#3b2a20" strokeWidth="1" />
          <g className="ob-sfg-hand"><rect x="66" y="52" width="12" height="4" rx="2" fill="#f1d9b8" stroke="#3b2a20" strokeWidth="1" /></g>
          <rect x="44" y="76" width="32" height="4" rx="2" fill="#23363b" />
        </svg>
      </div>
      {out ? (
        <div className="ob-sfg-card" role="status" aria-live="polite">
          <small>{t('算命婆婆说：', 'The fortune teller says:')}</small>
          <strong>{t(f.luck)}</strong>
          <p>{t(f.fact)}</p>
          {host && <small className="ob-sfg-src">{t('资料', 'Source')}: {host}</small>}
          <button type="button" className="ob-sfg-btn is-go is-wide" onClick={close}>{t('好的', 'OK')}</button>
        </div>
      ) : <p className="ob-sfg-hint">{t('投币……她的手在水晶球上转……', 'A quarter in… her hand circles the crystal ball…')}</p>}
    </div>
  );
}
