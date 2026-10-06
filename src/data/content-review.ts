import { guides } from './guides';
import { MONTHLY_EVENTS } from './monthly-edition';
import { currentFreebies } from './october-offers';
import { currentOpenings } from './local-discoveries';
import { currentRegionalBulletins } from './october-2026-bulletins';
import { contentReviewQueue, type ContentReviewRecord } from '../lib/content-review';

/** Internal editorial notes. These never rewrite a public checked date or appear as reader-facing errors. */
const MANUAL_REVIEW: Record<string, string> = {
  'famsf-bay-area-free-saturdays': 'Official FAMSF program/ticket pages returned 403 on 2026-10-05. Confirm free timed-ticket steps manually; retain 2026-10-02 factual check.',
  'california-tenant-deposit-rights-help-guide': 'California Courts deposit page could not be read automatically on 2026-10-05. DOJ and CRD guidance was readable; manually confirm court procedure before expanding legal claims.',
};

export function getContentReviewManifest(today: string) {
  const records: ContentReviewRecord[] = [
    ...currentRegionalBulletins.map(item => ({ kind: 'bulletin' as const, id: item.id, title: item.title, path: '/this-month#monthly-news', sourceUrls: [item.sourceUrl], verifiedAt: item.verifiedAt, endDate: item.expiresAt, risk: 'time-sensitive' as const, cadenceDays: 7 })),
    ...MONTHLY_EVENTS.map(event => ({ kind: 'event' as const, id: event.id, title: event.title, path: `/events/${event.id}`, sourceUrls: [event.officialUrl], verifiedAt: event.verifiedAt, endDate: event.endDate, risk: 'time-sensitive' as const, cadenceDays: 7 })),
    ...currentFreebies.map(offer => ({ kind: 'offer' as const, id: offer.id, title: offer.title, path: `/offers/${offer.id}`, sourceUrls: [...new Set([offer.sourceUrl, offer.storeUrl].filter((url): url is string => !!url))], verifiedAt: offer.verifiedAt, endDate: offer.endDate, risk: 'time-sensitive' as const, cadenceDays: 7, manualReviewReason: MANUAL_REVIEW[offer.id] || (offer.verificationStatus === 'needs-confirmation' ? 'Offer explicitly needs editorial confirmation' : undefined) })),
    ...currentOpenings.map(shop => ({ kind: 'opening' as const, id: shop.id, title: shop.name, path: `/openings/${shop.id}`, sourceUrls: [shop.officialUrl], verifiedAt: shop.verifiedAt, risk: 'time-sensitive' as const, cadenceDays: shop.status === 'announced' ? 7 : 30 })),
    ...guides.map(guide => {
      const highRisk = /医保|Medicare|Medi-Cal|报税|税务|租客权益|合同|押金|法律|就医|找医生|驾照|公证/u.test([guide.title, ...guide.tags].join(' '));
      return { kind: 'guide' as const, id: guide.slug, title: guide.title, path: `/guides/${guide.slug}`, sourceUrls: [...new Set(guide.sources.map(source => source.url))], verifiedAt: guide.updatedAt, dateMeaning: 'content-updated' as const, endDate: guide.editionThroughDate || (guide.editionMonth ? new Date(Date.UTC(Number(guide.editionMonth.slice(0, 4)), Number(guide.editionMonth.slice(5)), 0)).toISOString().slice(0, 10) : undefined), risk: highRisk ? 'health-legal-financial' as const : guide.editionMonth ? 'time-sensitive' as const : 'evergreen' as const, cadenceDays: highRisk ? 30 : guide.editionMonth ? 14 : 90, manualReviewReason: MANUAL_REVIEW[guide.slug] };
    }),
  ];
  const items = contentReviewQueue(records, today);
  return { version: 1, generatedForDate: today, owner: 'BAYLINK editorial', policy: 'Review due dates are scheduling metadata, not renewed factual verification. Guide dates mean content-updated unless an explicit source note says otherwise. Archived published URLs remain in the catalog.', summary: { total: items.length, manualReview: items.filter(item => item.status === 'manual-review').length, missingDate: items.filter(item => item.status === 'missing-date').length, due: items.filter(item => item.status === 'due').length, archived: items.filter(item => item.status === 'archived').length }, items };
}
