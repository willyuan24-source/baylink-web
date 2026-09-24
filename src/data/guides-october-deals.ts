import type { Guide } from './guides';
import { currentFreebies, octoberOfferSources } from './october-offers';

export const octoberDealsGuides: Guide[] = [{
  slug: 'bay-area-freebies-deals-2026-10',
  title: '2026 年 10 月湾区省钱攻略：免费场馆、亲子手工与图书馆门票',
  subtitle: '从 10/1 到月底，把本地免费日和真正用得上的福利排进日历',
  summary: '10/1 BAMPFA、10/2 SJMA、10/3–4 电脑历史馆持卡福利、10/4 OMCA 与亚洲艺术博物馆、10/6 温室、10/13 植物园、10/17 免费消防飞机、10/20 冰酸奶八折；再用图书馆门票与公园车票安排月底。',
  category: 'events', categoryLabel: '生活活动', emoji: '🎁',
  audience: ['湾区亲子家庭', '想省门票的本地居民', '十月周末出行者'],
  tags: ['2026年10月', '当月优惠', '免费场馆', '亲子手工', 'Discover & Go', 'BAMPFA', 'OMCA', 'Lowe’s', 'Yogurtland', '图书馆', '南湾', '东湾', '半岛', '北湾'],
  priority: 'P0', featuredOnHome: true, recommendedForCategories: ['other'], readMinutes: 9,
  updatedAt: '2026-09-23', editionMonth: '2026-10',
  sourceNote: '2026-09-23 增补本地福利并清理过期条目。新增项目按当日官方来源整理，原有条目逐项复核；部分页面读取受限，相关条款保留 9 月 8–15 日的核查记录。每月或每周规则换算的日期在条目内注明；库存、门店参与、预约余票和临时闭馆仍需出发前确认。',
  sources: octoberOfferSources,
  blocks: [
    { type: 'freebies', title: '九月剩余优惠与十月本地福利', text: '固定日期、需要预约和消费优惠已分开。长期福利可安排到月底，预约成功与现场库存以官方页面为准。', offers: currentFreebies },
    { type: 'heading', text: '先锁定十月前两周' },
    { type: 'list', items: [
      '10/1 周四｜Berkeley 的 BAMPFA 展厅免费；电影另购票。',
      '10/2 周五｜18:00 后到 San José Museum of Art 免费看展，餐饮自付。',
      '10/3 周六｜Home Depot 免费儿童手工先查附近店预约；10/3–4 的电脑历史馆持卡福利只免持卡人本人。',
      '10/4 周日｜OMCA 免费政策包含特别展览；亚洲艺术博物馆则只有普通门票免费，特展加 $10。',
      '10/6 周二｜温室首个周二免费；10/13 周二｜植物园第二个周二免费。两者不是同一天。',
    ] },
    { type: 'link', title: 'BAMPFA 免费首个周四日历', text: '所有访客免费参观展厅，无需会员或消费；电影放映另行购票。', url: 'https://bampfa.org/event/free-first-thursdays' },
    { type: 'heading', text: '十月中旬到万圣节周末' },
    { type: 'list', items: [
      '10/17 周六｜Lowe’s 消防飞机免费工作坊，先建儿童资料并确认门店名额。',
      '10/20 周二｜Yogurtland 会员到店八折，不适用网单或配送。',
      '10/21、10/28 周三｜Sonoma 美术馆按每周规则免费；看完可在 Town Plaza 周边散步。',
      '10/23、10/26、10/28、10/30｜日本茶园分别为周五、周一、周三、周五，09:00–10:00 可免费入园。',
      '10/24–25 与 10/31 周末｜提前查 Discover & Go 的当天余票，或借 Santa Clara 县公园通行证；借票成功后再安排交通。',
    ] },
    { type: 'tip', title: '免费入馆和免费活动票，要分清楚', text: '十月普通免费日不自动包含万圣节夜场、特展或工作坊。票面若写明额外收费，按该票种处理；没有官方公布的十月赠品，不从九月活动推算。' },
    { type: 'heading', text: '图书馆门票：三个动作减少扑空' },
    { type: 'list', items: [
      '先用自己的发卡馆入口：SFPL 需 SF 居民；SMCL 与 AC Library 均需居住在各自服务区域。卡号只识别入口，不代表有预约资格。',
      '看年龄和卡种：SMCL 现行 FAQ 写 16 岁及以上，AC Library 写 15 岁及以上；两者都不接受 eCard。不同场馆还可能有年龄限制。',
      '确认日期、同行人数、证件和打印要求后再出票；可用场馆与名额随登录账户变化，不保证全家所有人免费。',
    ] },
    { type: 'link', title: 'SMCL 门票资格与预约 FAQ', text: '查图书馆门票资格、所在服务区与预约取消规则。', url: 'https://smcl.org/faq/museum-passes-discover-go/' },
    { type: 'heading', text: '南湾周末：借票去县公园' },
    { type: 'paragraph', text: '先向参与图书馆询问 Santa Clara County Library Parks Pass 是否可借，借期三周。它只覆盖指定县公园的车辆入园，不是州立公园通票，也不免露营费；Uvas Canyon 与 Sunnyvale Baylands 不在范围内。' },
    { type: 'link', title: 'Santa Clara 县图书馆公园通行证', text: '查参与图书馆、三周借期与县公园使用范围。', url: 'https://parks.santaclaracounty.gov/library-parks-pass' },
    { type: 'checklist', items: [
      '保存预约确认与证件，按日期使用；如果活动满额，改选附近同类场馆。',
      '把过桥费、停车、交通和餐饮计入预算，优先挑离家近的福利。',
      '出发当天再看官网开放公告；免费并不保证免排队或一定有名额。',
    ] },
    { type: 'cta', title: '把省下的门票，换成一段本地散步', text: '继续查看十月湾区活动和各片区路线，找同一区域能顺路完成的半日安排。', primaryLabel: '继续看生活指南', primaryAction: 'guides' },
  ],
}];
