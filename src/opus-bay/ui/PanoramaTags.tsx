import { useCallback } from 'react';
import type { PanoramaTag } from '../game/flags';
import { useT } from '../i18n';
import './guide-ui.css';

/**
 * Wave 4 · the viewpoint panorama tags (lane G, W4-G8; plan sf-w4-plan.md §4.2 "Viewpoint panorama"): at Twin Peaks,
 * Coit, the de Young tower, Grand View Park, Corona Heights and Bernal Heights BAYBAY says "我指给你看！" and every
 * T1 / T2 in view within 2,000 u gets a projected name tag for 10 s (at most 8, collision-avoided; tap → the trip options
 * from here). The only in-world names in the game (anti-spam).
 *
 *   <PanoramaTags tags={pickPanoramaTags(…)} onPick={id => …} register={el => registerAnchor('panorama', el)} />
 *   placePanoramaTags(root, layoutPanoramaTags(…), anchors)   per frame from the projector (ui/panoramaPlace.ts)
 * Each tag is a button (26 px tall, a 44 px hit area) with a dot in the category colour; a tag lifted over a
 * crowded one draws a thin leader line down to its anchor.
 */

export interface PanoramaTagsProps {
  tags: readonly PanoramaTag[];
  onPick(id: string): void;
  /** the projector's anchor registration (game/projector registerAnchor) */
  register?(el: HTMLDivElement | null): void;
}

export function PanoramaTags({ tags, onPick, register }: PanoramaTagsProps) {
  const { t } = useT();
  const ref = useCallback((el: HTMLDivElement | null) => register?.(el), [register]);
  if (!tags.length) return null;
  return (
    <div ref={ref} className="ob-pano" role="group" aria-label={t('看得见的地标', 'Landmarks in view')}>
      {tags.map(tag => (
        <button key={tag.id} type="button" className={`ob-pano-tag rank-${tag.rank}`} data-id={tag.id} data-show="0" onClick={() => onPick(tag.id)} style={{ ['--ob-tag-color' as string]: tag.color }}>
          <i className="ob-pano-dot" aria-hidden />
          <span>{t(tag.name)}</span>
          <i className="ob-pano-lead" aria-hidden />
        </button>
      ))}
    </div>
  );
}
