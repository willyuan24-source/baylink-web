import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Mood } from '../core/types';
import { game, useGame } from '../core/store';
import { useT } from '../i18n';
import { portraitSrc, useIsMobile } from './hooks';

// ---------------------------------------------------------------------------
// BAYBAY portrait (asset if present, otherwise a drawn SVG face that follows the brand avatar)
// ---------------------------------------------------------------------------


export function BaybayFace({ mood = 'happy', size = 96, className = '', title }: { mood?: Mood; size?: number; className?: string; title?: string }) {
  const src = portraitSrc('baybay', mood);
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    // The portraits are full-body; small avatars zoom onto the head so BAYBAY stays readable at 28–64 px.
    if (size <= 64) {
      return (
        <span className={`ob-face ob-face-crop ${className}`} style={{ width: size, height: size }} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
          <img src={src} alt="" onError={() => setFailed(true)} draggable={false} decoding="async" />
        </span>
      );
    }
    return <img className={`ob-face ${className}`} src={src} width={size} height={size} alt={title ?? ''} onError={() => setFailed(true)} draggable={false} decoding="async" />;
  }
  const eyes = mood === 'proud' || mood === 'excited'
    ? <g stroke="#1d2624" strokeWidth="3.4" strokeLinecap="round" fill="none"><path d="M35 47q4-5 8 0" /><path d="M57 47q4-5 8 0" /></g>
    : mood === 'thinking'
      ? <g fill="#1d2624"><circle cx="40" cy="45" r="4" /><circle cx="61" cy="45" r="4" /><circle cx="41.4" cy="43.4" r="1.3" fill="#fff" /><circle cx="62.4" cy="43.4" r="1.3" fill="#fff" /></g>
      : <g fill="#1d2624"><circle cx="39" cy="47" r="4.4" /><circle cx="61" cy="47" r="4.4" /><circle cx="40.6" cy="45.3" r="1.5" fill="#fff" /><circle cx="62.6" cy="45.3" r="1.5" fill="#fff" /></g>;
  const mouth = mood === 'excited' || mood === 'wave'
    ? <g><path d="M42 62q8 10 16 0z" fill="#3a2522" /><path d="M45.5 65.5q4.5 4 9 0q-4.5-2.2-9 0z" fill="#f08a8a" /></g>
    : mood === 'thinking'
      ? <path d="M45 64q5 1.5 10-1" stroke="#3a2522" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      : <path d="M42.5 61.5q3.8 5 7.5 1q3.7 4 7.5-1" stroke="#3a2522" strokeWidth="2.6" fill="none" strokeLinecap="round" />;
  return (
    <svg className={`ob-face ${className}`} width={size} height={size} viewBox="0 0 100 100" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <circle cx="50" cy="50" r="50" fill="#2f8f88" />
      <circle cx="50" cy="50" r="46" fill="#3aa39a" opacity=".35" />
      <path d="M8 78q20-14 42-10t42 6v26H8z" fill="#fbf7ef" />
      <ellipse cx="20" cy="36" rx="7" ry="6" fill="#fbf7ef" /><ellipse cx="80" cy="36" rx="7" ry="6" fill="#fbf7ef" />
      <ellipse cx="20.5" cy="36.5" rx="3.4" ry="3" fill="#e9c9bf" /><ellipse cx="79.5" cy="36.5" rx="3.4" ry="3" fill="#e9c9bf" />
      <ellipse cx="50" cy="52" rx="33" ry="29" fill="#fbf7ef" />
      <ellipse cx="50" cy="61" rx="15" ry="11" fill="#f3e6cc" />
      {eyes}
      <ellipse cx="50" cy="55.5" rx="5.6" ry="4.2" fill="#1d2624" />
      <ellipse cx="48.6" cy="54.2" rx="1.6" ry="1" fill="#fff" opacity=".7" />
      {mouth}
      <g stroke="#7d8784" strokeWidth="1" strokeLinecap="round" opacity=".75"><path d="M32 58l-13-2" /><path d="M32 61l-13 2" /><path d="M68 58l13-2" /><path d="M68 61l13 2" /></g>
      <circle cx="31" cy="57" r="3.2" fill="#f4b9ad" opacity=".55" /><circle cx="69" cy="57" r="3.2" fill="#f4b9ad" opacity=".55" />
      <path d="M8 86q22-12 42-8t42 4" stroke="#1f8f8a" strokeWidth="9" fill="none" strokeLinecap="round" />
      <circle cx="82" cy="17" r="7" fill="#e8663d" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Keycap hint
// ---------------------------------------------------------------------------

export function Keycap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <kbd className={`ob-key ${className}`}>{children}</kbd>;
}

