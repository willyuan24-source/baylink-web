/**
 * Guide topics (D22): seven reader tasks laid over the existing guide categories, which stay as they are. Each guide
 * has one primary topic; the 长辈与家属 hub is an ordered, hand-picked list that also borrows guides whose primary topic
 * is health, money or transport. 防骗 is a cross-tag, not a topic. Schools sit in 证件与移民, the 新来安顿 errands.
 * Data only: WEB-GUIDES mounts the chips, /guides?topic=elders and the "长辈与家属先看" rail.
 * This file names slugs only, so a page can import it without pulling in the guide catalog.
 */
export type GuideTopicId = 'elders' | 'health' | 'documents' | 'housing' | 'transport' | 'savings' | 'outings';

export type GuideTopic = { id: GuideTopicId; zh: string; en: string; summary: { zh: string; en: string } };

/** In display order: 长辈与家属 first. */
export const GUIDE_TOPICS: readonly GuideTopic[] = [
  { id: 'elders', zh: '长辈与家属', en: 'Seniors & family', summary: { zh: '长者服务、医保、退休金和看病，家属代办也能看懂', en: 'Senior services, Medicare, retirement benefits and doctors, for elders and the family who helps' } },
  { id: 'health', zh: '医疗保险', en: 'Health & insurance', summary: { zh: '找医生、看牙、Medicare 与 Medi-Cal', en: 'Finding a doctor, dental care, Medicare and Medi-Cal' } },
  { id: 'documents', zh: '证件与移民', en: 'IDs & immigration', summary: { zh: '新来安顿：驾照、入籍、开户、报税与孩子入学', en: 'Settling in: driver licenses, citizenship, bank and phone, taxes and school enrollment' } },
  { id: 'housing', zh: '住房', en: 'Housing', summary: { zh: '租房、押金、搬家、水电与维修', en: 'Renting, deposits, moving, utilities and repairs' } },
  { id: 'transport', zh: '出行', en: 'Getting around', summary: { zh: 'BART、Muni、机场、停车与过桥费', en: 'BART, Muni, airports, parking and bridge tolls' } },
  { id: 'savings', zh: '省钱福利', en: 'Savings & benefits', summary: { zh: '免费福利、优惠、图书馆通行证与账单减免', en: 'Free benefits, deals, library passes and bill discounts' } },
  { id: 'outings', zh: '周末出游', en: 'Weekend outings', summary: { zh: '半日路线、景点、市集与季节活动', en: 'Half-day routes, places, markets and seasonal events' } },
];

