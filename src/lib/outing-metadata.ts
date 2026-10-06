import type { Locale } from '../i18n/locale';
import type { Outing } from './outings';
import { languagePath } from './language-path';
import { SITE_URL, type PageMetadata } from './seo';

type PublicOuting = Pick<Outing, 'id' | 'title' | 'description' | 'date' | 'startTime' | 'endTime' | 'startAt' | 'endAt' | 'city' | 'venue' | 'costNote' | 'status' | 'updatedAt'>;

/** Metadata projects only public arrangement fields, even when the loaded DTO also contains member-only data. */
export function publicOutingMetadata(outing: PublicOuting, locale: Locale): PageMetadata {
  const status = locale === 'en' ? { open: 'Open', cancelled: 'Cancelled', completed: 'Ended' }
    : locale === 'zh-Hant' ? { open: '開放中', cancelled: '已取消', completed: '已結束' }
      : { open: '开放中', cancelled: '已取消', completed: '已结束' };
  const path = '/together';
  const canonical = `${SITE_URL}${languagePath(path, locale)}?outing=${encodeURIComponent(outing.id)}`;
  const modifiedAt = Number.isFinite(outing.updatedAt) && outing.updatedAt >= 0 && outing.updatedAt <= 8.64e15 ? new Date(outing.updatedAt).toISOString() : undefined;
  return {
    title: `${outing.title.trim()}｜BAYLINK`,
    description: [outing.date, `${outing.startTime}–${outing.endTime}`, outing.city.trim(), status[outing.status], outing.costNote.trim(), outing.description.replace(/\s+/g, ' ').trim().slice(0, 120)].filter(Boolean).join(' · ').slice(0, 260),
    path, outingId: outing.id, type: 'article', noindex: true, preserveText: true,
    locale: locale === 'en' ? 'en_US' : locale === 'zh-Hant' ? 'zh_TW' : 'zh_CN',
    structuredData: [{
      '@context': 'https://schema.org', '@type': 'Event', name: outing.title.trim(), description: outing.description,
      url: canonical, startDate: new Date(outing.startAt).toISOString(), endDate: new Date(outing.endAt).toISOString(),
      ...(outing.venue.trim() ? { location: { '@type': 'Place', name: outing.venue.trim(), ...(outing.city.trim() ? { address: { '@type': 'PostalAddress', addressLocality: outing.city.trim() } } : {}) } } : {}),
      ...(outing.status === 'cancelled' ? { eventStatus: 'https://schema.org/EventCancelled' } : {}),
      ...(modifiedAt ? { dateModified: modifiedAt } : {}),
    }],
  };
}
