import type { FreebieOffer } from '../components/FreebieBoard';

// Original terms checked 2026-09-11; expired 9/20 card removed 2026-09-23.
export const verifiedSeptemberOffers: FreebieOffer[] = [
  {
    id: 'peets-orange-friday-sep25', brand: 'PEET’S', title: '一句暗号，$1 小杯冷萃',
    dateLabel: '9/25 周五 · 12:00 至打烊', startDate: '2026-09-25', endDate: '2026-09-25',
    availability: 'dated', kind: 'purchase',
    requirement: '结账说 ORANGE FRIDAY，每人限一杯；额外配料另收费，不可叠加优惠。',
    description: '参与活动的北加州 Peet’s 零售咖啡店适用；机场、超市内门店及其他特许经营点除外。官网明确列出 2026 年 9 月 25 日。',
    imageKey: 'sep26-peets-orange', imageNote: '冷萃饮品示意；优惠为小杯，配料另计',
    sourceUrl: 'https://www.peets.com/pages/current-offers', sourceLabel: 'Orange Friday 价格与门店限制',
    storeUrl: 'https://www.peets.com/pages/store-locator',
  },
  {
    id: 'target-beauty-sep26', brand: 'TARGET', title: 'Beauty 样品盒，认准这份门店名单',
    dateLabel: '9/26 周六 · 12:00–16:00', startDate: '2026-09-26', endDate: '2026-09-26',
    availability: 'dated', kind: 'no-purchase',
    requirement: '指定门店前 100 名符合条件顾客，16 岁及以上，每人一盒。礼盒没有列消费门槛。',
    description: 'Sunnyvale McKinley、San Jose Coleman／Saratoga／N Capitol 等在礼盒名单内。另有 Circle 满 $50 减 $20，别把付费折扣当领取条件。',
    imageKey: 'sep26-target-beauty', imageNote: '官方礼盒宣传图；具体样品与库存以门店为准',
    sourceUrl: 'https://www.target.com/c/target-beauty-studio-event/-/N-140b1', sourceLabel: 'Beauty Studio 礼盒规则',
    storeUrl: 'https://target.scene7.com/is/content/Target/GUEST_600267fa-a1ec-48f3-b679-3fcd3a8c52bd',
  },
  {
    id: 'peets-cold-brew-pass-september', brand: 'PEET’S', title: '$30 冷萃月卡，常路过再买',
    dateLabel: '9/1–9/30 可购 · 购买起连续 30 天', startDate: '2026-09-01', endDate: '2026-09-30',
    availability: 'dated', kind: 'purchase',
    requirement: 'Peetnik Rewards 会员在 App 支付 $30，每人一张；不退款、不转让，配料另收费。',
    description: '每天一杯中杯 Cold Brew，当天不用不累计。参与咖啡店适用，机场、超市与特许经营点除外；先确认常去的店，少去也仍需付整张月卡费用。',
    imageKey: 'sep26-peets-pass', imageNote: '冷萃饮品示意；月卡需支付 $30，非免费领咖啡',
    sourceUrl: 'https://www.peets.com/pages/current-offers', sourceLabel: 'Cold Brew Pass 完整条款',
    storeUrl: 'https://www.peets.com/pages/store-locator',
  },
  {
    id: 'starbucks-cafe-refills', brand: 'STARBUCKS', title: '坐下来喝，指定咖啡和茶可免费续杯',
    dateLabel: '日常福利 · 同一次堂食期间', availability: 'ongoing', kind: 'purchase',
    requirement: '先买饮品并在店内享用；续杯限同次到店的指定热／冰冲煮咖啡和茶。适用门店为准。',
    description: '可先问店员并使用堂食杯。续杯不含 Cold Brew、Nitro、冰茶柠檬水、调味冰茶及 Refreshers；拿铁也不在免费续杯清单内。',
    imageKey: 'sep26-starbucks-refills', imageNote: '堂食续杯情境示意，非官方促销图',
    sourceUrl: 'https://about.starbucks.com/back-to-starbucks/', sourceLabel: '堂食续杯范围与例外',
    storeUrl: 'https://www.starbucks.com/store-locator',
  },
  {
    id: 'homedepot-october-preview', brand: 'THE HOME DEPOT', title: '10/3 免费做女巫糖果盒',
    dateLabel: '10/3 周六 · 需提前预约', startDate: '2026-10-03', endDate: '2026-10-03',
    availability: 'dated', kind: 'reservation',
    requirement: '免费儿童工作坊，先选门店查看预约；名额和材料有限，预约不保证材料库存。',
    description: '十月首个周六是 10 月 3 日；可在官方页面选择附近门店查看 Witch Candy Box 预约，实际时段和材料以门店为准。',
    imageKey: 'sep26-homedepot-preview', imageNote: '十月项目官方宣传照片，非九月正在领取',
    sourceUrl: 'https://www.homedepot.com/c/kids-workshop', sourceLabel: 'Home Depot 下一期预约',
    storeUrl: 'https://www.homedepot.com/l',
  },
];
