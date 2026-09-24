import type { FreebieOffer } from '../components/FreebieBoard';
import type { GuideSource } from './guides';
import { septemberFreebies } from './september-freebies';
import { additionalOctoberOffers } from './october-offers-extra';
import { autumnRefreshOffers } from './autumn-refresh-offers';
import { communityDiscoveryOffers } from './community-discovery-offers';

// Official sources checked 2026-09-15. Monthly-rule dates are identified in the text.
export const newOctoberOffers: FreebieOffer[] = [
  {
    id: 'bampfa-free-oct1', brand: 'BAMPFA · BERKELEY', title: '10/1 免费逛 Berkeley 艺术展厅',
    dateLabel: '10/1 周四 · 展厅开放时段', startDate: '2026-10-01', endDate: '2026-10-01', availability: 'dated', kind: 'no-purchase',
    requirement: '所有访客免费参观展厅，无需会员或消费；电影放映另行购票。',
    description: '官方 2026 日历明确列出 10 月 1 日。把 Berkeley 市中心看展和校园散步放在同一天，出发前查季节性开放时间。',
    imageKey: 'culture-visit', imageNote: '看展主题插图，非该馆实景', sourceUrl: 'https://bampfa.org/event/free-first-thursdays', sourceLabel: 'BAMPFA 免费首个周四日历', storeUrl: 'https://bampfa.org/visit/hours',
  },
  {
    id: 'sjma-free-oct2', brand: 'SAN JOSÉ MUSEUM OF ART', title: '10/2 下班后免费进美术馆',
    dateLabel: '10/2 周五 · 18:00 后', startDate: '2026-10-02', endDate: '2026-10-02', availability: 'dated', kind: 'no-purchase',
    requirement: '每月首个周五 18:00 后所有人免费入馆，无需会员；餐饮和商店购物另付。',
    description: '按官网每月规则，十月对应 10/2。适合 San José 市中心下班后顺路看展；当晚节目、结束时间与特别安排请看馆方日历。',
    imageKey: 'culture-visit', imageNote: '看展主题插图，非该馆实景', sourceUrl: 'https://sjmusart.org/programs-at-sjma/first-fridays', sourceLabel: 'SJMA 首个周五免费入馆规则',
  },
  {
    id: 'chm-museums-on-us-oct3-4', brand: 'COMPUTER HISTORY MUSEUM', title: '已有指定银行卡，可免费逛电脑历史馆',
    dateLabel: '10/3–10/4 · 当日开放时段', startDate: '2026-10-03', endDate: '2026-10-04', availability: 'dated', kind: 'no-purchase',
    requirement: '持有效 Bank of America 或 Merrill 借记／信用卡及本人照片证件；仅持卡人一张普通门票，同伴不包含。',
    description: 'Mountain View，1401 N. Shoreline Blvd.。银行官网明确公布 10/3–4；馆方说明不含特展、售票演出和筹款活动。已有卡再用即可。',
    imageKey: 'culture-visit', imageNote: '参观主题插图，非电脑历史馆展品或实景', sourceUrl: 'https://computerhistory.org/plan-your-visit/discounts/', sourceLabel: 'CHM 持卡免费入场限制', storeUrl: 'https://about.bankofamerica.com/en/making-an-impact/museums-on-us-partners',
  },
  {
    id: 'omca-free-oct4', brand: 'OMCA · OAKLAND', title: '10/4 免费看加州艺术、历史与自然',
    dateLabel: '10/4 周日 · 按首个周日规则', startDate: '2026-10-04', endDate: '2026-10-04', availability: 'dated', kind: 'no-purchase',
    requirement: '所有人免费，官网现行规则包含特别展览。建议网上预约；现场票先到先得。',
    description: '十月首个周日落在 10/4。可把 OMCA 和 Lake Merritt 周边散步安排在一起；免费的是入馆，餐饮与购物另计。',
    imageKey: 'region-omca', sourceUrl: 'https://museumca.org/first-sundays/', sourceLabel: 'OMCA 首个周日与预约规则',
  },
  {
    id: 'asian-art-free-oct4', brand: 'ASIAN ART MUSEUM · SF', title: '10/4 亚洲艺术博物馆普通门票免费',
    dateLabel: '10/4 周日 · 10:00–17:00', startDate: '2026-10-04', endDate: '2026-10-04', availability: 'dated', kind: 'no-purchase',
    requirement: '每月首个周日普通门票免费，无需居民或会员资格；特展另付 $10，建议预订时段票。',
    description: '地点为 Civic Center 的 200 Larkin Street。10/4 根据官网每月规则换算；只逛普通展区可免费，特展加购另计。',
    imageKey: 'culture-visit', imageNote: '看展主题插图，非该馆实景', sourceUrl: 'https://about.asianart.org/ticketing/', sourceLabel: '亚洲艺术博物馆免费日票务',
  },
  {
    id: 'conservatory-free-oct6', brand: 'CONSERVATORY OF FLOWERS · SF', title: '10/6 免费逛金门公园温室',
    dateLabel: '10/6 周二 · 10:00–16:30', startDate: '2026-10-06', endDate: '2026-10-06', availability: 'dated', kind: 'no-purchase',
    requirement: '每月首个周二所有人普通入场免费，不限 SF 居民；16:00 最后入场，特别活动另计。',
    description: '100 John F Kennedy Drive。10/6 按官网免费日规则换算，温室通常周三关闭，别把免费日记成周三。',
    imageKey: 'ggp-conservatory', sourceUrl: 'https://gggp.org/visit/admissions-hours/', sourceLabel: '金门公园三园开放与免费时段',
  },
  {
    id: 'botanical-free-oct13', brand: 'SAN FRANCISCO BOTANICAL GARDEN', title: '10/13 植物园全天普通入场免费',
    dateLabel: '10/13 周二 · 07:30 起，17:00 最后入场', startDate: '2026-10-13', endDate: '2026-10-13', availability: 'dated', kind: 'no-purchase',
    requirement: '每月第二个周二所有人普通入场免费，不限 SF 居民；付费特别活动与节目不包含。',
    description: '1199 9th Avenue。10/13 按官网规则换算；十月最后入园为 17:00，园区在最后入场一小时后关闭。',
    imageKey: 'garden-walk', imageNote: '花园散步主题插图，非该园实景', sourceUrl: 'https://gggp.org/visit/admissions-hours/', sourceLabel: '植物园免费日与十月入园时间',
  },
  {
    id: 'lowes-firefighting-plane-oct17', brand: 'LOWE’S', title: '10/17 免费做消防飞机',
    dateLabel: '10/17 周六 · 10:00–13:00', startDate: '2026-10-17', endDate: '2026-10-17', availability: 'dated', kind: 'reservation',
    requirement: '需 MyLowe’s Rewards、儿童 Kids Profile 及提前预约；建议 4–11 岁，家长陪同。免费，名额依门店。',
    description: '官方明确列出 Firefighting Plane 10/17。选湾区附近门店和实际可用时段再报名；不要套用九月已结束的小鬼屋场次。',
    imageKey: 'family-workshop', imageNote: '亲子手作主题插图，非本次消防飞机成品', sourceUrl: 'https://www.lowes.com/events/register/firefighting-plane', sourceLabel: '消防飞机官方日期与预约', storeUrl: 'https://www.lowes.com/diy-projects-and-ideas/workshops',
  },
  {
    id: 'yogurtland-anniversary-oct20', brand: 'YOGURTLAND', title: '10/20 会员到店冰酸奶八折',
    dateLabel: '10/20 周二 · 参与门店营业时间', startDate: '2026-10-20', endDate: '2026-10-20', availability: 'dated', kind: 'purchase',
    requirement: 'Real Rewards 会员到店消费，可当天注册；结账出示 App 或账户手机号，不叠加优惠。',
    description: '官网公布 2026 每月 20 日八折，十月为 10/20。先查附近湾区门店是否参与；网单、第三方配送、团餐和礼品卡不适用。',
    imageKey: 'sep26-yogurtland-20', sourceUrl: 'https://www.yogurtland.com/news_posts/view/86/celebrating-20-years-of-yogurtland-anniversary-promo-how-you-can-join-the-fun', sourceLabel: 'Yogurtland 全年每月 20 日规则', storeUrl: 'https://www.yogurtland.com/locations',
  },
  {
    id: 'svma-free-wednesdays-october', brand: 'SONOMA VALLEY MUSEUM OF ART', title: 'Sonoma 周三免费美术馆时光',
    dateLabel: '每周三 · 11:00–17:00', availability: 'ongoing', kind: 'no-purchase',
    requirement: '周三普通入馆免费，无需会员或购买；仍需在前台登记，13 岁以下须成人陪同。',
    description: '551 Broadway，靠近 Sonoma Town Plaza。十月周三为 10/7、14、21、28；现展 M. Louise Stanley 持续至 2027/1/24。工作坊另看票价。',
    imageKey: 'culture-visit', imageNote: '看展主题插图，非该馆实景', sourceUrl: 'https://svma.org/visit/', sourceLabel: 'Sonoma 美术馆免费周三与闭馆公告',
  },
  {
    id: 'japanese-tea-garden-free-hour', brand: 'JAPANESE TEA GARDEN · SF', title: '周一三五，早一小时免费进茶园',
    dateLabel: '每周一、三、五 · 09:00–10:00', availability: 'ongoing', kind: 'no-purchase',
    requirement: '免费入园时段对所有人开放，无需消费或 SF 居民资格；茶点和特别项目另付。',
    description: '75 Hagiwara Tea Garden Drive，金门公园内。十月最后一场周五早场是 10/30；10:00 后入场不要再按免费时段计算。',
    imageKey: 'garden-walk', imageNote: '花园散步主题插图，非日本茶园实景', sourceUrl: 'https://gggp.org/tickets/', sourceLabel: '日本茶园官方免费入园时间',
  },
  {
    id: 'sfpl-discover-go', brand: 'SAN FRANCISCO PUBLIC LIBRARY', title: 'SF 居民用图书证预约免费场馆票',
    dateLabel: '长期福利 · 先查可预约日期', availability: 'ongoing', kind: 'reservation',
    requirement: 'SF 居民持 SFPL 图书证，通过 Discover & Go 预约；具体年龄、人数与入场凭证按所选场馆条款。',
    description: '九月下半月和整个十月都可查询可用日期，不保证每一天都有票。先登录选场馆，再确认人数与是否须打印，图书馆也可协助打印。',
    imageKey: 'library', sourceUrl: 'https://sfpl.org/discover-and-go', sourceLabel: 'SFPL Discover & Go 资格与入口',
  },
  {
    id: 'smcl-discover-go', brand: 'SAN MATEO COUNTY LIBRARIES', title: '半岛图书证，先核对卡号再借门票',
    dateLabel: '长期福利 · 最多同时两项预约', availability: 'ongoing', kind: 'reservation',
    requirement: '按现行 FAQ：须居住于 SMCL 服务范围内、持有效图书证且 16 岁及以上；eCard 和机构卡不适用。本人持有效证件在预约日使用。',
    description: '卡号以 29041 或 29731 开头可进县图书馆入口；San Mateo 市、Redwood City 等卡请用所属馆入口。名额与同行人数依场馆，打印后不能取消。',
    imageKey: 'october-library-culture', imageNote: '图书馆福利主题插图，非真实票证或馆舍', sourceUrl: 'https://smcl.org/faq/museum-passes-discover-go/', sourceLabel: 'SMCL 门票资格与预约 FAQ', storeUrl: 'https://smcl.org/blogs/post/explore-today-with-discover-go/',
  },
  {
    id: 'alameda-county-discover-go', brand: 'ALAMEDA COUNTY LIBRARY', title: '东湾居民先查图书馆免费或低价门票',
    dateLabel: '长期福利 · 以登录后可用票为准', availability: 'ongoing', kind: 'reservation',
    requirement: '15 岁及以上、居住在 AC Library 服务区域并有正式图书证；eCard 不适用。免费或低价及人数依具体票券。',
    description: '适合 Fremont、Dublin 等读者从自己的图书馆入口找湾区场馆；Alameda County、Alameda 市与 Oakland 图书证不同，部分票券只有折扣。',
    imageKey: 'october-library-culture', imageNote: '图书馆福利主题插图，非真实票证或馆舍', sourceUrl: 'https://aclibrary.org/faqs/', sourceLabel: 'AC Library Discover & Go 资格',
  },
  {
    id: 'santa-clara-library-parks-pass', brand: 'SANTA CLARA COUNTY PARKS', title: '借一张县公园车票，周末少付入园费',
    dateLabel: '长期福利 · 每次可借三周', availability: 'ongoing', kind: 'reservation',
    requirement: '需参与图书馆的图书证，向馆员借实体通行证；限一辆核载 15 人及以下乘用车或公路合法摩托车，库存有限。',
    description: 'SJPL、SCCLD、Santa Clara 市、Palo Alto、Sunnyvale、Los Gatos 与 Mountain View 图书馆参与。仅 Santa Clara 县公园；不含 Uvas Canyon、Sunnyvale Baylands、露营或其他公园系统。',
    imageKey: 'october-library-culture', imageNote: '图书馆福利主题插图，非真实公园通行证', sourceUrl: 'https://parks.santaclaracounty.gov/library-parks-pass', sourceLabel: 'Santa Clara 县图书馆公园通行证', storeUrl: 'https://parks.santaclaracounty.gov/library-parks-pass/faq',
  },
];

