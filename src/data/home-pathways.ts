/**
 * The home page's 办事与生活指南 rail (1007 §4.2 ⑥, plan WEB-HOME): five reader intents, 长辈与家属 second (HOMEIA-08),
 * each with up to four guides and the guide topic it continues into (/guides?topic=…, D22). The home catalog generator
 * copies these guides' titles, topics, source counts and covers; the reader's choice is remembered in this browser.
 */
export const HOME_INTENTS = [
  {
    id: 'weekend', label: '周末出门', en: 'Weekend outings', topic: 'outings',
    slugs: ['golden-gate-park-free-car-free-day-guide', 'half-moon-bay-coastal-half-day-guide', 'reinhardt-redwood-first-walk-guide', 'sf-first-72-hours-car-free-october-2026'],
  },
  {
    id: 'elders', label: '长辈与家属', en: 'Seniors & family', topic: 'elders',
    slugs: ['bay-area-chinese-senior-services-referral-guide', 'bay-area-medicare-hicap-medi-cal-guide', 'bay-area-social-security-retirement-preparation-guide', 'sf-family-rain-fog-car-free-october-2026'],
  },
  {
    id: 'newcomer', label: '新来安顿', en: 'Settling in', topic: 'documents',
    slugs: ['bay-area-first-7-30-days-action-plan-october-2026', 'bay-area-airport-first-night-decision-october-2026', 'california-driver-license-id-preparation-guide', 'bay-area-library-starter-guide'],
  },
  {
    id: 'health', label: '看病与保险', en: 'Doctors & insurance', topic: 'health',
    slugs: ['bay-area-first-doctor-insurance-network-guide', 'bay-area-medicare-hicap-medi-cal-guide', 'bay-area-dental-care-insurance-low-cost-guide'],
  },
  {
    id: 'everyday', label: '日常办事', en: 'Everyday errands', topic: 'housing',
    slugs: ['bay-area-311-211-local-help-guide', 'bay-area-repair-request-guide', 'bay-area-without-car-guide', 'bay-area-rental-scam-guide'],
  },
] as const;

export type HomeIntentId = (typeof HOME_INTENTS)[number]['id'];
