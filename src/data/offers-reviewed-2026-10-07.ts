import type { FreebieOffer } from '../components/FreebieBoard';

/** A bounded factual review of these three existing records, not a batch renewal. */
export const offerReviews20261007: Record<string, Partial<FreebieOffer>> = {
  'marin-transit-clean-air-oct7-2026': {
    verifiedAt: '2026-10-07',
    description: '官网 2026/27 免票安排明确列出 10/7 Clean Air Day，本地公交当天对所有乘客免票。先查自己的去回程班次和站点；免票不延长服务时间，其他运营方票价另查。',
  },
  'sf-zoo-resident-free-oct7-2026': {
    verifiedAt: '2026-10-07',
    description: '免费日活动页列 10/7 10:00–16:00；不要把网站通用的闭园时间当成免费日窗口。停车、餐饮及其他付费项目不包含；同行儿童或没有本人地址证件的家人，先向园方确认核验方式。',
  },
  'target-circle-deal-days-oct6-7-2026': {
    verifiedAt: '2026-10-07',
    description: 'Target 公司公告明确列 10/6–7：指定家庭服饰减 40%、指定护肤／护发／彩妆减 30%。这是会员购物折扣，不是免费领取；本店库存、排除商品与结账总价须按所选商品确认。',
  },
};

// Editor evidence is separate from customer copy. Each URL was actually read;
// no stock checks, ticket purchases, account actions or provider calls occurred.
export const offerReviewEvidence20261007 = [
  { id: 'marin-transit-clean-air-oct7-2026', reviewedAt: '2026-10-07', url: 'https://marintransit.gov/fare-free-promotions', evidence: 'FY2026/27 list explicitly names Wednesday October 7, 2026 as Clean Air Day; local bus service is free for all riders.' },
  { id: 'sf-zoo-resident-free-oct7-2026', reviewedAt: '2026-10-07', url: 'https://www.sfzoo.org/calendar/sf-resident-free-day-5/', supportingUrl: 'https://www.sfzoo.org/tickets-hours/', evidence: 'Event details explicitly give 2026-10-07, 10 AM–4 PM; government-issued ID showing SF residency admits one person per qualifying ID. Tickets & Hours separately lists paid parking; generic site header hours are separate.' },
  { id: 'target-circle-deal-days-oct6-7-2026', reviewedAt: '2026-10-07', url: 'https://www.prnewswire.com/news-releases/target-circle-deal-days-returns-with-major-savings-on-stylish-fall-and-holiday-finds-302878903.html', evidence: 'Release is provided by Target Corporation, dated September 15, 2026; it specifies October 6–7 and free Circle membership, selected clothing 40% off and selected skincare/haircare/cosmetics 30% off. No store inventory was checked.' },
];
