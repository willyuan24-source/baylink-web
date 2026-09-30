import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { useGame } from '../core/store';
import { halloweenPostcard } from '../data/sf/halloweenPostcards';
import { isPaid, ledgerVersion, subscribeLedger } from '../economy/ledger';
import { useT } from '../i18n';
import { BaybayFace } from '../ui/common';
import type { OverlayProps } from '../ui/slots';
import { HALLOWEEN_CARD_GATES, halloweenCardCount } from './playPostcards';
import './halloween.css';

/**
 * Wave 7 · lane G (W7-G1) · a Halloween postcard, earned (the `h-postcard` overlay, halloween/playPostcardRun.ts opens it
 * after BAYBAY's bubble at the moment): the city postcard reward's look (opus-bay.css .ob-reward / .ob-postcard, the
 * same flip), the painting on the front, what it shows and where it is kept on the back. Props `{ id }`.
 */

export interface HalloweenCardProps { id: string }

export default function HalloweenPostcardCard({ props, close }: OverlayProps) {
  const { t } = useT();
  useSyncExternalStore(subscribeLedger, ledgerVersion, ledgerVersion);
  const p = (props ?? {}) as HalloweenCardProps;
  const card = halloweenPostcard(p.id);
  const reduced = useGame(s => s.settings.reducedMotion);
  const [flipped, setFlipped] = useState(false);
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setFlipped(false);
    const timer = window.setTimeout(() => setFlipped(true), reduced ? 50 : 1400);
    keep.current?.focus({ preventScroll: true });
    return () => window.clearTimeout(timer);
  }, [p.id, reduced]);
  // (Esc closes it through ui/Overlay's closeTopOverlay; Enter / Space press the focused 收进手帐)
  if (!card) return null;
  const count = halloweenCardCount(isPaid);
  const total = HALLOWEEN_CARD_GATES.length;
  return (
    <div className="ob-reward ob-hw-reward" role="dialog" aria-modal="true" aria-label={t(card.title)} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="ob-burst" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div>
      <p className="ob-reward-kicker ob-hw-kicker"><Sparkles size={16} aria-hidden />{t(`万圣节明信片！${count}/${total}`, `Halloween postcard! ${count}/${total}`)}</p>
      <button type="button" className={`ob-postcard ${flipped ? 'is-flipped' : ''}`} onClick={() => setFlipped(f => !f)} aria-label={t('翻面', 'Flip card')}>
        <span className="ob-postcard-face front">
          <img className="ob-postcard-img" src={card.large} srcSet={`${card.small} 600w, ${card.large} 1200w`} sizes="(max-width: 720px) 86vw, 460px" alt={t(card.alt)} draggable={false} decoding="async" />
          <span className="ob-postcard-caption">{t(card.title)}</span>
        </span>
        <span className="ob-postcard-face back">
          <span className="ob-postcard-message">
            <strong>{t(card.title)}</strong>
            <span className="ob-postcard-fact">{t(card.alt)}</span>
            <span className="ob-hw-kept">{t('万圣节限定 · 收在手帐「发现」页', 'Halloween only · kept in the notebook’s Finds page')}</span>
          </span>
          <span className="ob-postcard-address" aria-hidden>
            <span className="ob-postcard-stamp ob-hw-stamp"><BaybayFace mood="proud" size={48} /></span>
            <span className="ob-postcard-postmark">HALLOWEEN · SF</span>
            <span className="ob-postcard-lines"><i /><i /><i /></span>
          </span>
        </span>
      </button>
      <div className="ob-actions is-center">
        <button ref={keep} type="button" className="ob-btn ob-btn-gold" onClick={close}><Check size={18} aria-hidden /><span>{t('收进手帐', 'Keep it')}</span></button>
      </div>
      <p className="ob-reward-note">{t('明信片是游戏里的收藏品，万圣节的四张都收在手帐里。', 'Postcards are game collectibles — all four Halloween cards live in the notebook.')}</p>
    </div>
  );
}
