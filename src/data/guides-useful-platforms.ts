import type { Guide } from './guides';
import type { UsefulPlatform } from './useful-platform-types';
import transport from './useful-platforms-transport.json';
import food from './useful-platforms-food.json';
import homeDeals from './useful-platforms-home-deals.json';
import local from './useful-platforms-local.json';

export const USEFUL_PLATFORMS = [...transport, ...food, ...homeDeals, ...local] as UsefulPlatform[];

export const usefulPlatformGuides: Guide[] = [{
  "slug": "bay-area-useful-apps-platforms-guide",
  "title": "湾区常用 App 与网站攻略：出行、外卖、找房、省钱和本地生活",
  "subtitle": "按需求挑工具，知道什么时候装 App、什么时候打开网页就够",
  "summary": "整理湾区日常能用到的叫车、公交、停车、华人外卖、买菜、住房、折扣返现、二手互助、活动和公共资源平台。每项附官方入口、适合人群、上手方法、覆盖与限制，并给游客、新居民和长期居民不同的起步组合。",
  "category": "newcomer",
  "categoryLabel": "数字生活与实用工具",
  "emoji": "📱",
  "audience": [
    "第一次来湾区的游客",
    "正在安顿的新居民",
    "想让日常更方便的居民"
  ],
  "tags": [
    "日常办事",
    "App",
    "常用网站",
    "外卖",
    "租房",
    "省钱",
    "Uber",
    "Lyft",
    "Uber Eats",
    "HungryPanda",
    "Fantuan",
    "Zillow",
    "Redfin",
    "Dealmoon",
    "Weee!"
  ],
  "priority": "P0",
  "featuredOnHome": true,
  "recommendedForCategories": [
    "other",
    "ride",
    "rent",
    "used"
  ],
  "readMinutes": 18,
  "updatedAt": "2026-10-02",
  "sourceNote": "平台资料核验于 2026-10-02，按常见生活任务精选，不是下载量或最低价排名。搭配建议为编辑判断；未实际注册、下单或测试每个地址。平台服务区、应用商店地区、价格、会员和资格可能变化，具体以官方入口及本人账号显示为准。本文不含邀请码或返佣链接。",
  "sources": [
    {
      "title": "SFMTA: Phone parking payments",
      "url": "https://www.sfmta.com/getting-around/drive-park/parking-meters/use-your-phone-pay-parking",
      "description": "旧金山停车表当前支持的手机支付入口。"
    },
    {
      "title": "SFMTA: MuniMobile transition",
      "url": "https://www.sfmta.com/getting-around/muni/fares/munimobile",
      "description": "核对 MuniMobile 票种迁移，避免照旧攻略买普通单程票。"
    },
    {
      "title": "SFPL: Mobile resources",
      "url": "https://sfpl.org/services/mobile-resources",
      "description": "通过图书馆使用阅读、学习和数字媒体资源。"
    },
    {
      "title": "UC Berkeley: MyShake",
      "url": "https://myshake.berkeley.edu/",
      "description": "地震预警 App 官方下载入口；预警不是预测。"
    }
  ],
  "blocks": [
    {
      "type": "paragraph",
      "text": "把手机当成日常工具箱：先装你这周真的会用的，再按住址、通勤方式和兴趣补齐。叫车、送餐和会员不必一次开全；长期留在手机里的，应该是确实能帮你完成事情的平台。下面既收录 App，也保留网页入口，方便不想安装的人先查资料。"
    },
    {
      "type": "heading",
      "text": "先按你的情况选一组"
    },
    {
      "type": "list",
      "items": [
        "游客：地图工具 + Uber 或 Lyft + 与路线匹配的交通支付，再选一个餐馆或活动平台；需要机场接送时先读机场官方上车点。",
        "刚搬来：在基础出行之外，加 Zillow／Redfin 等住房搜索、一个能送到家门口的买菜平台、Dealmoon 等优惠资讯，以及自己的图书馆与市政入口。",
        "长期居民：按实际账单判断会员是否值得；用 Meetup 建立兴趣安排、用图书馆数字资源减少重复订阅，再按需要设置山火、空气或地震通知。",
        "中文使用习惯：可先比较 HungryPanda 熊猫外卖、Fantuan 饭团、Weee! 和 Dealmoon；地址、商家、配送方式与账号地区仍需分别确认。"
      ]
    },
    {
      "type": "tip",
      "title": "App、会员和服务范围是三件事",
      "text": "能下载不代表能送到你的住址，也不代表每项功能都免费。标为“App 与网页”的平台可能只在 App 提供某些功能；“以网页为主”是本篇建议的使用方式，不是断言平台没有其他产品。下载请从官方入口进入商店并核对开发者。"
    },
    {
      "type": "heading",
      "text": "按用途查询平台目录"
    },
    {
      "type": "useful-platforms",
      "title": "湾区实用 App 与平台目录",
      "text": "搜索名称或用途，展开卡片看操作和限制。每项官方入口用于访问服务或寻找官方商店链接，不会在本站自动下载或注册。",
      "platforms": USEFUL_PLATFORMS
    },
    {
      "type": "heading",
      "text": "同类平台怎么比较，才不会越用越贵"
    },
    {
      "type": "list",
      "items": [
        "叫车：比较同一时间、同一路线、相同座位需求的最终报价和上车等待；选好车型后再确认，预约价格与即时价格可能不同。",
        "外卖与买菜：用同一篮商品比较含配送、服务费、税和小费的总额；同时看自取、缺货替代、送达时段和会员门槛。",
        "住房：同时看房源更新时间、每月总费用、租期、宠物和停车；用地图核对实际通勤，平台估值与房源广告都需要进一步核实。",
        "省钱：优惠资讯先帮你找到线索，再去商家确认型号、退货、适用账号与截止时间；返现能否叠加、何时确认或付款，要看当次条款。"
      ]
    },
    {
      "type": "heading",
      "text": "十分钟设置清单"
    },
    {
      "type": "checklist",
      "items": [
        "记录近期最常发生的三件事，只安装对应工具；其他官网先存书签。",
        "在买菜、外卖、出行和住房平台填对实际城市、地址或搜索范围。",
        "检查支付币种、服务地区、费用和续费说明；免费试用也记下到期日。",
        "给必要通知和定位权限；核对预警 App 的设置，营销通知按个人偏好调整。",
        "保存订单、报名和预约确认；需要帮助时从订单内或官方帮助中心进入。"
      ]
    },
    {
      "type": "template",
      "title": "我的湾区数字工具清单",
      "text": "这周最需要解决的三件事：\n常用城市／服务地址：\n地图与出行：\n外卖／买菜：\n住房／社区：\n折扣／返现：\n阅读／活动：\n已确认的服务范围和费用：\n会员／试用结束日期：\n遇到问题的官方帮助入口："
    },
    {
      "type": "heading",
      "text": "和本地攻略一起用"
    },
    {
      "type": "link",
      "url": "/guides/bay-area-101-city-exploration-living-guide",
      "title": "101 城景点与居民资源",
      "text": "找本城图书馆、市政与活动入口，再决定该用哪些平台。"
    },
    {
      "type": "link",
      "url": "/guides/bay-area-city-utilities-internet-phone-directory",
      "title": "水电、垃圾、宽带与通讯",
      "text": "账单与改地址请找实际服务商；从官方目录进入账号或 App，避免只凭 PG&E 的知名度判断。"
    },
    {
      "type": "link",
      "url": "/guides/bay-area-outlets-malls-shopping-guide",
      "title": "湾区 Outlet 与购物中心",
      "text": "先选购物目的地，再用优惠与比价工具准备清单。"
    },
    {
      "type": "link",
      "url": "/guides/bay-area-311-211-local-help-guide",
      "title": "311／211：市政与生活帮助",
      "text": "SF311 的处理范围是旧金山；其他城市从自己的市府入口查服务。"
    },
    {
      "type": "link",
      "url": "/calendar",
      "title": "按日期找湾区活动",
      "text": "把站内活动与平台信息对照，最后回到主办方确认。"
    },
    {
      "type": "link",
      "url": "https://sfpl.org/services/mobile-resources",
      "title": "图书馆的数字资源入口",
      "text": "SFPL 的移动资源目录示例；其他图书馆以自己的订阅服务为准。"
    }
  ]
}];
