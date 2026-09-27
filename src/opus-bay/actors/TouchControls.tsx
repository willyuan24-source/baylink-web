import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Bell, Bird, LogOut, Megaphone, PlaneLanding } from 'lucide-react';
import { input } from '../core/input';
import { useGame } from '../core/store';
import { readQa } from '../game/qa';
import { useT } from '../i18n';
import { useDevice } from '../ui/hooks';
import { setStickRenderer, stickView } from './pointer';

/**
 * Touch overlay: the floating joystick (appears where the left thumb lands, follows it past the rim).
 * Onboarding hints (the gesture coach mark) belong to flow-ui (ui/CoachMark, contract C6).
 * The gestures themselves live on the canvas (actors/pointer.ts) so taps still reach R3F for tap-to-walk;
 * this component only paints, via direct style writes (no React state per move).
 * The contextual action button is the HUD's (ui/Hud.tsx) — it also offers "骑上单车 / 坐进小车" near a parked toy.
 *
 * Movement buttons (plan §6.10, touch only, right edge above the action button, ≥ 44 px): 下车 while riding, the
 * bell / horn (56 px), 起飞 once the glide is unlocked and 降落 while gliding. In a vehicle the stick is throttle (up),
 * brake / reverse (down) and steering (sideways).
 */

const base: CSSProperties = {
  position: 'absolute', left: 0, top: 0, width: 112, height: 112, marginLeft: -56, marginTop: -56, borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(255,250,241,.18) 0%, rgba(255,250,241,.34) 62%, rgba(255,250,241,.5) 100%)',
  border: '2px solid rgba(255,255,255,.75)', boxShadow: '0 10px 26px -12px rgba(40,30,15,.45), inset 0 0 0 1px rgba(47,143,136,.18)',
  pointerEvents: 'none', opacity: 0, transition: 'opacity .16s ease', willChange: 'transform, opacity', zIndex: 3,
};
const knob: CSSProperties = {
  position: 'absolute', left: 56, top: 56, width: 50, height: 50, marginLeft: -25, marginTop: -25, borderRadius: '50%',
  background: 'radial-gradient(circle at 35% 30%, #fffaf1 0%, #f3e6cc 70%, #e6d3ae 100%)', border: '2px solid #fff',
  boxShadow: '0 6px 14px -6px rgba(40,30,15,.55)', willChange: 'transform',
};
const column: CSSProperties = {
  position: 'absolute', right: 'calc(18px + var(--ob-sr))', bottom: 'calc(150px + var(--ob-sb))', display: 'flex', flexDirection: 'column',
  alignItems: 'center', gap: 14, zIndex: 4, pointerEvents: 'none',
};
const btn = (size: number, tone: 'teal' | 'cream' | 'gold'): CSSProperties => ({
  width: size, height: size, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
  border: '3px solid rgba(255,255,255,.92)', pointerEvents: 'auto', touchAction: 'manipulation', font: 'inherit', fontSize: 11, fontWeight: 800,
  color: tone === 'cream' ? 'var(--ob-ink)' : tone === 'gold' ? '#2b2210' : '#fff',
  background: tone === 'teal' ? 'var(--ob-teal)' : tone === 'gold' ? 'var(--ob-gold)' : 'rgba(255, 250, 241, .96)',
  boxShadow: '0 10px 22px -10px rgba(31, 60, 55, .7)',
});

function Btn({ size, tone, label, onPress, children }: { size: number; tone: 'teal' | 'cream' | 'gold'; label: string; onPress: () => void; children: ReactNode }) {
  // pointerdown (not click): a thumb on the stick must not delay the press
  return (
    <button type="button" aria-label={label} style={btn(size, tone)} onPointerDown={e => { e.stopPropagation(); onPress(); }}>
      {children}<span style={{ lineHeight: 1 }}>{label}</span>
    </button>
  );
}

function MoveButtons() {
  const { t } = useT();
  const mode = useGame(s => s.move.mode);
  const unlocked = useGame(s => s.viewpointUnlocked) || readQa().debug;
  const dialogue = useGame(s => s.dialogue.nodeId);
  const panel = useGame(s => s.panel.kind);
  const focus = useGame(s => s.focus);
  if (dialogue || panel) return null;
  const riding = mode === 'bike' || mode === 'car';
  return (
    <div style={column}>
      {riding && (
        <Btn size={56} tone="cream" label={mode === 'bike' ? t('按铃', 'Bell') : t('喇叭', 'Horn')} onPress={() => { input.hornCount++; }}>
          {mode === 'bike' ? <Bell size={22} aria-hidden /> : <Megaphone size={22} aria-hidden />}
        </Btn>
      )}
      {riding && <Btn size={64} tone="teal" label={t('下车', 'Get off')} onPress={() => { input.vehicleCount++; }}><LogOut size={24} aria-hidden /></Btn>}
      {mode === 'glide' && <Btn size={64} tone="teal" label={t('降落', 'Land')} onPress={() => { input.glideCount++; }}><PlaneLanding size={24} aria-hidden /></Btn>}
      {mode === 'foot' && unlocked && !focus && <Btn size={52} tone="gold" label={t('起飞', 'Glide')} onPress={() => { input.glideCount++; }}><Bird size={20} aria-hidden /></Btn>}
    </div>
  );
}

export function TouchControls() {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const device = useDevice();

  useEffect(() => {
    setStickRenderer(() => {
      const b = baseRef.current, k = knobRef.current;
      if (!b || !k) return;
      b.style.opacity = stickView.active ? '1' : '0';
      b.style.transform = `translate3d(${stickView.baseX.toFixed(1)}px, ${stickView.baseY.toFixed(1)}px, 0)`;
      k.style.transform = `translate3d(${stickView.knobX.toFixed(1)}px, ${stickView.knobY.toFixed(1)}px, 0)`;
    });
    return () => setStickRenderer(null);
  }, []);

  return (
    <>
      <div ref={baseRef} className="ob-stick" style={base} aria-hidden>
        <div ref={knobRef} className="ob-stick-knob" style={knob} />
      </div>
      {device === 'touch' && <MoveButtons />}
    </>
  );
}
