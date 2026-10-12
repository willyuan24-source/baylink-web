import { Link } from 'react-router-dom';
import { CoverImage } from '../../components/ui/CoverImage';
import { useUiCopy } from '../../components/ui/ui-copy';
import { getImageProvenance } from '../../lib/image-provenance';
import { HOME_SCENE3D } from '../../lib/home-catalog';

/**
 * ⑨ The 3D San Francisco tile (1007 §4.2 ⑨): 16:9 key art from BAYLINK's own 3D world, labelled 3D 场景插图 by
 * getImageProvenance, with the download size. OPUS contract: rendered eagerly (never lazy), one full-page link to
 * /opus-bay?from=home whose text says 3D 旧金山 and 独立 3D 体验 (en: 3D San Francisco), and no /play link.
 */
export function Home3DTile() {
  const { t, english } = useUiCopy();
  return <Link to="/opus-bay?from=home" reloadDocument className="home-3d">
    <CoverImage image={HOME_SCENE3D} label={getImageProvenance(HOME_SCENE3D, english)} ratio="16:9" ratioLock decorative
      sizes="(max-width: 767px) calc(100vw - 32px), 560px" className="home-3d__art" />
    <span className="home-3d__text">
      <strong>{t('3D 旧金山 · 湾区小旅', '3D San Francisco')}</strong>
      <span>{t('先逛一座城，再读当地攻略。打开独立 3D 体验。', 'Explore the city, then read local guides. Opens a separate 3D experience.')}</span>
      <small>{t('约 8MB · 建议连 Wi-Fi 打开', 'About 8 MB · Wi-Fi recommended')}</small>
    </span>
  </Link>;
}
