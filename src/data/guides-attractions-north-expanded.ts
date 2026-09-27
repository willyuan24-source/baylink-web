import type { Guide } from './guides';
import type { Attraction } from './attractions';

// Official sources checked 2026-09-26. Route timing is editorial guidance.
export const northExpandedGuides: Guide[] = [
  {
    "category": "city",
    "categoryLabel": "城市指南",
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "other",
      "ride"
    ],
    "readMinutes": 6,
    "updatedAt": "2026-09-26",
    "sourceNote": "官方资料核验于 2026 年 9 月 26 日。路线与停留时间为 BAYLINK 编辑建议；开放、船班和临时限制请在出发前再查。资料照片不代表当天景观。",
    "slug": "point-reyes-bear-valley-first-visit-guide",
    "cover": "/guides/attractions/expanded-point-reyes.webp",
    "title": "Point Reyes 初访：从 Bear Valley 读懂树林、草甸与地震",
    "subtitle": "游客中心、Earthquake Trail 与可折返的林间散步，组成轻松半日",
    "summary": "把目的地设在 Bear Valley，讲清短线选择、铺装路面的实际限制和 Divide Meadow 延伸方案；灯塔留给另一趟。",
    "emoji": "🌿",
    "audience": [
      "北湾自然初访者",
      "带孩子或长辈的家庭"
    ],
    "tags": [
      "北湾",
      "Point Reyes",
      "Bear Valley",
      "自然散步",
      "地质与森林"
    ],
    "sources": [
      {
        "title": "NPS：Point Reyes 行程建议",
        "url": "https://www.nps.gov/pore/planyourvisit/tripideas.htm",
        "description": "核对 Earthquake Trail、Bear Valley 与 Divide Meadow 的位置和路线长度。"
      },
      {
        "title": "NPS：无障碍设施与路面",
        "url": "https://www.nps.gov/pore/planyourvisit/accessibility.htm",
        "description": "Earthquake Trail 部分路面下陷；往草甸的土路有坡度及石块，不能承诺全线无障碍。"
      },
      {
        "title": "NPS：门票与日间使用费用",
        "url": "https://www.nps.gov/pore/planyourvisit/fees.htm",
        "description": "核对普通日间参观、步行与停车是否收费；露营和特许活动另有规则。"
      },
      {
        "title": "NPS：道路、步道与临时限制",
        "url": "https://www.nps.gov/pore/planyourvisit/conditions.htm",
        "description": "出门前查看道路与步道公告，并按链接继续核对具体步道。"
      },
      {
        "title": "NPS：天气与海岸气候",
        "url": "https://www.nps.gov/pore/planyourvisit/weather.htm",
        "description": "了解沿海雾、风和内陆山谷之间的天气差异。"
      },
      {
        "title": "NPS：游客中心开放资料",
        "url": "https://www.nps.gov/pore/planyourvisit/visitorcenters.htm",
        "description": "确认 Bear Valley 当天室内开放；步道安排不依赖室内一定开门。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "Point Reyes 的尺度比一张灯塔照片大得多。第一次来，可以把半天交给 Bear Valley：先在游客中心认识半岛，再走一段讲地震的短路，最后沿树林找到自己的折返点。三段都靠近同一个出发区，不用不停换停车场；孩子能从看展转向观察树叶，成年人也有时间坐下来。"
      },
      {
        "type": "heading",
        "text": "先选短线，把车程留在预算里"
      },
      {
        "type": "list",
        "items": [
          "编辑建议：普通短线留 2–3 小时，不含湾区往返车程；若走到 Divide Meadow，把园内时间放宽到 3–4 小时，并按最慢同行者调整。",
          "NPS 当前说明普通日间入园、步行和游客中心及步道口停车免费；餐饮、往返交通、露营和特殊活动不在这个范围内。",
          "导航直接设 Bear Valley Visitor Center，先保存离线地图和返程路线；地图上的 Point Reyes 大范围地名不一定带你到这次的起点。",
          "带水、简便午餐、能防风的外层和好走的鞋。树林与海岸天气可能不同，不凭出发地的气温判断穿着。"
        ]
      },
      {
        "type": "heading",
        "text": "以 Bear Valley 为中心，走三段不同的风景"
      },
      {
        "type": "route",
        "title": "游客中心 → 地震短环线 → 林间折返",
        "text": "以下停留时间为编辑建议，地图用于定位。只沿当天开放、现场允许的路径行走，体力不足可在任何一段结束。",
        "stops": [
          {
            "title": "第一站 · Bear Valley Visitor Center",
            "text": "建议留 25–40 分钟，看生态与历史展陈，并向工作人员确认当天路况。先用洗手间、记录停车位置；若室内未开，就读外部导览并从短线开始，不临时追赶别处的开门时间。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Bear%20Valley%20Visitor%20Center%20Point%20Reyes"
          },
          {
            "title": "第二站 · Earthquake Trail",
            "text": "从游客中心停车区走向野餐区旁的步道口。官方列环线约 0.6 英里；可用 30–45 分钟看解释圣安德烈亚斯断层的标牌，让孩子找出围栏示意的错位。慢看比快速绕完一圈更有意思。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Earthquake%20Trail%20Point%20Reyes%20National%20Seashore"
          },
          {
            "title": "第三站 · Bear Valley Trail 林荫段",
            "text": "回到 Bear Valley Trailhead，再沿宽阔土路进入树林，事先约定 20–30 分钟便折返的轻量版本。若全组想多走，Divide Meadow 往返约 3.2 英里，是独立的延伸选择；到草甸休息后原路回停车区，不把继续走到海岸当默认任务。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Bear%20Valley%20Trailhead%20Point%20Reyes%20National%20Seashore"
          }
        ]
      },
      {
        "type": "heading",
        "text": "按路面、孩子体力与天色收尾"
      },
      {
        "type": "paragraph",
        "text": "Earthquake Trail 虽然铺了沥青，NPS 明确提醒部分路面下陷或倾斜，目前并非完全符合无障碍标准，部分轮椅使用者需要协助。往 Divide Meadow 的路为压实土路，仍有超过 5% 的坡段和石块，草甸厕所也不是无障碍设施。小轮推车、手动轮椅或怕不平路的同行者，先向游客中心问清当天状态；把室内展陈与附近可通行区域作为完整的短版行程。"
      },
      {
        "type": "tip",
        "title": "给当天留一个明确的终点",
        "text": "孩子开始累、雨后路滑或雾让驾驶变慢时，就回 Bear Valley。建议在仍有充足日光时结束步行，并在发车前吃点东西、检查离线导航；灯塔与远端海滩需要另一段道路和时间，留给下次更从容。"
      },
      {
        "type": "checklist",
        "items": [
          "查 NPS 当前道路和步道限制，确认游客中心是否开放。",
          "在短线与 Divide Meadow 延伸之间选好一个版本，约定折返点。",
          "同行者使用轮椅或推车时，先确认路面与厕所条件。",
          "下载地图，带水、食物、外套，并预留白天返程余量。"
        ]
      },
      {
        "type": "link",
        "title": "出发前查看 Point Reyes 当前状况",
        "text": "从官方公告进入步道、道路和游客中心信息，按实际出游日核对。",
        "url": "https://www.nps.gov/pore/planyourvisit/conditions.htm"
      },
      {
        "type": "cta",
        "title": "为下一次北湾出游留点空间",
        "text": "这次走完 Bear Valley，下次再比较红杉森林、海滨和渡轮路线，选择适合全组体力的一天。",
        "primaryLabel": "继续看湾区出游攻略",
        "primaryAction": "guides"
      }
    ]
  },
  {
    "category": "city",
    "categoryLabel": "城市指南",
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "other",
      "ride"
    ],
    "readMinutes": 6,
    "updatedAt": "2026-09-26",
    "sourceNote": "官方资料核验于 2026 年 9 月 26 日。路线与停留时间为 BAYLINK 编辑建议；开放、船班和临时限制请在出发前再查。资料照片不代表当天景观。",
    "slug": "angel-island-ferry-first-day-guide",
    "cover": "/guides/attractions/expanded-angel-island.webp",
    "title": "Angel Island 一日：先定回程船，再走海湾与移民历史",
    "subtitle": "从 Ayala Cove 走到移民站，把历史参观与岛上步行安排在同一条往返线上",
    "summary": "比较旧金山与 Tiburon 登船入口，区分船票、入园与馆内参观，说明台阶、陡坡、补给和错过末班船的预防。",
    "emoji": "⛴️",
    "audience": [
      "想坐渡轮的一日游访客",
      "对湾区移民历史感兴趣的人"
    ],
    "tags": [
      "北湾",
      "Angel Island",
      "渡轮出游",
      "移民历史",
      "海湾徒步"
    ],
    "sources": [
      {
        "title": "California State Parks：Angel Island 公园公告",
        "url": "https://www.parks.ca.gov/?page_id=468",
        "description": "查看当日限制、园区信息和博物馆开放安排。"
      },
      {
        "title": "California State Parks：上岛与步行路线",
        "url": "https://www.parks.ca.gov/?page_id=1313",
        "description": "核对 Ayala Cove、移民站距离、台阶、补给与其他路线。"
      },
      {
        "title": "California State Parks：移民站参观与行动协助",
        "url": "https://www.parks.ca.gov/?page_id=25767",
        "description": "确认免台阶路线仍有陡坡，提前询问接驳及车辆转移限制。"
      },
      {
        "title": "Golden Gate Ferry：Angel Island 船票与登船说明",
        "url": "https://www.goldengate.org/ferry/angel-island-ferry/",
        "description": "查看往返购票、入园费包含范围及提前到码头的要求。"
      },
      {
        "title": "Golden Gate Ferry：旧金山航线时刻表",
        "url": "https://www.goldengate.org/ferry/route-schedule/angel-island-sf/",
        "description": "按出行日期查看方向、班次和服务提醒，勿沿用旧截图。"
      },
      {
        "title": "Angel Island Tiburon Ferry：日期班表",
        "url": "https://angelislandferry.com/schedule",
        "description": "从 Tiburon 出发需单独核对营运日和当日返航。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "渡轮离岸后，Angel Island 把城市换成山坡、海风与另一种观看湾区的距离。第一次上岛，推荐以 Ayala Cove 和移民站为主线：既有步行和湾景，也有值得静下来阅读的历史。这里曾是许多移民经历检查与拘留的地方，参观墙上的诗句和个人故事时，给自己留出消化的时间。"
      },
      {
        "type": "heading",
        "text": "上岛前锁定船班、票种与补给"
      },
      {
        "type": "list",
        "items": [
          "编辑建议：为 Ayala Cove 与移民站留约 4–5 小时在岛上，往返船程另计；先挑可实现的回程班次，再决定参观长度。",
          "旧金山出发查 Golden Gate Ferry，Tiburon 出发查 Angel Island Tiburon Ferry。两家班表、票务和出发码头分开核对，不把另一家的船当默认返程保障。",
          "上岛需交通及入园预算；Golden Gate Ferry 当前说明船票含州立公园入园费，并提醒提前安排往返票。移民站部分馆内参观另收费，免费展馆也有独立开放安排。",
          "带够饮水、午餐、防晒和挡风外套；岛上餐饮、接驳和观光车具有季节性，只有确认实际营运后才纳入计划。"
        ]
      },
      {
        "type": "heading",
        "text": "用一条往返线连接码头与移民站"
      },
      {
        "type": "route",
        "title": "Ayala Cove → 移民站 → 回码头留白",
        "text": "停留时间为编辑建议，步行速度因坡度、台阶和同行者而异。地图只定位停留点，路线以官方地图和现场标识为准。",
        "stops": [
          {
            "title": "第一站 · Ayala Cove 登岛与辨认返程码头",
            "text": "下船后先拍下返航信息，确认登船队列和洗手间位置，预留 20–30 分钟整理背包与阅读地图。不要一上岛就追着人群爬台阶；先确认你们选择的是有台阶近线还是较长的道路版本。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Ayala%20Cove%20Ferry%20Terminal%20Angel%20Island"
          },
          {
            "title": "第二站 · U.S. Immigration Station",
            "text": "官方列台阶路线从码头单程约 1 英里，包含约 140 级台阶；免台阶版本约 1.5 英里，仍有陡坡。按体力留出步行余量，到站后用约 60–90 分钟阅读展陈；先查当天开放与票务，把拘留营房和原医院内的移民博物馆区分清楚。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Angel%20Island%20Immigration%20Station"
          },
          {
            "title": "第三站 · 返回 Ayala Cove 草地与码头",
            "text": "按来时已确认的路线返回，先到码头附近，再决定是否野餐或看水面。建议把计划回船前 30 分钟作为已经回到 Ayala Cove 的个人目标；Golden Gate Ferry 另建议约提前 15 分钟到登船处，不要把这当从博物馆出发的时间。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Ayala%20Cove%20Angel%20Island%20State%20Park"
          }
        ]
      },
      {
        "type": "heading",
        "text": "把无障碍、家庭节奏和天气放进同一个计划"
      },
      {
        "type": "paragraph",
        "text": "免台阶并不等于平路。州立公园说明去移民站的道路有陡坡，只向电量充足的强动力电动轮椅使用者推荐这条较长步行路线；手动轮椅家庭应提前联系公园确认可行协助。工作人员协助和商业接驳不是随到随用，也未必能运输电动轮椅或不能转移至车辆座位的人。小推车或年幼孩子可把 Ayala Cove 草地、游客中心周边和野餐作为完整短版，按实际情况选择是否上坡。"
      },
      {
        "type": "tip",
        "title": "风起或时间不足时，先缩短路线",
        "text": "雾天不保证看见完整城市天际线，大风天先看航运提醒；返程受影响时及时向船员确认安排。第一次不必再追加登顶和完整环岛。若发现按当前速度不能留足回码头余量，立即原路返回；另查公园当日防火、步道和设施公告，自带水，不把临时接驳当作赶船办法。"
      },
      {
        "type": "checklist",
        "items": [
          "核对出发日的去程、回程、营运商和码头，保存票务信息。",
          "确认移民站当天开放；需行动协助时提前联系公园。",
          "选择台阶路线或较长道路路线，设置折返和到码头提醒。",
          "带水、午餐、外套和充好电的手机，查最新天气及服务公告。",
          "孩子体力不足时保留 Ayala Cove 短版，确保全组一起返航。"
        ]
      },
      {
        "type": "link",
        "title": "查看 Angel Island 官方公告与开放信息",
        "text": "先读当前限制，再进入船班与博物馆链接；返程信息按实际出行日期复核。",
        "url": "https://www.parks.ca.gov/?page_id=468"
      },
      {
        "type": "cta",
        "title": "下一趟继续发现湾区水岸",
        "text": "比较 Sausalito 海滨和其他北湾路线，为不同体力与天气准备替代方案。",
        "primaryLabel": "继续看湾区出游攻略",
        "primaryAction": "guides"
      }
    ]
  }
];

