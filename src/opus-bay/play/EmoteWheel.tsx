import { Camera, Hand, Music2, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { charApi } from '../actors/charApi';
import { emit } from '../core/events';
import { useT } from '../i18n';
import { Keycap } from '../ui/common';
import { useDevice, useWindowKey } from '../ui/hooks';
import type { OverlayProps } from '../ui/slots';
import { doEmote, WHEEL, type WheelEmote } from './emotes';
import './play.css';

/**
 * Wave 5 · lane A · the emote wheel (overlay 'play-emotes', W5-A2): four slots round the middle of the screen — 挥手 ·
 * 跳舞 · 躺草地 · 自拍 —; phones open it by tapping your own character (lane F's `self-tap`) or from 问 BAYBAY, desktop
 * with T, then 1–4 (or a click). A tap outside, ✕, Escape or T again closes it. A slot that needs lane F's body
 * animations (dance, lie) is dimmed until actors/charApi is registered.
 */

function LieIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="6" cy="11" r="2.4" />
      <path d="M9.5 12.5h8.5a2.5 2.5 0 0 1 2.5 2.5v1" /><path d="M3 17.5h18" /><path d="M12 9c1-2.2 3.2-3 5-2.2" />
    </svg>
  );
}

const ICONS: Record<WheelEmote, LucideIcon | typeof LieIcon> = { wave: Hand, dance: Music2, lie: LieIcon, selfie: Camera };

export default function EmoteWheel({ close }: Pick<OverlayProps, 'close'>) {
  const { t } = useT();
  const device = useDevice();
  const [ready, setReady] = useState(() => !!charApi());
  const mountedAt = useRef(Infinity);
  useEffect(() => {
    mountedAt.current = performance.now();
    emit({ type: 'ui', action: 'open' });
    // lane F registers charApi once the actors are up: re-check while the wheel is open
    const id = window.setInterval(() => setReady(!!charApi()), 500);
    return () => window.clearInterval(id);
  }, []);
  const pick = (id: WheelEmote) => {
    close();
    if (!doEmote(id)) emit({ type: 'ui', action: 'error' });
  };
  useWindowKey(e => {
    // (a key pressed before the wheel was on screen is not for it)
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.timeStamp < mountedAt.current) return;
    const slot = WHEEL.find(s => e.code === `Digit${s.key}` || e.code === `Numpad${s.key}`);
    if (slot) {
      e.preventDefault();
      e.stopPropagation();
      if (slot.needsChar && !ready) return;
      pick(slot.id);
    } else if (e.code === 'KeyT') { e.preventDefault(); close(); }
  });
  return (
    <div className="ob-play-wheel-wrap" onPointerDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="ob-play-wheel" role="menu" aria-label={t('做个动作', 'Emotes')}>
        {WHEEL.map((slot, i) => {
          const Icon = ICONS[slot.id];
          const off = slot.needsChar && !ready;
          return (
            <button key={slot.id} type="button" role="menuitem" className={`ob-play-slot at-${i}`} aria-disabled={off || undefined} onClick={() => { if (!off) pick(slot.id); }}>
              <Icon size={26} />
              <span>{t(slot.label)}</span>
              {device === 'keyboard' && <Keycap className="ob-play-slot-key">{slot.key}</Keycap>}
            </button>
          );
        })}
        <button type="button" className="ob-play-wheel-close" onClick={close} aria-label={t('关闭', 'Close')}><X size={20} /></button>
      </div>
    </div>
  );
}
