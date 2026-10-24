import { CoverImage, creditAfterLabel } from './ui/CoverImage';
import { useUiCopy } from './ui/ui-copy';
import { TIER_LABELS } from '../lib/cover-labels';
import { translateText } from '../i18n/locale';
import type { BandPhoto } from '../lib/account-band-photos';
import './account-band.css';

/**
 * The slim photographic band at the top of /me and /together (UI9-R2-ACCOUNT-UTILITY, R2-15): one approved ③ category photo
 * (lib/account-band-photos.ts) on the page frame, 3:1 on a phone and 6:1 from a tablet up, with its one label at the
 * bottom-left (DECISIONS 23: 示意图 / 示意圖 / Illustrative photo, on the picture in every size and mode, so the credit under
 * it does not repeat it) and its credit under it (photographer, the photo's page, the licence). Decorative (empty alt): the page's H1 says what the page is, and
 * the band names no place. Lazy (it is never a page's largest paint on these pages' first frame budget) and in a fixed
 * frame, so it shifts nothing when it loads.
 */
export function AccountBand({ photo, className }: { photo: BandPhoto; className?: string }) {
  const { t, locale } = useUiCopy();
  const words = locale === 'en' ? TIER_LABELS.stock.en : locale === 'zh-Hant' ? TIER_LABELS.stock.zhHant : TIER_LABELS.stock.zh;
  const short = locale === 'en' ? TIER_LABELS.stock.enShort : locale === 'zh-Hant' ? TIER_LABELS.stock.zhHantShort : TIER_LABELS.stock.zhShort;
  const credit = creditAfterLabel(words, translateText(photo.credit, locale));
  return <figure className={className ? `account-band ${className}` : 'account-band'} data-photo={photo.key}>
    <CoverImage className="account-band__picture" image={photo} label={words} shortLabel={short} tier="stock" focal={photo.focal}
      sizes="(max-width: 1279px) calc(100vw - 32px), 1216px" decorative />
    <figcaption className="account-band__credit">
      <a href={photo.creditUrl} target="_blank" rel="noopener noreferrer">{credit}</a>
      <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{t('许可', 'License')}</a>
    </figcaption>
  </figure>;
}
