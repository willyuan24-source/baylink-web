import type { Guide, GuideBlock } from './guides';
import { septemberOpenings } from './september-openings';

export const septemberOpeningGuides: Guide[] = [{
  slug: 'bay-area-new-openings-2026-09',
  title: '九月湾区新店手册：水岸晚餐、街角烘焙与下一站期待',
  subtitle: '已开业、开业庆典与预告，出门前一次看清',
  summary: 'Sergeant Ma 的水岸晚餐、Marina 的咖啡烘焙庆典，以及 Mission、Russian Hill、渔人码头和 San Jose 的开业消息。附地址、商家入口与消息日期。',
  category: 'city', categoryLabel: '新店观察', emoji: '☕',
  audience: ['想找新地方吃饭的人', '咖啡与烘焙爱好者', '周末街区散步的人'],
  tags: ['九月新店', '2026 年 9 月', '餐厅', '咖啡', '烘焙', '旧金山', 'San Jose'],
  priority: 'P1', featuredOnHome: true, recommendedForCategories: ['other'],
  readMinutes: 6, updatedAt: '2026-09-11', editionMonth: '2026-09',
  sourceNote: '核查于 2026 年 9 月 11 日。本文整理商家公告与本地媒体报道，尚未实地探店；“推荐”是按地点、餐饮类型与出行便利给出的编辑建议，不是评分或质量担保。日期不明确的项目保留为预告，庆典不视为首次营业。',
  sources: [...new Map(septemberOpenings.flatMap(shop => [
    { title: `${shop.name} · ${shop.sourceLabel}`, url: shop.sourceUrl, description: shop.dateLabel },
    { title: `${shop.name} · 商家入口`, url: shop.officialUrl, description: '出发前确认菜单、预约与当天营业安排。' },
  ]).map(source => [source.url, source])).values()],
  blocks: [
    { type: 'paragraph', text: '新店不一定要赶开门的第一天。先看它适不适合你这次出门：是一顿可以订位的晚餐、一杯顺路买的咖啡，还是值得再等一次公告的新地方。这份手册把已经发生的开业和还在计划中的消息分开，留给你自己挑选。' },
    { type: 'tip', title: '先读日期，再决定要不要出发', text: '已开业代表来源确认已开始营业；开业庆典是一场活动，未必是开门第一天。预告可能延期，不会因为日历到了就自动成为“已开”。看到想去的店，先点商家入口确认。' },
    ...septemberOpenings.flatMap((shop): GuideBlock[] => [
      { type: 'heading', text: shop.name },
      { type: 'paragraph', text: `${shop.dateLabel}。${shop.summary}` },
      { type: 'list', items: [shop.address, shop.editorTip] },
      { type: 'link', title: `${shop.name} · 商家入口`, text: '查看商家的菜单、营业公告与预约入口。', url: shop.officialUrl },
      { type: 'link', title: shop.sourceLabel, text: `开业消息核对：${shop.verifiedAt}`, url: shop.sourceUrl },
    ]),
    { type: 'heading', text: '别赶场，顺路就好' },
    { type: 'list', items: ['水岸晚餐可以搭一小段散步；不用再跨城赶第二家。', '开业优惠先问清饮品或赠品范围，菜单价格与库存以店内为准。', '临时没有开门就换附近熟悉的选择，别把还没确认的预告排成紧凑行程。'] },
    { type: 'link', title: '继续翻九月月刊', text: '把新店和附近活动放在同一天，看看本月还有哪些值得出门的理由。', url: 'https://www.baylink.us/this-month#monthly-openings' },
  ],
}];
