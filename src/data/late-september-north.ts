import type { MonthlyEvent } from './monthly-types';
import type { SeptemberOpening } from './september-openings';
import type { FreebieOffer } from '../components/FreebieBoard';

// Sources checked 2026-09-27. Offers use the existing FreebieOffer schema.

export const lateSeptemberNorthEvents: MonthlyEvent[] = [
  {
    "id": "napa-water-wise-workshops-oct2026",
    "title": "Napa 节水花园讲座：先养土，再选耐旱植物",
    "startDate": "2026-10-07",
    "endDate": "2026-10-14",
    "occurrenceDates": [
      "2026-10-07",
      "2026-10-14"
    ],
    "dateLabel": "10 月 7 日、14 日 · 各 18:30–20:30",
    "region": "north-bay",
    "city": "Napa",
    "venue": "Senior Center · Manzanita Room · 1500 Jefferson Street",
    "category": "outdoors",
    "cost": "free",
    "costLabel": "免费 · 须提前在线报名",
    "summary": "市水务部门与本地专家开设两场不同主题的晚间课：10/7 讲土壤、堆肥与覆盖除草坪，10/14 看耐旱植物和雨水花园案例，适合秋季动手整理院子前先补课。",
    "plan": [
      "按主题选一场或两场，从市府页面完成报名；中间日期没有这项讲座。",
      "编辑建议带一张自家院子照片和日照、浇水问题，方便整理课后行动清单。",
      "现场会介绍本地补助项目；参加讲座不代表自动符合补助资格，动工前另查规则。"
    ],
    "audience": [
      "想改善院子的居民",
      "园艺初学者"
    ],
    "officialUrl": "https://www.cityofnapa.org/588/Water-Wise-Landscaping-Workshops",
    "sourceLabel": "Napa 市府 · 2026 秋季讲座与报名",
    "verifiedAt": "2026-09-27",
    "imageKey": "garden-walk"
  },
  {
    "id": "napa-beyond-bin-oct10-2026",
    "title": "Beyond the Bin：看看回收物离开家后去了哪里",
    "startDate": "2026-10-10",
    "endDate": "2026-10-10",
    "dateLabel": "10 月 10 日 · 09:00–13:00，导览分时出发",
    "region": "north-bay",
    "city": "American Canyon",
    "venue": "Napa Recycling & Composting Facility · 820 Levitin Way",
    "category": "family",
    "cost": "free",
    "costLabel": "免费报名 · 须选择导览时段",
    "summary": "走进 Napa 的回收与堆肥设施，看分选设备如何处理回收物，了解厨余变成堆肥的过程。主办方还安排亲子导览、垃圾车展示和社区摊位，把日常分类变成可看见的体验。",
    "plan": [
      "先在官方链接选择导览：09:20 起每 20 分钟一班，最后一班 12:20；不要只按全天开放时段到场。",
      "参观须穿包脚、厚底鞋；主办方明确不接受凉鞋、薄底鞋或高跟鞋，大雨可能取消。",
      "想带走现场赠送的堆肥可自带桶；有孩子时选择亲子场，行程以确认邮件为准。"
    ],
    "audience": [
      "亲子家庭",
      "想了解本地回收的居民"
    ],
    "officialUrl": "https://naparecycling.com/beyond-the-bin-napas-recycling-composting-facility-tour-day/",
    "sourceLabel": "Napa Recycling · 9/21 公告与市府报名页",
    "verifiedAt": "2026-09-27",
    "imageKey": "family-workshop"
  },
  {
    "id": "srsymphony-boo-dance-oct25-2026",
    "title": "Boo! Let’s Dance：和 Snoopy 一起听交响乐",
    "startDate": "2026-10-25",
    "endDate": "2026-10-25",
    "dateLabel": "10 月 25 日 · 15:00 开演",
    "region": "north-bay",
    "city": "Rohnert Park",
    "venue": "Weill Hall · Green Music Center · Sonoma State University",
    "category": "family",
    "cost": "paid",
    "costLabel": "单场成人 $20；12 岁及以下 $10，结账总额以售票页为准",
    "summary": "Santa Rosa Symphony 的家庭场把交响乐、芭蕾和 Snoopy 放在同一舞台，曲目穿梭不同文化的舞蹈节奏。主办方鼓励穿万圣节服装，是十月下旬适合全家安排的室内节目。",
    "plan": [
      "从乐团官网选本场单次票，核对成人与儿童人数；不要误选三场套票。",
      "编辑建议先安排早午餐，再留出校园停车和步行入馆时间；需要无障碍座位时先联系票房。",
      "服装以坐着舒适、不遮挡后排为宜；官方注明节目可能调整且门票不可退款，下单前确认行程。"
    ],
    "audience": [
      "亲子家庭",
      "第一次带孩子听交响乐的人"
    ],
    "officialUrl": "https://www.srsymphony.org/event/boo-lets-dance/",
    "sourceLabel": "Santa Rosa Symphony · 官方场次与单票价格",
    "verifiedAt": "2026-09-27",
    "imageKey": "autumn-neighbors"
  }
];

