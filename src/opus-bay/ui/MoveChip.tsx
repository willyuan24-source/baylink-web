import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { Armchair, Bike, Bird, Bus, CableCar, CarFront, Ship, TrainFront, TramFront } from 'lucide-react';
import { glideUnlocked, requestHopOff, subscribeGlide } from '../actors/moveApi';
import { input } from '../core/input';
import { useGame } from '../core/store';
import { useFlow } from '../game/flowStore';
import { useT } from '../i18n';
import { Keycap } from './common';
import { useDevice } from './hooks';
import { hopOffNote } from './rideHop';
import { spotActionLabel } from './spotLabel';

/**
 * Lane E2 owns this file from wave 2 (day 0 moved it out of ui/Hud.tsx verbatim; Hud renders <MoveChip />).
 *
 * Transit (wave 3, DR-1): `move.mode` is 'transit' from the moment you ask for a ride, so the chip follows lane F's
 * `flow.ride.stage` — 'waiting' (and a turning cable car) shows the waiting chip with Cancel, 'braking' says the car is
 * stopping, 'riding' the on-board keys. The glyph follows the ride kind (streetcar / cable car / ferry). Cancel and
 * Hop off go through moveApi.requestHopOff, the same path as Space / pad B (E2-10 brakes a moving car first).
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
  // the MoveSystem's own flag (viewpoint, ?debug, or G1's save restore via moveApi.setGlideUnlocked)
  const unlocked = useSyncExternalStore(subscribeGlide, glideUnlocked, glideUnlocked);
  const ride = useFlow(s => s.ride);
  const dialogue = useGame(s => s.dialogue.nodeId);
  const focus = useGame(s => s.focus);
  const device = useDevice();
  // on board, the hop-off rule follows the vehicle (a ferry docking, a train leaving a tunnel): look twice a second
  const [, setTick] = useState(0);
  const onBoard = mode === 'transit' && !!ride && ride.stage === 'riding';
  useEffect(() => {
    if (!onBoard) return;
    const id = window.setInterval(() => setTick(n => (n + 1) % 1e6), 500);
    return () => window.clearInterval(id);
  }, [onBoard]);
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
  if (mode === 'sit') return chip(<Armchair size={20} aria-hidden />, t('坐着歇会儿', 'Taking a seat'), <Hint k={pad ? 'A' : 'E'} label={t('起身', 'Stand up')} onPress={() => { input.interactCount++; }} />);
  if (mode === 'transit') {
    const kind = ride?.kind ?? 'streetcar';
    const icon = kind === 'cable-car' ? <CableCar size={20} aria-hidden /> : kind === 'ferry' ? <Ship size={20} aria-hidden /> : kind === 'bus' ? <Bus size={20} aria-hidden /> : kind === 'light-rail' ? <TrainFront size={20} aria-hidden /> : <TramFront size={20} aria-hidden />;
    // DR-1: still at the stop (or the car is turning on its turntable) — not on board yet
    if (!ride || ride.stage === 'waiting' || ride.stage === 'turning') {
      const name = kind === 'cable-car' ? t('等缆车', 'Waiting for the cable car') : kind === 'ferry' ? t('等渡轮', 'Waiting for the ferry') : kind === 'bus' ? t('等观光巴士', 'Waiting for the bus') : kind === 'light-rail' ? t('等地铁', 'Waiting for the train') : t('等电车', 'Waiting for the streetcar');
      return chip(icon, name, <Hint k={pad ? 'B' : 'Space'} label={t('不坐了', 'Cancel')} onPress={requestHopOff} />);
    }
    if (ride.stage === 'braking') return chip(icon, t('停车中…', 'Stopping…'), null);
    const note = hopOffNote(ride, {});
    // (W6-K1, lane T's review) aboard the ferry the chip says 船上 (you are on its deck, not in a carriage) and 下船
    const ferry = kind === 'ferry';
    return chip(icon, ferry ? t('船上', 'On deck') : t('车厢里', 'On board'), <>
      <Hint k={pad ? 'A' : 'E'} label={t(spotActionLabel(spot, kind))} onPress={() => { input.interactCount++; }} />
      {!pad && <Hint k="WASD" label={kind === 'ferry' ? t('走走甲板', 'Walk the deck') : t('车厢里走走', 'Walk the aisle')} />}
      {/* wave 4 (lane F review, lane T review open 1): under way / in a tunnel the key says why it waits */}
      {note ? <Hint k={pad ? 'B' : 'Space'} label={t(note)} /> : <Hint k={pad ? 'B' : 'Space'} label={ferry ? t('下船', 'Go ashore') : t('下车', 'Hop off')} onPress={requestHopOff} />}
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
