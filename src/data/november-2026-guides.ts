import type { Guide } from './guides';
import { currentFreebies } from './october-offers';

export const november2026Guides: Guide[] = [
  {
    "slug": "bay-area-freebies-deals-2026-11",
    "title": "秋季湾区优惠：十月到十一月底，哪些值得领",
    "subtitle": "2026/10/7 增补 · 收录至 11/30，资格和花费写清楚",
    "summary": "集中查看已公布的品牌门店活动、场馆免费日、生日会员礼和长期资源。按免费领取、预约或需消费筛选，十一月新活动与十月仍有效的优惠一起查。",
    "category": "events",
    "categoryLabel": "生活活动",
    "emoji": "🎁",
    "audience": [
      "想省钱的湾区居民",
      "亲子家庭"
    ],
    "tags": [
      "优惠",
      "十一月",
      "Target",
      "Lowe’s",
      "freebies",
      "生日福利",
      "免费场馆"
    ],
    "priority": "P0",
    "featuredOnHome": true,
    "recommendedForCategories": [
      "other"
    ],
    "readMinutes": 7,
    "updatedAt": "2026-10-07",
    "editionMonth": "2026-11",
    "editionStartDate": "2026-10-05",
    "editionThroughDate": "2026-11-30",
    "sourceNote": "本轮于 2026/10/7 增补到十一月底的已公布安排，包括感恩节植物园免费入场、Green Friday 与 11/20 会员折扣。各卡片保留自己的核查日期，并非全部旧优惠重新认证；有数量上限、会员或居民资格的项目按具体条款领取。",
    "sources": currentFreebies.map(offer => ({ title: offer.sourceLabel, url: offer.sourceUrl, description: offer.requirement })),
    "blocks": [
      { "type": "heading", "text": "先看资格，再安排领取" },
      {
        "type": "paragraph",
        "text": "先选你真正会用的东西，再核对日期和资格。Target 的十月活动不能当成十一月黑五预告；Lowe’s 十一月手作已有安排，但门店名额仍要预约确认。"
      },
      {
        "type": "freebies",
        "title": "按日期、地区与领取条件筛选",
        "text": "已结束项目默认隐藏；「需消费」是折扣，「需预约」要先拿到名额。长期福利仍以账户、库存和门店规则为准。",
        "offers": currentFreebies.filter(offer => (!offer.startDate || offer.startDate <= '2026-11-30') && (!offer.endDate || offer.endDate >= '2026-10-05'))
      },
      {
        "type": "link",
        "title": "只想看十一月怎么安排",
        "text": "用免费日和附近活动排一个简单半日，不要跨区域连赶多个免费场馆。",
        "url": "/guides/bay-area-november-first-half-planner-2026"
      },
      {
        "type": "tip",
        "title": "尚未公布，就先留空",
        "text": "感恩节与黑五不是所有商家都打折。只收录已核对年份、地区与资格的安排，未公布的促销不套用往年数字；日后以商家新公告为准。"
      }
    ]
  },
  {
    "priority": "P0",
    "featuredOnHome": true,
    "recommendedForCategories": [
      "other",
      "ride"
    ],
    "updatedAt": "2026-10-05",
    "editionMonth": "2026-11",
    "editionThroughDate": "2026-11-15",
    "slug": "bay-area-november-first-half-planner-2026",
    "title": "十一月上半月怎么玩：先定区域，再挑活动与免费日",
    "subtitle": "收录至 2026/11/15 · 日期、资格、预约分别看",
    "summary": "把看展、手作、自然活动和日常采购排得简单一点：同一区域选一个主要目的地，再加附近一站；免费入场、需要购物与限资格优惠分开核对。",
    "category": "events",
    "categoryLabel": "生活活动",
    "emoji": "🍂",
    "audience": [
      "想提前安排十一月周末的人",
      "带孩子或长辈轻松出门的人"
    ],
    "tags": [
      "十一月",
      "免费日",
      "亲子",
      "周末计划",
      "2026"
    ],
    "readMinutes": 6,
    "sourceNote": "2026/10/5 核查。下方每张优惠卡列自己的官方来源；按每月规则换算的日期会明确注明，预约名额与活动变更仍以主办方为准。",
    "sources": [
      {
        "title": "NIST：2026 调时日期",
        "url": "https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst",
        "description": "11/1 凌晨 2 点拨回 1 点，出行按当地时间。"
      },
      {
        "title": "Lowe’s：儿童工作坊",
        "url": "https://www.lowes.com/diy-projects-and-ideas/workshops",
        "description": "11/14 Holiday Engine 的报名及门店安排。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "先在活动页选「十一月」和你所在的区域。预算有限就再选免费，但免费入场并不包含餐饮、停车或园内收费项目。"
      },
      { "type": "heading", "text": "按日期挑一个主要目的地" },
      {
        "type": "link",
        "title": "按日期和地区找十一月活动",
        "text": "直接打开十一月筛选，再按文化、户外、美食或亲子缩小范围。",
        "url": "/this-month?when=november#monthly-events"
      },
      {
        "type": "list",
        "items": [
          "11/1：想看展可比较 OMCA 与亚洲艺术博物馆的免费范围，选其中一个，别为赶两个免费场馆来回跨湾。",
          "11/3–10：温室、BAMPFA、SJMA、电脑历史馆与植物园各有不同日期和资格，按下面的卡片选择。",
          "11/11：Muir Woods 的免入口费不免停车预约费；Chili’s 免费主餐限现役军人及退伍军人。",
          "11/14：Lowe’s Holiday Engine 先选门店和名额；如果不想参加手作，可改选 MoAD 免费入館。",
          "11/15：在活动列表查当天确认的自然或社区活动。户外项目如有天气取消，优先选同一区域室内替代。"
        ]
      },
      {
        "type": "tip",
        "title": "计划留出余地",
        "text": "先决定出发城市、交通方式、人数与最晚回家时间。把官方活动时段和你自己的出行估时分开；缺少可靠营业时间时，先查场馆，不编一个到场就能参加的行程。"
      },
      {
        "type": "link",
        "title": "逐城找景点与居民资源",
        "text": "九县 101 城目录标明市内、附近与跨市边界，适合给主活动加一个轻量的附近停留。",
        "url": "/guides/bay-area-101-city-exploration-living-guide"
      },
      {
        "type": "freebies",
        "title": "十一月已核实的免费日与条件优惠",
        "text": "先看资格和截止日期；具体名额或剩余订单数不保证。",
        "offers": [
          {
            "id": "bampfa-free-nov5-2026",
            "brand": "BAMPFA · BERKELEY",
            "region": "east-bay",
            "verifiedAt": "2026-10-05",
            "startDate": "2026-11-05",
            "endDate": "2026-11-05",
            "availability": "dated",
            "title": "11/5 BAMPFA 展厅免费日",
            "dateLabel": "11/5 周四 · 展厅开放时段",
            "requirement": "所有访客免费参观展厅；电影放映需另行购票。",
            "description": "官网十一月日历已列出 11/5 免费首个周四。可先看展，再去 Berkeley 市中心散步；当天开馆时间以馆方页面为准。",
            "imageKey": "culture-visit",
            "sourceUrl": "https://bampfa.org/visit/calendar/2026-11",
            "sourceLabel": "BAMPFA 2026 年十一月日历",
            "kind": "no-purchase"
          },
          {
            "id": "omca-free-nov1-2026",
            "brand": "OMCA · OAKLAND",
            "region": "east-bay",
            "verifiedAt": "2026-10-05",
            "startDate": "2026-11-01",
            "endDate": "2026-11-01",
            "availability": "dated",
            "title": "11/1 OMCA 普通展与特展免费",
            "dateLabel": "11/1 周日 · 按首个周日规则换算",
            "requirement": "所有访客免费，现行规则包含特别展览。建议预订；现场票先到先得。",
            "description": "十一月首个周日是 11/1，这是按馆方每月规则换算的日期。餐饮、购物和停车另计；不用购买会员。",
            "imageKey": "region-omca",
            "sourceUrl": "https://museumca.org/first-sundays/",
            "sourceLabel": "OMCA 免费首个周日与预约",
            "kind": "no-purchase"
          },
          {
            "id": "asian-art-free-nov1-2026",
            "brand": "ASIAN ART MUSEUM · SF",
            "region": "sf",
            "verifiedAt": "2026-10-05",
            "startDate": "2026-11-01",
            "endDate": "2026-11-01",
            "availability": "dated",
            "title": "11/1 亚洲艺术博物馆普通入场免费",
            "dateLabel": "11/1 周日 · 10:00–17:00",
            "requirement": "首个周日普通入场免费；特展另付 $10，建议提前选时段。",
            "description": "按现行每月规则，十一月对应 11/1。地点是旧金山 Civic Center 的 200 Larkin Street，免费普通票不等于所有展览都免费。",
            "imageKey": "culture-visit",
            "sourceUrl": "https://about.asianart.org/ticketing/",
            "sourceLabel": "亚洲艺术博物馆票务规则",
            "kind": "no-purchase"
          },
          {
            "id": "conservatory-free-nov3-2026",
            "brand": "CONSERVATORY OF FLOWERS · SF",
            "region": "sf",
            "verifiedAt": "2026-10-05",
            "startDate": "2026-11-03",
            "endDate": "2026-11-03",
            "availability": "dated",
            "title": "11/3 金门公园温室免费开放",
            "dateLabel": "11/3 周二 · 10:00–16:30，16:00 最后入场",
            "requirement": "普通入场对所有人免费，不限旧金山居民；特别活动另查票务。",
            "description": "官网已公布 2026/11/3 免费日。温室与植物园是不同园区，别把 11/10 植物园免费日混成同一天。",
            "imageKey": "ggp-conservatory",
            "sourceUrl": "https://gggp.org/event/free-day-conservatory-of-flowers-13/",
            "sourceLabel": "温室 11/3 官方免费日",
            "kind": "no-purchase"
          },
          {
            "id": "sjma-free-nov6-2026",
            "brand": "SAN JOSÉ MUSEUM OF ART",
            "region": "south-bay",
            "verifiedAt": "2026-10-05",
            "startDate": "2026-11-06",
            "endDate": "2026-11-06",
            "availability": "dated",
            "title": "11/6 San José 美术馆免费夜场",
            "dateLabel": "11/6 周五 · 18:00–21:00",
            "requirement": "当晚入馆免费，可提前登记加快入场；餐饮与购物另付。",
            "description": "馆方已发布十一月 First Fridays 页面。适合下班后在市中心看展，当晚娱乐安排以活动页更新为准。",
            "imageKey": "culture-visit",
            "sourceUrl": "https://sjmusart.org/event/first-fridays-november-2026",
            "sourceLabel": "SJMA 十一月首个周五",
            "kind": "no-purchase"
          },
          {
            "id": "chm-museums-on-us-nov7-8-2026",
            "brand": "COMPUTER HISTORY MUSEUM",
            "region": "south-bay",
            "verifiedAt": "2026-10-05",
            "startDate": "2026-11-07",
            "endDate": "2026-11-08",
            "availability": "dated",
            "title": "11/7–8 已有指定银行卡，可免费入 CHM",
            "dateLabel": "11/7–8 · 按每月首个完整周末规则换算",
            "requirement": "有效 Bank of America 或 Merrill 银行卡及本人照片证件，仅限持卡人一张普通票；同伴、特展和售票活动不包含。",
            "description": "Mountain View 的电脑历史博物馆现行规则适用于每月首个完整周末，十一月为 11/7–8。已有卡再使用这项福利，不必为参观新开卡。",
            "imageKey": "expanded-south-bay-computer-history",
            "sourceUrl": "https://computerhistory.org/plan-your-visit/discounts/",
            "sourceLabel": "CHM 免费与折扣入场条款",
            "kind": "no-purchase"
          },
          {
            "id": "botanical-free-nov10-2026",
            "brand": "SAN FRANCISCO BOTANICAL GARDEN",
            "region": "sf",
            "verifiedAt": "2026-10-05",
            "startDate": "2026-11-10",
            "endDate": "2026-11-10",
            "availability": "dated",
            "title": "11/10 旧金山植物园普通入场免费",
            "dateLabel": "11/10 周二 · 07:30–17:00，16:00 最后入场",
            "requirement": "当天普通入场对所有人免费；收费课程和特别活动不包含。",
            "description": "官网已公布 11/10。十一月最后入园时间比十月早，建议下午 16:00 前到入口；不要照搬十月的 17:00 最后入场时间。",
            "imageKey": "garden-walk",
            "sourceUrl": "https://gggp.org/event/free-day-san-francisco-botanical-garden-17/",
            "sourceLabel": "植物园 11/10 官方免费日",
            "kind": "no-purchase"
          },
          {
            "id": "moad-free-nov14-2026",
            "brand": "MUSEUM OF THE AFRICAN DIASPORA · SF",
            "region": "sf",
            "verifiedAt": "2026-10-05",
            "startDate": "2026-11-14",
            "endDate": "2026-11-14",
            "availability": "dated",
            "title": "11/14 MoAD 第二个周六免费入馆",
            "dateLabel": "11/14 周六 · 11:00–17:00，按每月规则换算",
            "requirement": "每月第二个周六 THRIVE @ MoAD 普通入馆免费；具体节目和预约要求另查当天公告。",
            "description": "十一月第二个周六为 11/14。这里确认的是现行免费入场规则，不代表尚未公布的讲座或演出已安排。",
            "imageKey": "culture-visit",
            "sourceUrl": "https://www.moadsf.org/visit",
            "sourceLabel": "MoAD 参观与 THRIVE 免费规则",
            "kind": "no-purchase"
          },
          {
            "id": "muir-woods-veterans-day-nov11-2026",
            "brand": "MUIR WOODS · NATIONAL PARK SERVICE",
            "region": "north-bay",
            "verifiedAt": "2026-10-05",
            "startDate": "2026-11-11",
            "endDate": "2026-11-11",
            "availability": "dated",
            "title": "11/11 Muir Woods 指定资格免入口费",
            "dateLabel": "11/11 周三 · 以公园当日开放时间为准",
            "requirement": "2026 免入口费日仅适用于美国公民及居民；停车或接驳车仍需预约并付费，不能直接无预约开车到场。",
            "description": "NPS 的 Muir Woods 官方 2026 列表明确包含 Veterans Day 11/11。先查资格、停车或接驳名额，再安排红杉林散步。",
            "imageKey": "region-muir-boardwalk",
            "sourceUrl": "https://www.nps.gov/muwo/planyourvisit/fees.htm",
            "sourceLabel": "Muir Woods 2026 免入口费日与限制",
            "kind": "reservation"
          },
          {
            "id": "chilis-veterans-day-nov11-2026",
            "brand": "CHILI’S",
            "verifiedAt": "2026-10-05",
            "startDate": "2026-11-11",
            "endDate": "2026-11-11",
            "availability": "dated",
            "title": "11/11 Chili’s 向军人与退伍军人送指定主餐",
            "dateLabel": "11/11 周三 · 参与门店堂食",
            "requirement": "仅现役军人与退伍军人适用；限指定菜单、参与门店堂食，不含饮料和小费，不可替换菜品或叠加优惠。",
            "description": "官方页面明确标注 2026/11/11。出门前向湾区门店确认参与情况与认可的资格凭证；同行家人的餐费不自动免费。",
            "imageKey": "neighborhood-table",
            "sourceUrl": "https://www.chilis.com/restaurant-events/veterans-day",
            "sourceLabel": "Chili’s 2026 Veterans Day 条款",
            "kind": "no-purchase"
          }
        ]
      },
      {
        "type": "link",
        "title": "Target、Lowe’s 与日常零售福利",
        "text": "已收录的十月与十一月安排在这里继续查看；尚未公布的黑五价格不会推测成现行优惠。",
        "url": "/guides/bay-area-retail-freebies-family-deals"
      }
    ]
  },
  {
    "priority": "P0",
    "featuredOnHome": true,
    "recommendedForCategories": [
      "other",
      "ride"
    ],
    "updatedAt": "2026-10-05",
    "editionMonth": "2026-11",
    "editionThroughDate": "2026-11-15",
    "slug": "bay-area-november-resident-dates-2026",
    "category": "newcomer",
    "categoryLabel": "新手",
    "emoji": "📅",
    "readMinutes": 4,
    "title": "十一月居民日历：调时、投票与假日通勤",
    "subtitle": "2026/11/1–15 · 先处理时间与办事，再排周末",
    "summary": "11/1 调时、11/3 加州大选、11/11 Caltrain 假日安排，以及 BART 黄线已公布的十一月夜间施工。用官方入口查自己的办理地点和当天交通。",
    "audience": [
      "湾区居民",
      "刚搬家需要更新办事资料的人"
    ],
    "tags": [
      "十一月",
      "调时",
      "居民资讯",
      "Caltrain",
      "BART",
      "投票"
    ],
    "sourceNote": "2026/10/5 核查；选举信息仅列办理日期和官方入口，不涉及候选人或投票选择。交通内容是已公布计划，不是实时运行状态。",
    "sources": [
      {
        "title": "NIST：夏令时规则",
        "url": "https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst",
        "description": "2026 年夏令时于 11/1 凌晨结束。"
      },
      {
        "title": "加州州务卿：选举日期与资源",
        "url": "https://www.sos.ca.gov/elections/voting-resources/voting-california/election-dates-and-resources",
        "description": "核对登记、收票及投票日时间。"
      },
      {
        "title": "加州州务卿：当日有条件登记",
        "url": "https://www.sos.ca.gov/elections/voter-registration/same-day-reg",
        "description": "错过常规登记日期后，查合资格选民的办理方式。"
      },
      {
        "title": "加州各县选举办公室",
        "url": "https://www.sos.ca.gov/elections/voting-resources/county-elections-offices",
        "description": "按所在县查询官方办公室和语言服务。"
      },
      {
        "title": "Caltrain：2026 假日服务",
        "url": "https://www.caltrain.com/schedules/holiday-service-schedules",
        "description": "11/11 按工作日时刻表运行，仍需查临时警报。"
      },
      {
        "title": "BART：黄线夜间钢轨维护",
        "url": "https://www.bart.gov/news/articles/2025/news20250326-1",
        "description": "持续更新的公告列出 11/12–14 施工日期。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "11/1 周日凌晨 2:00，时钟拨回 1:00。手机通常自动调整；手表、车内时钟和手动设置的设备需要检查。跨时区约人时写清「湾区当地时间」。"
      },
      { "type": "heading", "text": "重要日期和官方办理入口" },
      {
        "type": "list",
        "items": [
          "加州 2026 大选为 11/3，投票点开放时间为 07:00–20:00；普通网上或邮戳登记截止为 10/19。",
          "错过常规登记日期的合资格公民，可通过县选举办公室、投票点或投票中心办理有条件登记与投票；需完成资格核验后计票。",
          "亲自交回选票须在 11/3 晚 8 点前；邮寄选票须在 11/3 或之前盖邮戳，并在 11/10 前送达县选举办公室。"
        ]
      },
      {
        "type": "link",
        "title": "找到自己县的办理入口",
        "text": "搬家、登记状态、语言帮助和办理地点，以你所在县及州务卿说明为准。",
        "url": "https://www.sos.ca.gov/elections/voting-resources/county-elections-offices"
      },
      {
        "type": "paragraph",
        "text": "11/11 Veterans Day，Caltrain 的 2026 假日表列工作日服务。不要因为是假日就自动按周日班次出门；出发前仍查实时警报和对应车站时刻。"
      },
      {
        "type": "link",
        "title": "查看 Caltrain 假日表",
        "text": "确认日期后，再从官网进入具体车站时刻与警报。",
        "url": "https://www.caltrain.com/schedules/holiday-service-schedules"
      },
      {
        "type": "paragraph",
        "text": "BART 黄线夜间钢轨维护公告列出 11/12–14，计划从午夜持续到次晨开行前，预计延误 20–30 分钟。公告持续更新，下一段具体施工区间与末班连接需临行再查。"
      },
      {
        "type": "link",
        "title": "查看黄线施工最新公告",
        "text": "本文核对的是公布的施工计划，不能替代实时到站信息。",
        "url": "https://www.bart.gov/news/articles/2025/news20250326-1"
      }
    ]
  }
];