/** Every published guide under its primary topic (141 on 2026-10-08); a slug appears once. */
export const GUIDE_TOPIC_SLUGS: Readonly<Record<GuideTopicId, readonly string[]>> = {
  elders: [
    'bay-area-chinese-senior-services-referral-guide',
  ],
  health: [
    'bay-area-medicare-hicap-medi-cal-guide', 'bay-area-dental-care-insurance-low-cost-guide', 'bay-area-first-doctor-insurance-network-guide',
  ],
  documents: [
    'bay-area-naturalization-official-path-guide', 'california-driver-license-id-preparation-guide', 'bay-area-newcomer-first-month-checklist',
    'bay-area-first-7-30-days-action-plan-october-2026', 'bay-area-phone-bank-first-bill-guide', 'bay-area-free-tax-help-vita-calfile-guide',
    'bay-area-translation-service-guide', 'bay-area-library-starter-guide', 'bay-area-free-esl-adult-learning-guide', 'bay-area-useful-apps-platforms-guide',
    'bay-area-311-211-local-help-guide', 'bay-area-alerts-outages-first-day-checklist', 'bay-area-november-resident-dates-2026',
    'bay-area-part-time-job-safety-guide', 'bay-area-k12-midyear-enrollment-guide', 'sf-school-district-enrollment-guide',
    'peninsula-school-district-enrollment-guide', 'south-bay-school-district-enrollment-guide', 'east-bay-school-district-enrollment-guide',
    'north-bay-school-district-enrollment-guide',
  ],
  housing: [
    'bay-area-rental-scam-guide', 'bay-area-roommate-guide', 'rental-lease-checklist-before-signing', 'move-in-move-out-checklist',
    'bay-area-first-rental-process', 'california-tenant-deposit-rights-help-guide', 'bay-area-where-to-live-first-month', 'bay-area-regions-explained',
    'peninsula-living-guide', 'south-bay-living-guide', 'bay-area-moving-checklist', 'bay-area-utilities-address-change-guide',
    'bay-area-city-utilities-internet-phone-directory', 'bay-area-bulky-items-ewaste-hhw-guide', 'bay-area-repair-request-guide',
    'bay-area-cleaning-quote-checklist', 'local-service-safety-guide', 'bay-area-used-trading-safety-guide', 'bay-area-used-furniture-appliance-guide',
    'bay-area-borrow-tools-repair-before-buying-2026', 'baylink-safety-guide', 'baylink-posting-guide-for-trust',
  ],
  transport: [
    'bay-area-commute-guide', 'bay-area-without-car-guide', 'bay-area-airport-arrival-guide', 'bay-area-airport-first-night-decision-october-2026',
    'bay-area-cross-bay-commute-home-base-october-2026', 'bay-area-october-muni-clipper-payment-update-2026', 'bart-october-access-parking-update-2026',
    'bay-area-street-parking-first-time-guide', 'bay-area-fastrak-bridge-express-lanes-guide',
  ],
  savings: [
    'bay-area-social-security-retirement-preparation-guide', 'bay-area-household-bills-annual-review-2026', 'san-jose-digital-help-sj-access-update-2026',
    'bay-area-birthday-perks', 'bay-area-everyday-free-perks', 'bay-area-retail-freebies-family-deals', 'bay-area-freebies-deals-2026-09',
    'bay-area-freebies-deals-2026-10', 'bay-area-freebies-deals-2026-11', 'sf-free-culture-eligibility-october-2026',
    'bay-area-october-library-museum-pass-guide-2026', 'sccld-sharks-library-card-september-2026',
  ],
  outings: [
    'san-francisco-guide', 'san-jose-guide', 'bay-area-101-city-exploration-living-guide', 'bay-area-outlets-malls-shopping-guide',
    'sf-first-72-hours-car-free-october-2026', 'sf-first-visit-tickets-waterfront-october-2026', 'sf-family-rain-fog-car-free-october-2026',
    'bay-area-visitor-coast-redwoods-return-plan-2026', 'sf-visitor-luggage-restrooms-lost-property-2026', 'sf-visitor-meals-markets-dietary-booking-2026',
    'north-bay-car-free-day-guide', 'east-bay-first-weekend-guide', 'half-moon-bay-coastal-half-day-guide', 'reinhardt-redwood-first-walk-guide',
    'presidio-picnic-day-guide', 'rainy-day-museum-family-guide', 'bay-area-dog-park-first-outing-guide', 'golden-gate-park-free-car-free-day-guide',
    'palo-alto-baylands-family-walk-guide', 'sf-golden-gate-bridge-fort-point-guide', 'sf-fishermans-wharf-pier39-guide', 'sf-alcatraz-booking-day-guide',
    'sf-chinatown-north-beach-walk-guide', 'sf-palace-fine-arts-marina-guide', 'berkeley-campus-botanical-garden-half-day', 'oakland-lake-merritt-omca-half-day',
    'stanford-cantor-campus-art-walk', 'filoli-house-garden-day-trip', 'san-jose-tech-japantown-day-trip', 'hakone-gardens-saratoga-half-day',
    'muir-woods-reservation-day-trip', 'sausalito-waterfront-ferry-half-day', 'sf-lands-end-sutro-baths-walk-guide', 'sf-mission-dolores-murals-walk-guide',
    'alameda-uss-hornet-shoreline-day-guide', 'fremont-coyote-hills-short-walk-guide', 'san-carlos-hiller-aviation-half-day-guide',
    'san-mateo-coyote-point-bayfront-guide', 'mountain-view-computer-history-shoreline-guide', 'san-jose-egyptian-museum-rose-garden-guide',
    'point-reyes-bear-valley-first-visit-guide', 'angel-island-ferry-first-day-guide', 'bay-area-new-openings-2026-09', 'bay-area-october-weekend-planner-2026',
    'half-moon-bay-october-pumpkin-coast-guide-2026', 'san-jose-october-family-history-farm-guide-2026', 'east-bay-tilden-october-family-guide-2026',
    'north-bay-china-camp-october-culture-guide-2026', 'sf-sunset-dunes-october-coastal-walk-2026', 'san-mateo-japanese-garden-october-guide-2026',
    'alviso-marina-october-birdwatching-guide-2026', 'fremont-ardenwood-october-farm-guide-2026', 'richmond-rosie-free-history-october-guide-2026',
    'martinez-shoreline-october-short-walk-guide-2026', 'pleasanton-saturday-market-museum-guide-october-2026', 'marin-sunday-market-october-local-guide-2026',
    'sonoma-plaza-history-october-day-guide-2026', 'napa-bothe-october-redwood-picnic-guide-2026', 'sf-autumn-art-half-day-2026',
    'east-bay-redwoods-green-friday-2026', 'half-moon-bay-autumn-coast-2026', 'alviso-autumn-wetlands-2026', 'sonoma-autumn-art-plaza-2026',
    'peninsula-south-bay-autumn-farmers-markets-2026', 'bay-area-coastal-cleanup-2026-guide', 'bay-area-november-first-half-planner-2026',
    'north-bay-markets-nature-culture-through-november-15-2026', 'peninsula-south-bay-november-nature-walks-2026', 'east-bay-november-nature-programs-2026',
    'san-francisco-autumn-food-markets-2026', 'half-moon-bay-pumpkin-season-2026-guide', 'bay-area-farmers-market-shopping-guide',
    'bay-area-build-recurring-community-routine-2026', 'bay-area-ai-week-tech-week-first-timer-guide-2026',
  ],
};

