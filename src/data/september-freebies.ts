import type { FreebieOffer } from '../components/FreebieBoard';
import type { GuideSource } from './guides';
import { verifiedSeptemberOffers } from './september-offers-update';

const originalSeptemberFreebies: FreebieOffer[] = [
  {
    id: 'target-eucerin-sep12', brand: 'TARGET', title: 'Eucerin 护肤试用装',
    dateLabel: '9/12 周六 · 12:00–16:00', startDate: '2026-09-12', endDate: '2026-09-12',
    availability: 'dated', kind: 'no-purchase', requirement: '16 岁及以上；每人一份，数量有限。官方未列购买、会员或报名门槛。',
    description: '到指定店的 Eucerin 活动区领取。Daly City Serramonte、Fremont Pacific Commons、Mountain View Showers 等在官方名单内。',
    imageKey: 'target-eucerin', imageNote: '领取的是试用装，非图中正装',
    sourceUrl: 'https://www.target.com/c/eucerin-launch-store-events/-/N-6700v', sourceLabel: 'Eucerin 活动与领取细则',
    storeUrl: 'https://target.scene7.com/is/content/Target/GUEST_72df0191-4570-4f66-9f53-ac9d7ab0a550',
  },
  {
    id: 'lowes-haunted-house-sep12', brand: 'LOWE’S', title: '免费做一座小鬼屋',
    dateLabel: '9/12 周六 · 10:00–13:00', startDate: '2026-09-12', endDate: '2026-09-12',
    availability: 'dated', kind: 'reservation', requirement: '免费；需 MyLowe’s Rewards、儿童 Kids Profile，并提前预约。建议 4–11 岁，家长陪同。',
    description: 'Haunted House 是本月免费 Kids Club 项目。先选附近门店和可用时段；名额满了就换店，不直接假设现场有材料。',
    imageKey: 'freebie-lowes-haunted-house',
    sourceUrl: 'https://www.lowes.com/events/register/haunted-house', sourceLabel: 'Haunted House 免费预约',
    storeUrl: 'https://www.lowes.com/store/',
  },
  {
    id: 'michaels-foam-sep12', brand: 'MICHAELS', title: '免费泡棉拼贴手工',
    dateLabel: '9/12 周六 · 10:00–12:00', startDate: '2026-09-12', endDate: '2026-09-12',
    availability: 'dated', kind: 'no-purchase', requirement: 'Kids Club 免费活动；适合 4 岁以上，无需报名。材料与场次以门店为准。',
    description: '用彩色泡棉和线做一幅小拼贴，完成后带回家。Emeryville 店在 3991 Hollis St；官网可设置提醒，但提醒不是入场券。',
    imageKey: 'freebie-michaels-foam',
    sourceUrl: 'https://www.michaels.com/class/kidsclubquiltedfoamart-45085432857263496-49435626159496', sourceLabel: 'Quilted Foam Art 官方场次',
    storeUrl: 'https://locations.michaels.com/ca/emeryville/1538',
  },
  {
    id: 'target-beauty-sep26', brand: 'TARGET', title: 'Beauty 样品礼盒',
    dateLabel: '9/26 周六 · 12:00–16:00', startDate: '2026-09-26', endDate: '2026-09-26',
    availability: 'dated', kind: 'no-purchase', requirement: '指定门店，16 岁及以上，前 100 名符合条件顾客；每人一盒。无需为礼盒消费。',
    description: 'Sunnyvale McKinley、San Jose Coleman／Saratoga／N Capitol 等在礼盒名单内。当天另有 Circle 满额折扣，它不是领取礼盒的条件。',
    imageKey: 'target-beauty-box',
    sourceUrl: 'https://www.target.com/c/target-beauty-studio-event/-/N-140b1', sourceLabel: 'Beauty Studio 活动与礼盒条款',
    storeUrl: 'https://target.scene7.com/is/content/Target/GUEST_600267fa-a1ec-48f3-b679-3fcd3a8c52bd',
  },
  {
    id: 'michaels-ghosts-sep26', brand: 'MICHAELS', title: '免费布艺小幽灵',
    dateLabel: '9/26 周六 · 10:00–12:00', startDate: '2026-09-26', endDate: '2026-09-26',
    availability: 'dated', kind: 'no-purchase', requirement: 'Kids Club 免费活动；适合 4 岁以上，无需报名，现场材料有限。',
    description: '用入门缝纫技巧做 Fabric Ghosts，为万圣节先添一个小摆件。查询附近门店；不要把需要买底材的 MakeBreak 和免费 Kids Club 混淆。',
    imageKey: 'freebie-michaels-ghosts',
    sourceUrl: 'https://www.michaels.com/class/kids-club-fabric-ghosts-716121777247387016-290096423091592', sourceLabel: 'Fabric Ghosts 官方场次',
    storeUrl: 'https://locations.michaels.com/ca',
  },
  {
    id: 'lowes-kids-lollipop', brand: 'LOWE’S', title: '顺路领一根儿童棒棒糖',
    dateLabel: '长期福利 · 每次到店可询问', availability: 'ongoing', kind: 'no-purchase',
    requirement: 'MyLowe’s Rewards 会员已为孩子建立 Kids Profile；无需购物或预约，送完为止。',
    description: '到 Customer Service Desk 客服柜台向店员询问免费的 organic lollipop。适合家长本来就要去采购时，顺路带孩子领取。',
    imageKey: 'freebie-lowes-kids-lollipop',
    sourceUrl: 'https://www.lowes.com/diy-projects-and-ideas/workshops', sourceLabel: 'Kids Club 棒棒糖福利',
    storeUrl: 'https://www.lowes.com/store/',
  },
  {
    id: 'ikea-family-hot-drink', brand: 'IKEA', title: '会员普通咖啡或茶',
    dateLabel: '长期福利 · 按餐厅时段', availability: 'ongoing', kind: 'no-purchase',
    requirement: '出示 IKEA Family 条码，无需另购商品；周末及适用饮品先向门店确认。',
    description: '在 Swedish Restaurant 使用。湾区可查 Emeryville 与 East Palo Alto；餐厅和商店的营业时间不同。',
    imageKey: 'freebie-ikea-coffee',
    sourceUrl: 'https://www.ikea.com/us/en/ikea-family/', sourceLabel: 'IKEA Family 热饮福利',
    storeUrl: 'https://www.ikea.com/us/en/stores/',
  },
  {
    id: 'sephora-birthday', brand: 'SEPHORA', title: '生日月到店领取小样礼',
    dateLabel: '长期福利 · 生日领取窗口', availability: 'ongoing', kind: 'no-purchase',
    requirement: '符合 Beauty Insider 资格；生日当月或前后两周，每年一次。到店领取无需购物。',
    description: '提供会员邮箱或手机号查可选礼物。Sephora 官网兑换需折后税前满 $25；店内款式随库存变化，不能保证图中套装。',
    imageKey: 'freebie-sephora-birthday', imageNote: '年初示例，非九月库存',
    sourceUrl: 'https://www.sephora.com/beauty/birthday-gift', sourceLabel: '生日礼与兑换条款',
    storeUrl: 'https://www.sephora.com/happening/stores/emeryville?storeId=0116',
  },
  {
    id: '85c-september-cake', brand: '85°C BAKERY CAFE', title: '买咖啡，加 $1 换蛋糕',
    dateLabel: '9/1–9/30 · 门店营业时间', startDate: '2026-09-01', endDate: '2026-09-30',
    availability: 'dated', kind: 'purchase', requirement: '需 App 券；买指定咖啡，加 $1 换指定切片蛋糕，每会员一次。',
    description: '仅店内兑换，先扫码用券再付款。不需要积分，但咖啡仍需付费；不叠加其他优惠，商品售完为止。',
    imageKey: 'deal-85c-september',
    sourceUrl: 'https://www.85cbakerycafe.com/menu_tag/top-picks/', sourceLabel: 'September Sweet Treat 条款',
    storeUrl: 'https://85cbakerycafe.orderexperience.net/85cbakerycafe/locations',
  },
  {
    id: 'homedepot-october-preview', brand: 'THE HOME DEPOT', title: '下月女巫糖果盒，先预约',
    dateLabel: '10/3 周六 · 九月可先预约', startDate: '2026-10-03', endDate: '2026-10-03',
    availability: 'dated', kind: 'reservation', requirement: '免费儿童手工，建议 5–12 岁、家长陪同；需预约，材料有限，报名不保证有套件。',
    description: '九月 5 日的 School Bus Organizer 已结束。下一期是 Witch Candy Box；San Mateo #0632 已显示该预约选项，时段依报名页面。',
    imageKey: 'freebie-homedepot-witch-candy-box',
    sourceUrl: 'https://www.homedepot.com/c/kids-workshop', sourceLabel: '查看十月手工预约',
  },
];