export const northExpandedAttractions: Attraction[] = [
  {
    "id": "point-reyes",
    "slug": "point-reyes-bear-valley-first-visit-guide",
    "title": "Point Reyes · Bear Valley 自然半日",
    "city": "Olema",
    "region": "north-bay",
    "themes": [
      "nature"
    ],
    "cost": "free",
    "duration": "2–4 小时",
    "note": "从游客中心、地震短线与林间散步开始；轮椅和推车先查实际路面，往返交通另计。",
    "mapQuery": "Bear Valley Visitor Center Point Reyes",
    "officialUrl": "https://www.nps.gov/pore/planyourvisit/tripideas.htm"
  },
  {
    "id": "angel-island",
    "slug": "angel-island-ferry-first-day-guide",
    "title": "Angel Island · 渡轮与移民历史",
    "city": "Tiburon",
    "region": "north-bay",
    "themes": [
      "waterfront",
      "nature",
      "culture"
    ],
    "cost": "paid",
    "duration": "岛上 4–5 小时",
    "note": "船票、入园和馆内参观分别核对；先定回程船，再按坡度与台阶选择路线。",
    "mapQuery": "Ayala Cove Ferry Terminal Angel Island",
    "officialUrl": "https://www.parks.ca.gov/?page_id=468"
  }
];