export const GUIDE_TOPIC_BY_SLUG: Readonly<Record<string, GuideTopicId>> = Object.fromEntries(
  (Object.entries(GUIDE_TOPIC_SLUGS) as [GuideTopicId, readonly string[]][]).flatMap(([topic, slugs]) => slugs.map(slug => [slug, topic])),
);

/**
 * The 长辈与家属 hub in reading order: whom to call first, then health cover, money, getting around and help at home,
 * then an outing that works with an older relative. Product brief §5: Medicare/HICAP, the senior-services referral
 * (AAA 800-510-2020 + county lines), dental, Social Security retirement, Muni and the 311/211 help lines.
 */
export const ELDER_HUB_SLUGS: readonly string[] = [
  'bay-area-chinese-senior-services-referral-guide',
  'bay-area-medicare-hicap-medi-cal-guide',
  'bay-area-social-security-retirement-preparation-guide',
  'bay-area-first-doctor-insurance-network-guide',
  'bay-area-dental-care-insurance-low-cost-guide',
  'bay-area-311-211-local-help-guide',
  'bay-area-october-muni-clipper-payment-update-2026',
  'bay-area-free-tax-help-vita-calfile-guide',
  'san-jose-digital-help-sj-access-update-2026',
  'bay-area-naturalization-official-path-guide',
  'bart-october-access-parking-update-2026',
  'sf-family-rain-fog-car-free-october-2026',
];

/** 防骗 cross-tag: guides whose main job is spotting a scam, shown under their own topic and in a 防骗 filter. */
export const ANTI_FRAUD_SLUGS: readonly string[] = [
  'bay-area-rental-scam-guide', 'bay-area-part-time-job-safety-guide', 'bay-area-used-trading-safety-guide', 'local-service-safety-guide', 'baylink-safety-guide',
];

/** Category fallback for a guide published after this map: content PRs keep working, and the test lists what to file. */
const CATEGORY_TOPIC: Readonly<Record<string, GuideTopicId>> = {
  rent: 'housing', roommate: 'housing', used: 'housing', service: 'housing', safety: 'housing',
  newcomer: 'documents', education: 'documents', commute: 'transport', city: 'outings', events: 'outings',
};

export const guideTopicOf = (guide: { slug: string; category: string }): GuideTopicId =>
  GUIDE_TOPIC_BY_SLUG[guide.slug] || CATEGORY_TOPIC[guide.category] || 'outings';

/** Slugs for one topic chip, in the given catalog order; 长辈与家属 is the curated hub order instead. */
export function guideSlugsForTopic(topic: GuideTopicId, guides: readonly { slug: string; category: string }[]): string[] {
  if (topic === 'elders') {
    const published = new Set(guides.map(guide => guide.slug));
    return ELDER_HUB_SLUGS.filter(slug => published.has(slug));
  }
  return guides.filter(guide => guideTopicOf(guide) === topic).map(guide => guide.slug);
}
