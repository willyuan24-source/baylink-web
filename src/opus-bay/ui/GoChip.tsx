import { Bird, Footprints, Navigation } from 'lucide-react';
import { useT } from '../i18n';

/**
 * Wave 5 · lane N · W5-N3: the auto-travel chip (plan sf-w5-plan.md MF4), in the lead chip's place (ui/GuideLayer
 * GuideLeadChip renders it while a trip runs; the trip pill keeps the time).
 *
 *   carrying    "BAYBAY 带路中 · 碰摇杆接管" (keyboard: 按方向键接管, pad: 推摇杆接管) — a quiet status, not a button:
 *               taps go through to the city (a tap on the ground is a takeover too)
 *   taken over  "自动跟上 BAYBAY" — one tap hands the walking back (game/tripRun resumeAutoTravel)
 *   W5-N9       "让 BAYBAY 接着飞" — a scenic flight whose wings the player took: one tap hands them back
 *               (game/tripRun resumeScenicGlide, lane F's auto-glide again)
 */
export function GoChip({ auto, device, onResume, fly = false }: { auto: boolean; device: 'touch' | 'keyboard' | 'gamepad'; onResume?: () => void; fly?: boolean }) {
  const { t } = useT();
  if (auto) {
    const how = device === 'touch' ? t('碰摇杆接管', 'touch the stick to steer') : device === 'gamepad' ? t('推摇杆接管', 'move the stick to steer') : t('按方向键接管', 'press WASD to steer');
    return (
      <div className="ob-go-chip is-auto" role="status" aria-live="polite">
        <Navigation size={15} aria-hidden />
        <span className="ob-go-chip-main">{t('BAYBAY 带路中', 'BAYBAY is leading')}</span>
        <span className="ob-go-chip-how">{how}</span>
      </div>
    );
  }
  return (
    <button type="button" className="ob-lead-chip ob-go-resume" onClick={onResume}>
      {fly ? <Bird size={18} aria-hidden /> : <Footprints size={18} aria-hidden />}
      <span>{fly ? t('让 BAYBAY 接着飞', 'Let BAYBAY fly on') : t('自动跟上 BAYBAY', 'Auto-follow BAYBAY')}</span>
    </button>
  );
}
