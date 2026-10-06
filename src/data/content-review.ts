import { guides } from './guides';
import { MONTHLY_EVENTS } from './monthly-edition';
import { currentFreebies } from './october-offers';
import { currentOpenings } from './local-discoveries';
import { currentRegionalBulletins } from './october-2026-bulletins';
import { contentReviewQueue, discoveryContentReviewRecord, guideContentReviewRecord, type ContentReviewRecord } from '../lib/content-review';

export function getContentReviewManifest(today: string) {
  const records: ContentReviewRecord[] = [
    ...currentRegionalBulletins.map(item => ({ kind: 'bulletin' as const, id: item.id, title: item.title, path: '/this-month#monthly-news', sourceUrls: [item.sourceUrl], verifiedAt: item.verifiedAt, endDate: item.expiresAt, risk: 'time-sensitive' as const, cadenceDays: 7 })),
    ...MONTHLY_EVENTS.map(event => discoveryContentReviewRecord({ kind: 'event', event })),
    ...currentFreebies.map(offer => discoveryContentReviewRecord({ kind: 'offer', offer })),
    ...currentOpenings.map(shop => discoveryContentReviewRecord({ kind: 'opening', shop })),
    ...guides.map(guideContentReviewRecord),
  ];
  const items = contentReviewQueue(records, today);
  return { version: 1, generatedForDate: today, owner: 'BAYLINK editorial', policy: 'Review due dates are scheduling metadata, not renewed factual verification. Guide dates mean content-updated unless an explicit source note says otherwise. Archived published URLs remain in the catalog.', summary: { total: items.length, manualReview: items.filter(item => item.status === 'manual-review').length, missingDate: items.filter(item => item.status === 'missing-date').length, due: items.filter(item => item.status === 'due').length, archived: items.filter(item => item.status === 'archived').length }, items };
}
