import { TypeFrame, latinLang, type CoverLayout } from './cover-frame';
import { Cover, type CoverSlot } from './CoverImage';
import { useUiCopy } from './ui-copy';
import { translateText } from '../../i18n/locale';
import { chooseCover } from '../../lib/cover-family';
import { openingChip, readerMonthDay, type Copy } from '../../lib/event-facts';
import type { SeptemberOpening } from '../../data/september-openings';

/** Family shop: one shopfront, the awning and the sign (what it sells, the opening day). */
export function ShopFace({ sells, opened, mini }: { sells: string; opened?: string; mini: boolean }) {
  return <>
    <span className="tc-awning" aria-hidden="true" />
    {mini ? <p className="tc-thumb">{opened || sells}</p>
      : <p className="tc-sign"><span className="tc-sign__sells" lang={latinLang(sells)}>{sells}</span>{opened && <span className="tc-sign__date tc-num">{opened}</span>}</p>}
  </>;
}

const OPENING_LABELS: Record<SeptemberOpening['openingType'], Copy> = {
  'new-restaurant': { zh: '新开餐厅', en: 'New restaurant' },
  'new-store': { zh: '新店', en: 'New shop' },
  relocation: { zh: '搬新址', en: 'New location' },
  reopening: { zh: '重新开业', en: 'Reopened' },
  'extended-pop-up': { zh: '快闪店', en: 'Pop-up' },
  'opening-celebration': { zh: '开业活动', en: 'Opening celebration' },
};
export type OpeningCoverInput = Pick<SeptemberOpening, 'name' | 'city' | 'status' | 'openedOn' | 'openingType'> & { id?: string; category?: string };
const HAN = /[㐀-鿿]/;

/**
 * Family shop (openings, G4): one shopfront whose sign says what it sells (`category`, in English when the dictionary has
 * it, else the opening type) and the opening day ("10/11 开业", else the honest chip: 即将开业 / 已开业). Never the name, which
 * the caption prints. `compact` is accepted for older callers.
 */
export function OpeningTypeCover({ opening, today, ...layout }: CoverLayout & { opening: OpeningCoverInput; today: string; compact?: boolean }) {
  const { pick, locale, english, t } = useUiCopy();
  const category = opening.category ? translateText(opening.category, locale) : '';
  const sells = category && !(english && HAN.test(category)) ? category : pick(OPENING_LABELS[opening.openingType]);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(opening.openedOn ?? '') ? opening.openedOn! : undefined;
  const opened = day && opening.status !== 'soft_open'
    ? t(`${readerMonthDay(day)} 开业`, `${day <= today ? 'Opened' : 'Opening'} ${readerMonthDay(day, true)}`)
    : pick(openingChip(opening, today));
  const choice = chooseCover('opening', { tier: 'type' }, { id: opening.id ?? opening.name, sells, opened });
  return <TypeFrame {...layout} {...choice} kind="opening" tone={opening.openingType === 'new-restaurant' ? 'food' : 'family'}>
    <ShopFace sells={sells} opened={opened} mini={layout.size === 'mini'} />
  </TypeFrame>;
}

/** A new-shop cover: the shop's own image, or the shop family. */
export function OpeningCover({ opening, today, ...slot }: CoverSlot & { opening: OpeningCoverInput; today: string }) {
  return <Cover {...slot} kind="opening" fallback={<OpeningTypeCover opening={opening} today={today} ratio={slot.ratio} ratioLock={slot.ratioLock} ariaHidden={slot.decorative} />} />;
}
