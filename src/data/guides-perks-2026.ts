import type { Guide } from './guides';
import { currentFreebies } from './october-offers';
import { birthdayPerks2026, birthdayPerkUpdates2026 } from './birthday-perks-2026';
import { everydayPerks2026 } from './everyday-perks-2026';

const birthdayIds = new Set([...birthdayPerks2026.map(offer => offer.id), ...Object.keys(birthdayPerkUpdates2026)]);
const everydayIds = new Set(everydayPerks2026.map(offer => offer.id));
const birthdayOffers = currentFreebies.filter(offer => birthdayIds.has(offer.id) || /生日|birthday/i.test(`${offer.title} ${offer.dateLabel}`));
const everydayOffers = currentFreebies.filter(offer => everydayIds.has(offer.id));
const drafts: Guide[] = [
  {
    "category": "events",
    "categoryLabel": "生活活动",
    "emoji": "🎁",
    "priority": "P0",
    "featuredOnHome": true,
    "recommendedForCategories": [
      "other"
    ],
    "updatedAt": "2026-10-04",
    "slug": "bay-area-birthday-perks",
    "title": "湾区生日福利图鉴：饮品、甜点、美妆与电影",
    "subtitle": "提前准备，生日月少一点扑空，多一点小惊喜",
    "summary": "把生日礼分成到店无需购物、需要历史消费、凭账户优惠三类。逐项看注册时间、兑换窗口和参与门店，先确认奖励到账，再安排顺路领取。",
    "audience": [
      "生日将近的湾区居民",
      "想替朋友整理领取清单的人"
    ],
    "tags": [
      "生日福利",
      "Birthday freebies",
      "Starbucks",
      "Sephora",
      "Ulta",
      "Dutch Bros",
      "AMC",
      "Panera"
    ],
    "readMinutes": 7,
    "sourceNote": "2026-10-04 按品牌美国官网核对。会员条款、礼物库存与实际到账时间会变化；图文保留核对日期，不代表生日当天一定有货。",
    "sources": [],
    "blocks": [
      {
        "type": "freebies",
        "title": "生日礼，先看门槛再挑喜欢的",
        "text": "「需消费」也包含有历史交易要求的福利；到店领取免费，不代表新注册就能马上领取。",
        "offers": []
      },
      {
        "type": "heading",
        "text": "生日月开始前：先把资格准备好"
      },
      {
        "type": "list",
        "items": [
          "只加入自己会用的免费会员计划，填写真实生日；检查邮件接收设置和账户资料是否完整。",
          "AMC 须在生日月首日前至少 30 天完成注册并填写生日；临近生日再加入，不能默认本月就有。每个品牌分别看卡片中的截止条件。",
          "已有 Starbucks 账户也要检查当年的合格交易要求。为领一杯饮品而额外消费前，先算是否值得。"
        ]
      },
      {
        "type": "heading",
        "text": "生日月：先看券，再决定去哪家"
      },
      {
        "type": "list",
        "items": [
          "先打开账户、App 或品牌邮件，确认券已到账、过期日、参与门店和可兑换商品；没有到账时用官方客服核对。",
          "Sephora 到店生日礼无需购物，线上兑换有购物门槛；不要为了小样凑一笔原本不需要的订单。",
          "将领取排进已有的逛街、通勤或看电影安排。礼物省下的金额，要扣除额外停车、车费和加购。"
        ]
      },
      {
        "type": "heading",
        "text": "生日当天：留意最短的窗口"
      },
      {
        "type": "paragraph",
        "text": "Starbucks 普通 Green 会员的生日奖励仅当天有效；Gold 为生日开始的 7 天，Reserve 为 30 天。它不是所有人都可在生日月任意一天领取的饮品。"
      },
      {
        "type": "heading",
        "text": "别把旧截图当作今天的承诺"
      },
      {
        "type": "paragraph",
        "text": "Red Robin 2026 年 6 月版条款已将旧的成人 Birthday Burger 调整为个性化奖励；「人人生日免费汉堡」不能继续照搬。不同会员等级的礼物也不能放在同一张卡上当作基础会员福利。"
      },
      {
        "type": "checklist",
        "items": [
          "账户生日正确，提前注册要求已满足。",
          "奖励已到账，保存到期日与参与门店。",
          "到店前查看库存提示，只领自己真正想要的。"
        ]
      },
      {
        "type": "link",
        "title": "继续看日常免费生活",
        "text": "图书馆、艺术空间和亲子去处，不用等到生日。",
        "url": "https://www.baylink.us/guides/bay-area-everyday-free-perks"
      }
    ]
  },
  {
    "category": "events",
    "categoryLabel": "生活活动",
    "emoji": "🎁",
    "priority": "P0",
    "featuredOnHome": true,
    "recommendedForCategories": [
      "other"
    ],
    "updatedAt": "2026-10-05",
    "slug": "bay-area-everyday-free-perks",
    "title": "湾区免费生活清单：从图书馆到周末小旅行",
    "subtitle": "五个片区，先选离自己近、资格也合适的一项",
    "summary": "补充旧金山、东湾、半岛、南湾和北湾的日常资源。每项写清免费范围、图书证或预约条件，再把它放进学习、亲子和周末出行计划。",
    "audience": [
      "湾区居民与新来者",
      "想安排低预算周末的家庭"
    ],
    "tags": [
      "免费生活",
      "图书馆福利",
      "免费场馆",
      "亲子出游",
      "Kanopy",
      "3D printing",
      "Intel Museum"
    ],
    "readMinutes": 8,
    "sourceNote": "2026-10-04 核对新增条目的官方说明。免费入场、数字资源、借用物品和停车通行证各有适用范围；预约库存与当日开放以官方入口为准。",
    "sources": [],
    "blocks": [
      {
        "type": "freebies",
        "title": "五区日常福利，按条件慢慢挑",
        "text": "这里的免费有明确范围：数字内容可能有限额，借物需要归还，预约项目仍取决于名额。",
        "offers": []
      },
      {
        "type": "heading",
        "text": "先确定自己要省哪一笔"
      },
      {
        "type": "list",
        "items": [
          "想学点东西：先检查自己的图书馆数字资源；不同馆的影片、课程和访问规则不能互相套用。",
          "想带孩子出门：优先选择免费入场、有明确开放规则的场馆。提前确认成人陪同、活动票与停车是否另收费。",
          "想借设备或通行证：先查馆藏和资格，预约成功后再排出行；借用不等于赠送。"
        ]
      },
      {
        "type": "heading",
        "text": "一张图书证，不等于所有项目通用"
      },
      {
        "type": "paragraph",
        "text": "从自己实际持有的发卡馆进入，核对居住地、卡种、年龄和 PIN。数字资源通常需要馆方登录；停车证和门票还可能要求实体卡、本人使用或额外预约。遇到问题先咨询馆员，不要为了试福利重复注册账户。"
      },
      {
        "type": "link",
        "title": "AC Library：网上申请后，按用途选择卡种",
        "text": "2026-10-05 核对：线上申请先获得 eCard，设置 PIN 后可用 eLibrary；Fremont 属 Alameda County，居民 eCard 有效五年。需要免费打印时须转实体 Library Card：可带姓名及当前加州地址证明到分馆办理；无法到馆且住湾区九县，也可申请 Cards-by-Mail，收卡后在线或电话验证。卡号、PIN 和证件只在馆方入口处理，不发到聊天中。",
        "url": "https://aclibrary.org/faq/library-cards-ecards/"
      },
      {
        "type": "link",
        "title": "AC Library：先分清实体卡、eCard 与影音入口",
        "text": "2026-10-04 核对：AC Library 当前官方影音页列出 hoopla 等服务；本次未找到 AC 卡适用的 Kanopy 官方入口，不能套用 SFPL 或 SMCL 的 Kanopy 权益。在加州居住、工作或就学者可申请免费实体卡；Alameda County 居民 eCard 有效期为五年，其他加州居民的临时 eCard 须在 30 天内转实体卡。eCard 不含 Discover & Go，馆票还要求服务区居民及年满 15 岁。",
        "url": "https://aclibrary.org/movies-tv/"
      },
      {
        "type": "link",
        "title": "SFPL：Kanopy 与 Discover & Go 资格分别核对",
        "text": "2026-10-04 核对：SFPL 官方 Movies & TV 页面提供 Kanopy 入口。加州居民可免费申请 SFPL 卡，线上申请后仍需持有效证件到馆完成办理；不能把可申请图书证理解成自动获得全部福利。Discover & Go 馆票要求旧金山居民，住 Fremont 的读者不能仅凭 SFPL 卡推定可领馆票。Kanopy 当前额度需在 SFPL 入口和账户中确认，不能套用 SMCL 的每月 30 tickets。",
        "url": "https://sfpl.org/research-learn/elibrary/bay-beats-movies-tv"
      },
      {
        "type": "link",
        "title": "SMCL：Kanopy 每月额度与馆票是两套条件",
        "text": "2026-10-04 核对：San Mateo County Libraries 的 Kanopy 用有效图书证号码和 PIN 登录，每月 30 tickets，月初重置、不累积，借阅期按影片为 3–7 天。非 San Mateo County 居民需到馆申请图书证，不能假定可在线办卡。Discover & Go 另要求年满 16 岁、服务区居民和有效实体卡，eCard 不适用；最多同时保留两笔预约。上述馆票限制不能直接套到影音或打印。",
        "url": "https://smcl.org/resources-types/evideos/"
      },
      {
        "type": "heading",
        "text": "顺路安排，比把清单跑完更划算"
      },
      {
        "type": "paragraph",
        "text": "编辑建议：一次只选一个主要目的地，加一个附近散步点。公共交通、停车、跨桥和用餐都计入总预算；不把为了领免费项目新增的路程当作零成本。"
      },
      {
        "type": "heading",
        "text": "看最新现场规则，尊重免费资源"
      },
      {
        "type": "paragraph",
        "text": "动物参观要按场馆现行规则，旧图文中的投喂建议可能已停用。图书馆借物按期归还，预约不去就按规定取消，把名额留给下一位。"
      },
      {
        "type": "checklist",
        "items": [
          "用官网核对今天开放，以及是否需要预约。",
          "带好对应图书证、资格证明和预约确认。",
          "记录免费范围、归还时间和额外费用。"
        ]
      },
      {
        "type": "link",
        "title": "再找一份生日小礼",
        "text": "生日饮品、甜点与美妆礼，先核对注册条件。",
        "url": "https://www.baylink.us/guides/bay-area-birthday-perks"
      },
      {
        "type": "link",
        "title": "查看当月优惠与免费日",
        "text": "固定日期的场馆免费日与亲子工作坊，另按当月排期挑选。",
        "url": "https://www.baylink.us/guides/bay-area-freebies-deals-2026-10"
      }
    ]
  }
];

export const perksGuides2026: Guide[] = drafts.map((guide, index) => {
  const offers = index === 0 ? birthdayOffers : everydayOffers;
  return {
    ...guide,
    sources: [...offers.map(offer => ({ title: offer.sourceLabel, url: offer.sourceUrl, description: offer.requirement })),
      ...(index === 1 ? [{"title":"AC Library：图书证与 eCard 条件","url":"https://aclibrary.org/faq/library-cards-ecards/","description":"办卡资格不等于 Discover & Go 资格。"},{"title":"SFPL：申请图书证","url":"https://sfpl.org/welcome-new-cardholders/kiosk-application","description":"加州居民可申请，仍需到馆完成核验。"},{"title":"SMCL：非本县居民到馆申请","url":"https://www2.smcl.org/new-site/get-card.php","description":"网上办卡入口说明本县以外居民应到馆申请。"},{"title":"SMCL：Discover & Go 资格","url":"https://smcl.org/faq/museum-passes-discover-go/","description":"服务区、年龄、实体卡及预约数量条件。"}] : []),
    ],
    blocks: guide.blocks.map(block => block.type === 'freebies' ? { ...block, offers } : block),
  };
});
