import { verifiedOffers20261005 } from './verified-offers-2026-10-05';
import type { Guide } from './guides';
import { currentFreebies } from './october-offers';
import { targetLowesOffers2026, targetLowesUpdates2026 } from './retail-target-lowes-2026';
import { familyRetailOffers2026, familyRetailUpdates2026 } from './retail-family-2026';
import { diningRetailOffers2026, diningRetailUpdates2026 } from './retail-dining-2026';

const ids = new Set([
  ...targetLowesOffers2026, ...familyRetailOffers2026, ...diningRetailOffers2026, ...verifiedOffers20261005,
].map(offer => offer.id).concat(Object.keys({ ...targetLowesUpdates2026, ...familyRetailUpdates2026, ...diningRetailUpdates2026 })));
// Include already-published chain perks so this brand directory is complete,
// while keeping the existing canonical records and their original review dates.
for (const id of [
  'lowes-firefighting-plane-oct17', 'ikea-family-hot-drink', 'ikea-emeryville-as-is-wednesdays',
  'ikea-family-heritage-meal-oct15-2026', 'ikea-kustfyr-halloween-oct12-2026',
  'starbucks-cafe-refills', 'roundup-starbucks-free-mod-2026',
  'roundup-mcdonalds-medium-fries-oct4-2026', 'roundup-wendys-weekly-app-offers-2026',
  'noahs-rewards-order-ahead-coffee', 'ikes-love-welcome-sandwich', 'jamba-welcome-half-price',
]) ids.add(id);
const offers = currentFreebies.filter(offer => ids.has(offer.id));
export const retailPerksGuides2026: Guide[] = [{
  slug: 'bay-area-retail-freebies-family-deals',
  title: 'Target、Lowe’s 到餐饮 App：湾区赠品与优惠查找手册',
  subtitle: '门店赠品、亲子手作、新会员礼与日常折扣，一次看清领取条件',
  summary: '从 Target 的限定门店活动、Lowe’s 儿童工作坊，到 Michaels、Lakeshore、IKEA 和餐饮会员礼。按品牌搜索，先看活动日期、年龄、预约及消费门槛，再决定是否值得专程出门。',
  category: 'events', categoryLabel: '生活活动', emoji: '🛍️', priority: 'P0', featuredOnHome: true,
  audience: ['想找门店赠品的湾区居民', '安排免费亲子活动的家庭', '想少花冤枉钱的新会员'],
  tags: ['Freebies', 'Target', 'Lowe’s', 'Home Depot', 'Michaels', 'Lakeshore', 'IKEA', 'LEGO', '优惠', '亲子手作', '新会员礼'],
  recommendedForCategories: ['other'], readMinutes: 9, updatedAt: '2026-10-05',
  sourceNote: '2026-10-04–05 查阅品牌官方活动、参与店名单及会员规则；各项目的核验日期见卡片。每张卡保留来源，名额、赠品和账户券以品牌实时页面为准。只公布官方资料可确认的内容，不用往年日期推算今年活动。',
  sources: [...new Map(offers.map(offer => [offer.sourceUrl, { title: offer.sourceLabel, url: offer.sourceUrl, description: offer.requirement }])).values()],
  blocks: [
    { type: 'heading', text: '先选领取方式，再找顺路门店' },
    { type: 'list', items: [
      '无需购物：仍可能要求免费会员、指定年龄、签到或限量排队；「无需购物」不代表每一家店都有。',
      '需预约：先完成品牌官网报名，确认本地门店和人数。Lowe’s 等儿童项目通常需要家长陪同；未报名或迟到不能保证材料。',
      '需消费：买饮品送食物、买成人餐送儿童餐、首次订单折扣、历史消费才有生日礼，都归入这一类。先看最低金额和不可叠加条件。',
    ] },
    { type: 'heading', text: 'Target：参与门店名单比海报更重要' },
    { type: 'paragraph', text: '大型连锁的活动页、品牌联名活动和店内试用经常采用不同的参与店名单。先从卡片打开官方入口，再查看活动对应的店表；同一座城市里，不同 Target 也可能不参加同一场活动。限前若干名或赠完即止的礼物，不能当成预订成功的保证。' },
    { type: 'heading', text: 'Lowe’s 与手作活动：先锁定孩子的名额' },
    { type: 'paragraph', text: '把项目当天日期和开放报名日分开记。Lowe’s 的后续月份活动可先规划，再按开放时间报名；Michaels 不同课程分别有「材料全包免费」与「需购买指定材料」两类活动。Lakeshore 使用官方明确标注年份的日历，仍需先查看所选门店。' },
    { type: 'heading', text: '新会员礼：到账后再下单' },
    { type: 'list', items: [
      '注册、下载 App 和奖励到账不是同一件事。先确认账户真的收到券，选择符合资格的商品，再查看结账金额。',
      '读清首单、最低消费、指定下单渠道和有效天数。不要把买一送一、积分或折扣说成可以直接免费领取。',
      '只按本人真实资料加入需要的会员计划；同一人的重复注册不能默认再次获得新会员奖励。',
    ] },
    { type: 'freebies', title: '按品牌找赠品、活动和优惠', text: '可输入 Target、Lowe’s、Michaels、城市或关键词，再按领取条件筛选。已结束和当前待确认的项目不会展示在清单中。', offers },
    { type: 'link', title: '生日福利图鉴与可下载图文', text: '生日礼通常有提前注册要求，提早准备更从容。', url: 'https://www.baylink.us/guides/bay-area-birthday-perks' },
    { type: 'link', title: '湾区日常免费福利', text: '图书馆、打印、种子、博物馆与公园通行证。', url: 'https://www.baylink.us/guides/bay-area-everyday-free-perks' },
    { type: 'link', title: '十月完整优惠清单', text: '继续查看场馆免费日、公共服务和本地限时优惠。', url: 'https://www.baylink.us/guides/bay-area-freebies-deals-2026-10' },
  ],
}];
