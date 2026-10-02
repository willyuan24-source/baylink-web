import { Hand } from 'lucide-react';
import { useT } from '../i18n';
import { useMedia } from '../ui/hooks';
import { importRetry } from '../game/importRetry';

/**
 * Wave 8 · lane M · the grip game's pad in lane T's ride banner (ui/rideSlots registerRidePad, from play/sfgames8.ts):
 * one button on a Powell St cable car under way — 拉闸 starts the game (its panel opens at the bottom of the screen).
 * On a phone the pad row holds three pads (the bell riff, the lean-out, this) in ≈ 330 px: the short label there.
 */
export default function GripPad() {
  const { t } = useT();
  const narrow = useMedia('(max-width: 600px)');
  // (W9-G5) the grip starts once its panel's chunk is in too
  const start = () => { void Promise.all([importRetry(() => import('./grip')), importRetry(() => import('./GripPanel'))]).then(([m]) => { m.startGrip(); }); };
  return (
    <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={start} style={{ minHeight: 44 }} aria-label={t('拉闸当司机', 'Work the grip')}>
      <Hand size={15} aria-hidden />{narrow ? t('拉闸', 'Grip it') : t('拉闸当司机', 'Work the grip')}
    </button>
  );
}