// ---------------------------------------------------------------------------
// Sheet: side sheet on desktop, draggable bottom sheet (35 / 70 / 100 %) on mobile. World keeps running.
// ---------------------------------------------------------------------------

const SNAPS = [35, 70, 100];

export function Sheet({ title, eyebrow, onClose, children, footer, wide = false, snap = 70, className = '', tone, headerExtra }: {
  title: ReactNode; eyebrow?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; snap?: number; className?: string; tone?: 'gold' | 'teal'; headerExtra?: ReactNode;
}) {
  const { t } = useT();
  const mobile = useIsMobile();
  const reduced = useGame(s => s.settings.reducedMotion);
  const [height, setHeight] = useState(snap);
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => { panelRef.current?.focus({ preventScroll: true }); }, []);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!mobile) return;
    drag.current = { y: e.clientY, h: height, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 4) d.moved = true;
    setHeight(Math.max(12, Math.min(100, d.h - (dy / window.innerHeight) * 100)));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (!d.moved) { setHeight(h => (h >= 99 ? 70 : SNAPS.find(s => s > h + 1) ?? 100)); return; }
    setHeight(h => {
      if (h < 24) { window.setTimeout(onClose, 0); return h; }
      return SNAPS.reduce((best, s) => (Math.abs(s - h) < Math.abs(best - h) ? s : best), SNAPS[0]);
    });
  };

  const style = mobile ? ({ '--ob-sheet-h': `${height}dvh` } as CSSProperties) : undefined;
  return (
    <section
      ref={panelRef}
      className={`ob-sheet ${wide ? 'is-wide' : ''} ${dragging ? 'is-dragging' : ''} ${reduced ? 'is-reduced' : ''} ${tone ? `tone-${tone}` : ''} ${className}`}
      style={style}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={e => { if (e.key === 'Escape' && !game.get().dialogue.nodeId) { e.stopPropagation(); onClose(); } }}
    >
      <header className="ob-sheet-head" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {mobile && <span className="ob-sheet-grip" aria-hidden />}
        <div className="ob-sheet-titles">
          {eyebrow && <span className="ob-eyebrow">{eyebrow}</span>}
          <h2 id={titleId} className="ob-sheet-title">{title}</h2>
        </div>
        {headerExtra}
        <button type="button" className="ob-icon-btn ob-sheet-close" onClick={onClose} aria-label={t('关闭', 'Close')} onPointerDown={e => e.stopPropagation()}>
          <X size={20} aria-hidden />
        </button>
      </header>
      <div className="ob-sheet-body">{children}</div>
      {footer && <footer className="ob-sheet-foot">{footer}</footer>}
    </section>
  );
}

/** External or site link styled as a button. */
export function LinkButton({ href, children, icon, tone = 'ghost', external = false, onClick }: { href: string; children: ReactNode; icon?: ReactNode; tone?: 'primary' | 'ghost' | 'gold' | 'soft'; external?: boolean; onClick?: () => void }) {
  return (
    <a className={`ob-btn ob-btn-${tone}`} href={href} onClick={onClick} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : { target: '_blank', rel: 'noopener' })}>
      {icon}<span>{children}</span>
    </a>
  );
}
