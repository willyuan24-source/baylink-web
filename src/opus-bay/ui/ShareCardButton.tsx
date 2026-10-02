import { Users } from 'lucide-react';
import { useT } from '../i18n';
import { SHARE_CARD_ID, type ShareCardSpec } from './shareCardModel';
import { openOverlay, overlays } from './slots';

/**
 * Wave 9 · lane S · W9-S4 — the 「约家人」 button (review R§5 #8: 活动卡、地点卡和想去清单都没有分享按钮) on the event card,
 * the place card and 我的周末: it opens the card overlay (ui/ShareCard.tsx, registered by the city's boot in
 * game/album.ts). Nothing where the overlay is not registered (district mode: no card there).
 */
export function ShareCardButton({ spec, className = 'ob-btn ob-btn-soft' }: { spec: ShareCardSpec; className?: string }) {
  const { t } = useT();
  if (!overlays.get(SHARE_CARD_ID)) return null;
  return (
    <button type="button" className={className} onClick={() => openOverlay(SHARE_CARD_ID, spec)}>
      <Users size={17} aria-hidden /><span>{t('约家人', 'Invite family')}</span>
    </button>
  );
}
