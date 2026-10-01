import { useEffect, useState } from 'react';
import { alightHere, finishRide, subwayView } from '../game/transit';
import { openPanel } from '../game/flow';
import { useFlow } from '../game/flowStore';
import { SubwayOverlay } from './SubwayOverlay';

type View = NonNullable<ReturnType<typeof subwayView>>;

/**
 * Wave 4 · lane T (W4-T11): the subway overlay over the world while the rider's Muni Metro train runs under ground
 * (no tunnel geometry is built). Lazy (ui/Overlay.tsx mounts it only during a light-rail ride); it reads the ride from
 * game/transit.ts `subwayView()` ≈ 12 times a second and keeps the last view for the 0.6 s fade-out as the train
 * surfaces or the rider gets off.
 */
/** W8-Q5: the overlay's 设置 button — the same panel as the HUD's (Settings pauses the game; the sheet shows above the tunnel) */
const openSettings = () => openPanel('settings');

export default function LineRideLayer() {
  const kind = useFlow(s => s.ride?.kind);
  const say = useFlow(s => s.bubble?.text ?? null);
  const [view, setView] = useState<View | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (kind !== 'light-rail') { setOn(false); return; }
    let raf = 0, t0 = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - t0 < 80) return;
      t0 = t;
      const v = subwayView();
      // (the last view stays for the fade-out: `view` is only replaced by a newer one)
      if (v) setView(v);
      setOn(!!v);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [kind]);
  if (!view) return null;
  return <SubwayOverlay {...view} visible={on && kind === 'light-rail'} say={say} onAlight={alightHere} onSkip={finishRide} onSettings={openSettings} />;
}
