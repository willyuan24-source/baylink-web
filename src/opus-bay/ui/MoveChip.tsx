import type { CSSProperties, ReactNode } from 'react';
import { Armchair, Bike, Bird, CarFront, TramFront } from 'lucide-react';
import { input } from '../core/input';
import { useGame } from '../core/store';
import { readQa } from '../game/qa';
import { useT } from '../i18n';
import { Keycap } from './common';
import { useDevice } from './hooks';

/**
 * Lane E2 owns this file from wave 2 (day 0 moved it out of ui/Hud.tsx verbatim; Hud renders <MoveChip />).
 */

// ---------------------------------------------------------------------------
// Movement mode chip (lane E): which mode you are in + its keys, and the glide button once it is unlocked.
// Keyboard / gamepad only — touch gets big buttons in actors/TouchControls. Clicking a hint does what the key does.
// ---------------------------------------------------------------------------

const chipStyle: CSSProperties = {
  position: 'absolute', left: '50%', bottom: 'calc(26px + var(--ob-sb))', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10,
  minHeight: 48, padding: '0 8px 0 14px', borderRadius: 999, color: '#fff', background: 'rgba(28, 44, 41, .86)', border: '1px solid rgba(255,255,255,.14)',
  boxShadow: '0 14px 30px -12px rgba(20, 30, 28, .6)', whiteSpace: 'nowrap', maxWidth: 'calc(100% - 40px)', pointerEvents: 'auto',
};
const hintStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 10px', borderRadius: 999, border: 0, background: 'rgba(255,255,255,.1)',
  color: '#fff', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const glideStyle: CSSProperties = {
  position: 'absolute', left: 'calc(18px + var(--ob-sl))', bottom: 'calc(26px + var(--ob-sb))', display: 'flex', alignItems: 'center', gap: 8, minHeight: 44,
  padding: '0 14px 0 8px', borderRadius: 999, border: '1px solid var(--ob-line)', background: 'rgba(255, 250, 241, .95)', color: 'var(--ob-ink)',
  boxShadow: 'var(--ob-shadow-s)', font: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', pointerEvents: 'auto',
};

function Hint({ k, label, onPress }: { k: string; label: string; onPress?: () => void }) {
  const body = <><Keycap className="ob-context-key">{k}</Keycap><span>{label}</span></>;
  return onPress
    ? <button type="button" style={hintStyle} onClick={onPress}>{body}</button>
    : <span style={{ ...hintStyle, cursor: 'default', background: 'transparent', padding: '0 4px' }}>{body}</span>;
}

export function MoveChip() {
  const { t } = useT();
  const mode = useGame(s => s.move.mode);
  const spot = useGame(s => s.move.spot);
  const unlocked = useGame(s => s.viewpointUnlocked) || readQa().debug;
  const dialogue = useGame(s => s.dialogue.nodeId);
  const focus = useGame(s => s.focus);
  const device = useDevice();
  if (device === 'touch' || dialogue) return null;
  const pad = device === 'gamepad';
  const exit = () => { input.vehicleCount++; };
  const glide = () => { input.glideCount++; };
  const horn = () => { input.hornCount++; };
  const chip = (icon: ReactNode, name: string, hints: ReactNode) => (
    <div style={chipStyle} role="status" aria-live="polite">
      {icon}<strong style={{ fontSize: 14.5 }}>{name}</strong>{hints}
    </div>
  );
  if (mode === 'bike' || mode === 'car') {
    const bike = mode === 'bike';
    return chip(bike ? <Bike size={20} aria-hidden /> : <CarFront size={20} aria-hidden />, bike ? t('骑车中', 'Riding') : t('开小车', 'Driving'), <>
      <Hint k={pad ? 'Y' : 'F'} label={t('下车', 'Get off')} onPress={exit} />
      <Hint k={pad ? 'LB' : 'H'} label={bike ? t('按铃', 'Bell') : t('喇叭', 'Horn')} onPress={horn} />
      {!pad && <Hint k="Space" label={t('跳一下', 'Hop')} />}
      {!pad && !bike && <Hint k="R" label={t('回到路上', 'Back on the road')} />}
      {!pad && bike && <Hint k="Shift" label={t('冲刺', 'Sprint')} />}
    </>);
  }
  if (mode === 'glide') {
    return chip(<Bird size={20} aria-hidden />, t('鹈鹕滑翔', 'Pelican glide'), <>
      {!pad && <Hint k="W/S" label={t('升降', 'Climb / dive')} />}
      <Hint k={pad ? 'RB' : 'Shift'} label={t('加速', 'Faster')} />
      <Hint k={pad ? 'L3' : 'G'} label={t('降落', 'Land')} onPress={glide} />
    </>);
  }
  if (mode === 'sit') return chip(<Armchair size={20} aria-hidden />, t('坐着歇会儿', 'Taking a seat'), <Hint k={pad ? '←→' : 'E'} label={t('起身', 'Stand up')} onPress={() => { input.interactCount++; }} />);
  if (mode === 'transit') {
    return chip(<TramFront size={20} aria-hidden />, t('车厢里', 'On board'), <>
      <Hint k={pad ? 'A' : 'E'} label={spot === 'seat' ? t('站起来', 'Stand') : t('坐下', 'Sit down')} onPress={() => { input.interactCount++; }} />
      {!pad && <Hint k="WASD" label={t('车厢里走走', 'Walk the aisle')} />}
      <Hint k={pad ? 'B' : 'Space'} label={t('下车', 'Hop off')} />
    </>);
  }
  // on foot: the glide is ready (never over a context prompt)
  if (mode === 'foot' && unlocked && !focus) {
    return (
      <button type="button" style={glideStyle} onClick={glide} aria-label={t('鹈鹕滑翔（G）', 'Pelican glide (G)')}>
        <Keycap className="ob-context-key">{pad ? 'L3' : 'G'}</Keycap><Bird size={18} aria-hidden />{t('起飞', 'Take off')}
      </button>
    );
  }
  return null;
}
