import type { Guide } from './guides';
import type { ShoppingPlace } from './shopping-types';
import outlets from './shopping-outlets.json';
import south from './shopping-sf-peninsula-south.json';
import eastNorth from './shopping-east-north.json';

export const SHOPPING_PLACES = [...outlets,...south,...eastNorth] as ShoppingPlace[];
export const shoppingGuides: Guide[] = [{
  "slug": "bay-area-outlets-malls-shopping-guide",
  "title": "湾区购物去哪儿：Outlet、Shopping Mall 与热门购物街区全攻略",
  "subtitle": "按地区、购物目的和交通条件选地方，出门前查好店铺与停车",
  "summary": "从 Livermore、Gilroy、Great Mall 等六处 Outlet，到 Valley Fair、Stanford、Hillsdale 与湾区购物街区，一篇查特色、适合人群、地址、交通停车和半日路线，并学会比较优惠与退货条件。",
  "category": "city",
  "categoryLabel": "购物与周末出行",
  "emoji": "🛍️",
  "audience": [
    "第一次来湾区的游客",
    "采购生活用品的新居民",
    "想换个地方逛街的老居民"
  ],
  "tags": [
    "日常办事",
    "购物攻略",
    "Outlet",
    "Shopping Mall",
    "奥特莱斯",
    "购物中心",
    "购物街区",
    "停车",
    "Livermore",
    "Great Mall",
    "Valley Fair",
    "Stanford"
  ],
  "priority": "P0",
  "featuredOnHome": true,
  "recommendedForCategories": [
    "used",
    "other",
    "ride"
  ],
  "readMinutes": 15,
  "updatedAt": "2026-10-02",
  "sourceNote": "资料核验于 2026-10-02。地点为 BAYLINK 编辑精选，不是客流或最低价排名；预计停留时长、路线组合及取舍为编辑建议。营业时间、租户、库存、优惠、施工和停车政策会变，出发当天请查看本文各地点的官方入口。",
  "sources": [
    {
      "title": "加州消费者指引：Outlet 与参考价",
      "url": "https://oag.ca.gov/consumers/general/outlet-stores",
      "description": "了解 Outlet 专供商品和 Compare At 参考价，避免只按折扣标签判断。"
    },
    {
      "title": "加州消费者指引：退款政策",
      "url": "https://oag.ca.gov/consumers/general/refunds",
      "description": "购物前查店铺退款规则；本文不承诺统一退货期限。"
    },
    {
      "title": "San Francisco Chronicle: San Francisco Centre",
      "url": "https://www.sfchronicle.com/realestate/article/san-francisco-centre-mall-buyers-selected-21943183.php/",
      "description": "2026-03-04 报道确认该商场已关闭；不再沿用旧 Westfield 购物攻略。"
    },
    {
      "title": "Tanforan redevelopment FAQ",
      "url": "https://tanforanforsanbruno.com/faq/",
      "description": "开发项目的常见问题；整体商场关闭日期未公布，须核对具体门店。"
    },
    {
      "title": "FTC：Outlet 购物要核对哪些细节",
      "url": "https://consumer.ftc.gov/consumer-alerts/2019/07/outlet-shopping-deal-details",
      "description": "核对商品是否为 Outlet 专供、比较实际价格并确认不同门店的退货规则。"
    },
    ...SHOPPING_PLACES.map(place => ({title:place.name,url:place.url,description:'商场或街区官方信息；店铺目录及交通入口在对应地点卡片中。'}))
  ],
  "blocks": [
    {
      "type": "paragraph",
      "text": "先想清楚今天要买什么，再选购物地点。Outlet 适合带着品牌和尺码清单比价；大型 Mall 更方便集中试穿与看不同价位；露天中心和购物街区更适合把逛店、吃饭和散步放在一起。下面目录可按地区和类型筛选，不必为了“都去过”跨湾奔波。"
    },
    {
      "type": "tip",
      "title": "先分清两个容易弄错的名字",
      "text": "San Francisco Premium Outlets 在东湾 Livermore，不在旧金山市区。Great Mall 则在 Milpitas，是室内 Outlet 与平价零售混合中心；有 Mall 这个词，不代表它和一般正价购物中心定位相同。"
    },
    {
      "type": "heading",
      "text": "先选你要的购物体验"
    },
    {
      "type": "tip",
      "title": "旧攻略里有些购物目的地已经变了",
      "text": "原 Westfield San Francisco Centre 已于 2026 年关闭，本篇不把它列为可逛商场；它与 Union Square 街区不是同一个目的地。Tanforan 处于重建过渡，旧目录可能保留已关门店；不要把某一家仍营业理解成整个商场适合照旧逛，出发前逐店查官方信息。"
    },
    {
      "type": "list",
      "items": [
        "集中比价、鞋包服饰：先看六处 Outlet 的品牌目录，再选离出发地顺路的一家；不必一天跑两家远郊 Outlet。",
        "多品牌试穿、送礼或百货：比较 Valley Fair、Stanford、Hillsdale、Broadway Plaza 等的具体店铺，而不是只比商场大小。",
        "逛街加吃饭、约朋友：看 Santana Row、City Center Bishop Ranch、Bay Street、Fourth Street 或 Corte Madera 的露天中心。",
        "无车或行程很短：先选住处附近能到达的购物区。旧金山可考虑 Union Square、Japan Center 或 Stonestown；远郊 Outlet 要把换乘与返程一起算。"
      ]
    },
    {
      "type": "heading",
      "text": "湾区购物地点目录"
    },
    {
      "type": "shopping-directory",
      "title": "按地区和购物类型找地点",
      "text": "先看简介和适合人群，展开后查地址、交通停车与编辑建议。地图链接用于查找地点；最终入口和停车位置请对照商场官网。",
      "places": SHOPPING_PLACES
    },
    {
      "type": "heading",
      "text": "游客、新居民和老居民，各自怎么选"
    },
    {
      "type": "list",
      "items": [
        "来玩的人：先核对目标品牌是否有店，再决定是否值得占用半天。返程航班当天尽量不安排远郊采购；把行李空间、商品保修适用地区及退货是否需要再到店一起考虑。",
        "刚搬来的人：先分衣物、家居、电子用品和日用品四张清单。商场目录只能证明有这家店，不能证明所需型号或大件有库存；网上确认自提、配送和尺寸后再去。",
        "住很久的人：先处理退换货、维修或补货，再安排想逛的新店。跨湾前比较同品牌线上价格和附近分店；把吃饭、取货与一次顺路出行合并，可能比多跑一家更省。"
      ]
    },
    {
      "type": "heading",
      "text": "半天怎么安排：六种实用组合"
    },
    {
      "type": "list",
      "items": [
        "南湾试穿＋晚餐：Valley Fair 先办目标采购，再到 Santana Row 逛街吃饭。两边停车分别核对，不能默认跨商场停车也享受原来的优惠。",
        "雨天集中购物：Great Mall，或按住处选 Stonestown、Hillsdale、Stoneridge 等以室内购物为主的中心；具体店铺可能有室外入口，先看平面图。",
        "半岛轻松半日：以 Stanford Shopping Center 为主，若还有余力再选 Town & Country Village；若只是买指定商品，两者选一家即可。",
        "旧金山无车逛街：Union Square 按目标店串起来；喜欢日式杂货、书籍和餐饮就改选 Japan Center。先查当天公交，给用餐排队和回程留余量。",
        "东湾 Outlet 专程：以 Livermore 的 San Francisco Premium Outlets 为当天主要采购点。不要同时硬排旧金山观光或纳帕行程；购物清单完成后就可以返程。",
        "北湾露天购物：The Village 与 Town Center Corte Madera 可作两种风格的选择；若要买 Outlet 品牌，则按原有行程从 Petaluma、Napa、Vacaville 中选顺路的一处。"
      ]
    },
    {
      "type": "heading",
      "text": "省钱不是只看几折"
    },
    {
      "type": "paragraph",
      "text": "FTC 提醒，部分 Outlet 商品是专供款，材质、细节或型号未必与正价店相同；正价门店也未必接收 Outlet 退货。比较同款或相近规格的实际成交价，并先问清退货地点和期限。"
    },
    {
      "type": "list",
      "items": [
        "出发前保存目标款号和品牌官网价格；现场看材质、尺寸、做工与保修，而不是仅看吊牌上的 Compare At 或划线价格。",
        "先看商场与品牌的官方 Offers／Deals 页面；优惠券、会员、App 或学生优惠是否收费、适用哪些店、能否叠加，都要读本次条件。",
        "把含税商品价、停车、油费或车票、过桥及额外行李费用合在一起估算。省下十几元却多跑几个小时，未必符合你的目标。",
        "先确认 Final Sale、退回原支付方式还是店内余额、线上订单能否店内退，以及折扣款或专供款的保修。把收据和商品标签留到确认不退为止。"
      ]
    },
    {
      "type": "heading",
      "text": "出门前与买单前的清单"
    },
    {
      "type": "link",
      "title": "官方消费指引：识别 Outlet 商品与参考价",
      "text": "付款前核对款号、材质、实际价格和退货规则；疑问先向店员确认。",
      "url": "https://oag.ca.gov/consumers/general/outlet-stores"
    },
    {
      "type": "checklist",
      "items": [
        "在当天官网核对目标店铺、店铺自己的营业时间与库存；不要只看整个中心的开门时间。",
        "查普通停车、停车验证、代客泊车和电动车充电各自的费用及限制，保存停车区或车位位置。",
        "带孩子或长辈时，先查洗手间、母婴室、休息区和无障碍入口；需要轮椅或婴儿车时先问服务台。",
        "露天中心准备防晒或外套；步行距离与购物袋重量一起考虑，按需要安排休息。",
        "无车出行同时查最后一段接驳、返程班次与大件携带条件；自驾按停车规则停放，随身带走证件及贵重物品。",
        "付款前再次核对最终价格、退换货条件、收据和提货方式；需要配送时确认日期、费用与谁负责收货。"
      ]
    },
    {
      "type": "template",
      "title": "问店员：库存、优惠与退货",
      "text": "你好，我想买 [品牌／款号／尺码]。请问这家店现在有货吗？是否能保留或线上下单自提？\n这件商品是 Outlet 专供款吗？今天最后含税价格是多少，优惠能否叠加？\n如果不合适，最晚哪天、在哪家店或什么渠道可以退换？是否 Final Sale，退款会回原支付方式吗？"
    },
    {
      "type": "link",
      "title": "继续看：街边停车与停车场",
      "text": "需要在购物街区停车时，先读路牌、扫街时间和停车场收费方式。",
      "url": "/guides/bay-area-street-parking-first-time-guide"
    },
    {
      "type": "link",
      "title": "继续看：农夫市集采购",
      "text": "如果主要想买新鲜食材、逛市集，这篇另有更合适的地点与准备方法。",
      "url": "/guides/bay-area-farmers-market-shopping-guide"
    }
  ]
}];
