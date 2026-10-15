import { Link } from 'react-router-dom';
import { CoverImage } from '../../components/ui/CoverImage';
import { useUiCopy } from '../../components/ui/ui-copy';
import { getImageProvenance } from '../../lib/image-provenance';
import { HOME_SCENE3D_STRIP } from '../../lib/home-catalog';

/**
 * The 3D strip inside the weekend feed (H36 / FCC-11): the way into BAYLINK's own 3D San Francisco at about a third of the
 * page instead of only at its end. A different postcard from the ⑨ tile (one image per page), labelled 3D 场景插图 by
 * getImageProvenance. OPUS contract, as the tile: rendered eagerly, a full-page link to /opus-bay?from=home (a source the
 * game counts, src/opus-bay/ui/entrySource.ts) whose text says 3D 旧金山 and 独立 3D 体验 (en: 3D San Francisco), and no /play.
 */
export function Home3DStrip() {
  const { t, english } = useUiCopy();
  return <Link to="/opus-bay?from=home" reloadDocument className="home-3d-strip">
    <CoverImage image={HOME_SCENE3D_STRIP} label={getImageProvenance(HOME_SCENE3D_STRIP, english)} ratio="3:2" ratioLock decorative
      sizes="(max-width: 767px) 9.5rem, 15rem" className="home-3d-strip__art" />
    <span className="home-3d-strip__text">
      <strong>{t('3D 旧金山：去之前，先逛一圈', '3D San Francisco: look around before you go')}</strong>
      <span>{t('唐人街、渡轮大厦、金门公园……打开独立 3D 体验', 'Chinatown, the Ferry Building, Golden Gate Park… Opens a separate 3D experience')}</span>
      <small>{t('约 8MB · 建议连 Wi-Fi', 'About 8 MB · Wi-Fi recommended')}</small>
    </span>
  </Link>;
}