export const lateSeptemberNorthOpenings: SeptemberOpening[] = [
  {
    "id": "panama-hotel-restaurant-reopened-sep2026",
    "name": "Panama Hotel Restaurant",
    "city": "San Rafael",
    "region": "north-bay",
    "category": "重新开业 · 加州海岸风味",
    "status": "open",
    "openingType": "reopening",
    "openedOn": "2026-09-01",
    "dateLabel": "9 月 1 日正式重开 · 官网 9/2 确认",
    "summary": "Gerstle Park 街区的历史旅馆餐厅恢复营业，由曾在这里工作的 Hiram Diaz 以合伙人和主厨身份带领厨房。餐单延续部分经典菜，也加入加州海岸与跨文化风味，花园露台仍是看点。",
    "editorTip": "官网现列周二至周六供应晚餐，周日、周一休息；先确认订位、当日菜单和露台座位，再安排 San Rafael 晚间聚餐。本文为重开资讯，非亲测食评。",
    "address": "4 Bayview Street, San Rafael, CA 94901",
    "officialUrl": "https://panamahotel.com/a-new-chapter-begins-at-the-historic-panama-hotel-restaurant/",
    "sourceUrl": "https://panamahotel.com/a-new-chapter-begins-at-the-historic-panama-hotel-restaurant/",
    "sourceLabel": "Panama Hotel · 9 月 2 日官方重开公告",
    "verifiedAt": "2026-09-27",
    "imageKey": "neighborhood-table"
  },
  {
    "id": "aliotos-focacceria-san-rafael",
    "name": "Alioto’s Focacceria · San Rafael",
    "city": "San Rafael",
    "region": "north-bay",
    "category": "新概念店 · 意式三明治与熟食",
    "status": "open",
    "openingType": "new-restaurant",
    "dateLabel": "9 月商业区公告介绍 · 现已营业，首日未核实",
    "summary": "主厨 Alexander Alioto 把原 The Kitchen Table 改成轻松的意式熟食店，主打佛卡夏三明治、pinsa 披萨，也提供鲜意面、酱料与面包外带。适合在 Fourth Street 办事或逛街时安排午餐。",
    "editorTip": "品牌官网分别列出 San Rafael 与 Reno 门店，点单时认准 San Rafael；现列每日 10:00–17:00，临行复查。9/1 是商业区文章日期，不当作开业首日。",
    "address": "1574 4th Street, San Rafael, CA 94901",
    "officialUrl": "https://www.aliotosfocacceria.com/",
    "sourceUrl": "https://downtownsanrafael.org/alioto-new/",
    "sourceLabel": "Downtown San Rafael · 9/1 介绍；品牌官网核对营业",
    "verifiedAt": "2026-09-27",
    "imageKey": "neighborhood-table"
  }
];

export const lateSeptemberNorthOffers: FreebieOffer[] = [
  {
    "id": "marin-transit-clean-air-oct7-2026",
    "region": "north-bay",
    "verifiedAt": "2026-09-27",
    "brand": "MARIN TRANSIT",
    "title": "10/7 Marin Transit 本地公交免票",
    "dateLabel": "10 月 7 日 · Clean Air Day 当天",
    "startDate": "2026-10-07",
    "endDate": "2026-10-07",
    "availability": "dated",
    "kind": "no-purchase",
    "requirement": "当天 Marin Transit 本地公交对所有乘客免票，无需购物；其他运营方、渡轮或接驳服务的票价须分别核对。",
    "description": "适合把平日办事或短途出行改成公交。先查自己的线路、去回程班次和站点；官方免票公告不代表延长服务时间，也不自动涵盖整段跨湾行程。",
    "imageKey": "community-accessible-transit",
    "imageNote": "交通主题插图，非 Marin Transit 车辆或站点实景",
    "sourceUrl": "https://marintransit.gov/fare-free-promotions",
    "sourceLabel": "Marin Transit · 2026/27 官方免票日",
    "storeUrl": "https://marintransit.gov/"
  },
  {
    "id": "napa-costume-exchange-oct3-2026",
    "region": "north-bay",
    "verifiedAt": "2026-09-27",
    "brand": "CITY OF NAPA",
    "title": "10/3 Napa 免费换装：不捐旧服装也能参加",
    "dateLabel": "10 月 3 日 · 10:00–14:00 消防开放日内",
    "startDate": "2026-10-03",
    "endDate": "2026-10-03",
    "availability": "dated",
    "kind": "no-purchase",
    "requirement": "市府明确本场万圣节服装交换免费，不要求先捐赠才能参加；可带状态良好的旧服装，款式与尺码按现场实际供应选择。",
    "description": "地点在 Fire Station #1，930 Seminary Street, Napa，可顺道看消防站开放日。编辑建议先量好孩子尺寸，准备备选造型；免费交换不保证有特定角色服装。",
    "imageKey": "autumn-neighbors",
    "imageNote": "秋日社区插图，非现场服装或库存",
    "sourceUrl": "https://www.cityofnapa.org/CivicSend/ViewMessage/message/301296",
    "sourceLabel": "Napa 市府 · 9/25 公告与免费交换条件",
    "storeUrl": "https://naparecycling.com/halloween/"
  }
];