export const septemberFreebies: FreebieOffer[] = [...new Map([...originalSeptemberFreebies, ...verifiedSeptemberOffers].map(offer => [offer.id, offer])).values()];

const extras: GuideSource[] = [
  { title: 'Target：9/12 Eucerin 参与门店名单', url: septemberFreebies[0].storeUrl!, description: '这是 9/12 对应名单，含 Daly City、Fremont、Mountain View 等湾区门店；数量仍以现场为准。' },
  { title: 'Target：9/26 Beauty 样品盒指定门店名单', url: septemberFreebies[3].storeUrl!, description: '礼盒只在指定店发放；不要将一般 Beauty 活动门店与礼盒门店混用。' },
  { title: 'Michaels：店内活动 FAQ', url: 'https://www.michaels.com/customer-care/classes-events-and-parties/in-store-events-faq', description: '核对无需报名、Kids Club 年龄与 MakeBreak 购买底材的区别。' },
  { title: 'Michaels：九月活动日历', url: 'https://www.michaels.com/events-and-services', description: '核对 9/12 Quilted Foam Art、9/26 Fabric Ghosts 等官方项目日期。' },
  { title: 'Michaels Emeryville：官方门店', url: 'https://locations.michaels.com/ca/emeryville/1538', description: '3991 Hollis Street；出发前查询营业时间与本店活动。' },
];

export const septemberFreebieSources: GuideSource[] = [
  ...septemberFreebies.map(offer => ({ title: `${offer.brand}：${offer.sourceLabel}`, url: offer.sourceUrl, description: offer.requirement })),
  ...extras,
];
