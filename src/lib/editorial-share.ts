import type { MonthlyEvent } from '../data/monthly-types';
import type { FreebieOffer } from '../components/FreebieBoard';
import type { SeptemberOpening } from '../data/september-openings';
import type { Guide } from '../data/guides';
import { localizedUrl, translateText } from '../i18n/locale';
import { SITE_URL } from './seo';

export type EditorialShare = {
  kind: 'event' | 'offer' | 'opening' | 'guide';
  id: string; title: string; summary: string; date: string; area: string;
  label: string; path: string; checkedAt: string;
};
export const eventShare = (event: MonthlyEvent): EditorialShare => ({ kind: 'event', id: event.id, title: event.title, summary: event.summary, date: event.dateLabel, area: event.city, label: '湾区活动', path: `/events/${event.id}`, checkedAt: event.verifiedAt });
export const offerShare = (offer: FreebieOffer): EditorialShare => ({ kind: 'offer', id: offer.id, title: `${offer.brand} · ${offer.title}`, summary: offer.requirement, date: offer.dateLabel, area: '湾区本地福利', label: '优惠与 Freebies', path: `/offers/${offer.id}`, checkedAt: '' });
export const openingShare = (shop: SeptemberOpening): EditorialShare => ({ kind: 'opening', id: shop.id, title: shop.name, summary: shop.summary, date: shop.dateLabel, area: shop.city, label: shop.status === 'open' ? '新店 · 已开业' : '新店 · 开业预告', path: `/openings/${shop.id}`, checkedAt: shop.verifiedAt });
export const guideShare = (guide: Guide): EditorialShare => ({ kind: 'guide', id: guide.slug, title: guide.title, summary: guide.summary, date: `核对 ${guide.updatedAt}`, area: guide.categoryLabel, label: '湾区生活攻略', path: `/guides/${guide.slug}`, checkedAt: guide.updatedAt });
export const shareCardPath = (item: Pick<EditorialShare, 'kind' | 'id'>) => `/share-cards/${item.kind}-${encodeURIComponent(item.id)}.png`;
export const editorialShareUrl = (item: EditorialShare) => localizedUrl(`${SITE_URL}${item.path}?from=share`);
export const editorialShareText = (item: EditorialShare) => [
  `BAYLINK · ${translateText(item.label)}`, translateText(item.title),
  `${translateText(item.date)} · ${translateText(item.area)}`, translateText(item.summary),
  translateText('查看详情、最新条件与一起去：'), editorialShareUrl(item),
].join('\n');