export const octoberOffers: FreebieOffer[] = [
  ...newOctoberOffers,
  ...septemberFreebies.filter(offer => offer.availability === 'ongoing' || offer.startDate?.startsWith('2026-10')),
];

export const currentFreebies: FreebieOffer[] = [...new Map([...septemberFreebies, ...octoberOffers, ...additionalOctoberOffers, ...autumnRefreshOffers, ...communityDiscoveryOffers].map(offer => [offer.id, offer])).values()]
  .filter(offer => !offer.endDate || offer.endDate >= '2026-09-23');

export const octoberOfferSources: GuideSource[] = [...new Map([
  ...currentFreebies.map(offer => ({ title: `${offer.brand}：${offer.sourceLabel}`, url: offer.sourceUrl, description: offer.requirement })),
  { title: 'Bank of America：十月日期与参与馆', url: 'https://about.bankofamerica.com/en/making-an-impact/museums-on-us-partners', description: '官网明确列 10/3–4；每个场馆可有额外限制，SFMOMA 名单仅列六月至九月。' },
  { title: 'Santa Clara 县公园：排除项', url: 'https://parks.santaclaracounty.gov/library-parks-pass/faq', description: '不含 Uvas Canyon、Sunnyvale Baylands、露营、州立或其他公园系统。' },
  { title: 'Lowe’s：工作坊日期与会员规则', url: 'https://www.lowes.com/diy-projects-and-ideas/workshops', description: '10/17 消防飞机为 10:00–13:00，需儿童资料及预约，建议 4–11 岁、家长陪同。' },
  { title: 'BAMPFA：开放时段与票种', url: 'https://bampfa.org/visit/hours', description: '展厅免费日不等于所有电影免费；留意季节性开放时段。' },
].map(source => [source.url, source])).values()];
