import type { SeptemberOpening } from './september-openings';

// New discoveries reviewed on 2026-09-30. A celebration date or a publisher's
// article date is deliberately not stored as the first public service date.
export const octoberRefreshOpenings: SeptemberOpening[] = [
  {
    id: 'sucre-damour-fremont-celebration-2026', name: 'Sucré d’Amour Café & Sushi',
    city: 'Fremont', region: 'east-bay', category: '咖啡甜品与寿司 · 开业庆典',
    status: 'open', openingType: 'opening-celebration',
    dateLabel: '现已营业 · 市府预告 10/11 11:30 开始庆典，非首营业日',
    summary: 'Mission Boulevard 的新店把手作饮品、甜品、下午茶与寿司放在同一菜单。品牌官网已列常规营业时间与点单入口；Fremont 市府九月通讯另预告十月开业庆典。',
    editorTip: '10/11 的庆典开始时间与通常周日中午开门不同，先核当日安排。官网有试营业赠袋图片，但未核清有效期与领取门槛，不承诺十月到店有赠品；餐饮需付费。',
    address: '43571 Mission Blvd, Fremont, CA 94539',
    officialUrl: 'https://www.sucredamourca.com/',
    sourceUrl: 'https://content.govdelivery.com/bulletins/gd/CAFREMONT-4293ade?wgt_ref=CAFREMONT_WIDGET_5',
    sourceLabel: 'Fremont 市府 · 2026 九月经济通讯；品牌官网',
    verifiedAt: '2026-09-30', imageKey: 'neighborhood-table',
  },
  {
    id: 'dead-letter-sonoma-new-restaurant-2026', name: 'Dead Letter',
    city: 'Sonoma', region: 'north-bay', category: '新餐厅 · 炭火加州料理',
    status: 'open', openingType: 'new-restaurant',
    dateLabel: '初秋新店 · 9/1 旅游局已报道营业，首日未核实',
    summary: 'the girl & the fig 团队在 Sonoma Plaza 的历史邮局建筑开设新餐厅，以时令食材、炭火烹调和分享菜为主，也有数字艺术展陈。官网当前提供菜单、营业时间与订位入口。',
    editorTip: '目前官网列周三至周日 17:00 开门，周一、周二休息；先查菜单价格与可订时段。本文是新店资讯，非亲测食评；9/1 是旅游局文章日期，不作开业日，也没有已核实开业折扣。',
    address: '101 E Napa Street, Sonoma, CA 95476',
    officialUrl: 'https://www.deadlettersonoma.com/location/dead-letter/',
    sourceUrl: 'https://www.sonomacounty.com/media/whats-new/whats-new-in-sonoma-county-late-summer-early-fall-2026/',
    sourceLabel: 'Sonoma County Tourism · 2026 年 9 月 1 日；餐厅官网',
    verifiedAt: '2026-09-30', imageKey: 'neighborhood-table',
  },
];
