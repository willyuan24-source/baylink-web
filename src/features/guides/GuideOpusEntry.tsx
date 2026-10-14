import { ArrowRight, TramFront } from 'lucide-react';
import { CoverImage } from '../../components/ui/CoverImage';
import { useUiCopy } from '../../components/ui/ui-copy';
import { getImageProvenance } from '../../lib/image-provenance';
import { opusBayAttractionEntry } from '../../lib/opus-bay-attraction-entry';
import type { GuideOpusEntry as Entry } from './guide-records';

/** The 3D city's own address for a guide: `from=guide` is one of the sources the game counts (src/opus-bay/ui/entrySource.ts). */
function guideOpusHref(entry: Entry, locale: 'zh-Hans' | 'zh-Hant' | 'en'): string {
  const arrival = entry.attraction ? opusBayAttractionEntry(entry.attraction, locale) : undefined;
  if (arrival) return arrival.href;
  const query = new URLSearchParams({ from: 'guide' });
  if (locale !== 'zh-Hans') query.set('lang', locale);
  return `/opus-bay?${query}`;
}

/**
 * 在 3D 里先看看 (H36, FCC-11): a San Francisco outing guide's way into BAYLINK's 3D San Francisco, in the reading path under
 * the lead. A plain link, so the separate 3D app opens with a full page load; the place's 3D postcard goes with it unless the
 * page already shows that picture (`showArt`), with its 3D 场景插图 label in the text.
 */
export function GuideOpusEntry({ entry, showArt }: { entry: Entry; showArt: boolean }) {
  const { t, english, locale } = useUiCopy();
  const arrival = entry.attraction ? opusBayAttractionEntry(entry.attraction, locale) : undefined;
  const art = showArt ? entry.postcard : undefined;
  return <a className="gd-opus" href={guideOpusHref(entry, locale)}>
    {art ? <CoverImage className="gd-opus__art" image={english && art.en ? { ...art, alt: art.en.alt } : art} ratio="3:2" ratioLock sizes="120px" decorative />
      : <span className="gd-opus__mark" aria-hidden="true"><TramFront strokeWidth={1.5} /></span>}
    <span className="gd-opus__text">
      <strong>{t('在 3D 里先看看', 'Look around in 3D first')}</strong>
      <span>{arrival ? arrival.label : t('BAYLINK 的 3D 旧金山', 'BAYLINK’s 3D San Francisco')}{t('，打开独立 3D 体验', ' · opens a separate 3D experience')}</span>
      <small>{art ? `${getImageProvenance(art, english)} · ` : ''}{t('约 8MB · 建议连 Wi-Fi', 'About 8 MB · Wi-Fi recommended')}</small>
    </span>
    <ArrowRight className="gd-opus__go" aria-hidden="true" strokeWidth={1.75} />
  </a>;
}
