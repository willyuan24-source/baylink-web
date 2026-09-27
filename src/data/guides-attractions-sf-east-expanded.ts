import type { Guide } from './guides';
import type { Attraction } from './attractions';

// Official sources checked 2026-09-26. Route timings are editorial suggestions.
export const sfEastExpandedGuides: Guide[] = [
  {
    "category": "city",
    "categoryLabel": "城市指南",
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "other",
      "ride"
    ],
    "readMinutes": 5,
    "updatedAt": "2026-09-26",
    "sourceNote": "官方资料核验于 2026 年 9 月 26 日。路线与停留时长为 BAYLINK 编辑建议；开放、票价、交通和通行条件请在出发前再次核对。",
    "slug": "sf-lands-end-sutro-baths-walk-guide",
    "title": "旧金山的海风半日：Lands End 与 Sutro Baths 短线攻略",
    "subtitle": "从浴场遗址的上方看海，再走一段能随时折返的海岸步道",
    "summary": "把遗址观景、柏树林与海岸短线串起来，分清无障碍路段、陡坡和台阶，给雾天与带娃出游留出余地。",
    "emoji": "🌊",
    "audience": [
      "喜欢海岸散步的人",
      "带家人看旧金山"
    ],
    "tags": [
      "旧金山",
      "Lands End",
      "Sutro Baths",
      "海岸步道",
      "遗址与风景"
    ],
    "sources": [
      {
        "title": "NPS：Lands End 游览指南",
        "url": "https://www.nps.gov/goga/planyourvisit/landsend.htm",
        "description": "了解海岸步道、观景与保持悬崖距离的官方提醒。"
      },
      {
        "title": "NPS：Lands End 无障碍路线",
        "url": "https://www.nps.gov/goga/planyourvisit/lands-end-accessibility.htm",
        "description": "Merrie Way 起点至无障碍观景点的路段，以及后续台阶和不平路面。"
      },
      {
        "title": "NPS：Sutro Baths 通行条件",
        "url": "https://www.nps.gov/goga/planyourvisit/sutro-baths-accessibility.htm",
        "description": "下到浴场的铺装路很陡，并有裂缝与高差；核对停车和洗手间位置。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "Lands End 的吸引力是城市忽然退到身后：柏树之间露出海面，旧浴场的轮廓又把人拉回旧金山的历史。第一次来不必挑战全程，先从高处读懂遗址，再沿海岸走到舒服的位置折返；即使有雾，看树形、岩岸和浪花也足够撑起半日。"
      },
      {
        "type": "heading",
        "text": "先确定起点与当天能走多远"
      },
      {
        "type": "list",
        "items": [
          "建议预留 2–3 小时，包含观景与休息；这是编辑安排，不是官方步行时间。",
          "户外散步与遗址观景无需景点门票；餐饮、交通及可能的停车支出另算。",
          "以 Lands End Lookout / Merrie Way 为集合点；驾车先确认停车标识，乘公交先核对当日到达站与返程方向。"
        ]
      },
      {
        "type": "heading",
        "text": "三站短线：先认遗址，再走海岸"
      },
      {
        "type": "route",
        "title": "从 Lookout 出发的可折返路线",
        "text": "以下停留为编辑建议；地图用于找入口，具体通行以现场路牌为准。",
        "stops": [
          {
            "title": "第一站 · Lands End Lookout 周边",
            "text": "先在游客中心周边辨认海岸方向，看看外部地形模型，再决定是否进入当天开放的展区。把洗手间和补水安排在这一站；有孩子同行时，让他们先找出浴场、海面与步道的位置，后面就不只是一直往前走。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Lands%20End%20Lookout%20San%20Francisco"
          },
          {
            "title": "第二站 · Sutro Baths 上方观景",
            "text": "在正式步道与观景位置停下，比较水池残壁与海浪的位置，想象昔日浴场的规模。主路线保留在上方；下到遗址是额外的陡坡选择，湿滑、风大或体力不足时跳过，不沿残墙或临海边缘找拍照捷径。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Sutro%20Baths%20San%20Francisco"
          },
          {
            "title": "第三站 · Coastal Trail 短段折返",
            "text": "回到 Merrie Way 一侧的步道起点，沿官方标示路线进入树荫与海岸视野。先把无障碍观景点作为折返点，停下来听风、看远处岬角；继续前行会遇到台阶和不平路面，同行者都愿意再走才延长，回程仍走熟悉的原路。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Lands%20End%20Trail%20Merrie%20Way%20San%20Francisco"
          }
        ]
      },
      {
        "type": "heading",
        "text": "把海风、坡度与返程一起安排"
      },
      {
        "type": "paragraph",
        "text": "轮椅或推车优先走 Merrie Way 至无障碍观景点的短段，不能把整条海岸线视为无台阶。浴场下坡虽有铺装，官方仍提醒坡度很陡且有裂缝。带防风外套和防滑鞋；雾大时缩短路线，孩子保持在成人身边。回到 Lookout 再整理行李与查车，不把返程拖到天黑后。"
      },
      {
        "type": "checklist",
        "items": [
          "查看国家公园当天的步道与设施提示。",
          "下载入口地图，约好折返点与集合位置。",
          "带外套、饮水与防滑鞋，保持悬崖距离。",
          "先查返程公交或停车安排，预留天黑前离开的时间。"
        ]
      },
      {
        "type": "link",
        "title": "出发前查看 Lands End 官方信息",
        "text": "结合步道提示与无障碍说明，为同行者选择合适的短线。",
        "url": "https://www.nps.gov/goga/planyourvisit/landsend.htm"
      },
      {
        "type": "cta",
        "title": "继续找适合自己的湾区半日路线",
        "text": "把海岸散步与其他地区的公园、街区或博物馆攻略一起比较。",
        "primaryLabel": "浏览更多出游攻略",
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
    "readMinutes": 5,
    "updatedAt": "2026-09-26",
    "sourceNote": "官方资料核验于 2026 年 9 月 26 日。路线与停留时长为 BAYLINK 编辑建议；开放、票价、交通和通行条件请在出发前再次核对。",
    "slug": "sf-mission-dolores-murals-walk-guide",
    "title": "Mission 半日慢走：Dolores Park 草坡与街区壁画",
    "subtitle": "从城市天际线走进 24th Street，让壁画有故事、午餐有时间",
    "summary": "把公园休息与 Balmy Alley 壁画连成可分段的街区路线，讲清步行距离、导览预约、坡道与带娃节奏。",
    "emoji": "🎨",
    "audience": [
      "喜欢街区文化的人",
      "不赶景点的城市散步"
    ],
    "tags": [
      "旧金山",
      "Mission",
      "Dolores Park",
      "壁画",
      "街区散步"
    ],
    "sources": [
      {
        "title": "SF Rec & Park：Mission Dolores Park",
        "url": "https://sfrecpark.org/892/Mission-Dolores-Park",
        "description": "核对公园位置、草地、游乐场、洗手间与街边停车信息。"
      },
      {
        "title": "SF Rec & Park：Helen Diller 游乐场",
        "url": "https://sfrecpark.org/648/Mission-Dolores---Helen-Diller-Playgroun",
        "description": "了解儿童分龄设施与从无障碍入口通向游乐区的路径。"
      },
      {
        "title": "Precita Eyes：壁画中心与当期导览",
        "url": "https://www.precitaeyes.org/",
        "description": "由社区壁画机构发布的艺术家导览与中心资料。"
      },
      {
        "title": "Precita Eyes：经典壁画路线背景",
        "url": "https://www.precitaeyes.org/og-classic-mural-tour.html",
        "description": "介绍 24th Street 与 Balmy Alley 的导览范围；旧日期与票价不作为当天安排。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "这条路线的好处，是把 Mission 当成有人生活的街区来认识：在 Dolores Park 看天际线与草坡上的日常，再到壁画前读人物、语言和社区记忆。每幅墙画都值得停一下，午餐也不必变成赶场补给。全线可以拆成两次，带小孩时只完成公园加一条壁画巷也很好。"
      },
      {
        "type": "heading",
        "text": "先选自助散步，还是预约社区导览"
      },
      {
        "type": "list",
        "items": [
          "建议留 3–4 小时含午餐；停留为编辑建议，公园与 Balmy Alley 之间另有街区步行。",
          "公园和公共街巷观赏无需景点门票；餐饮、交通及 Precita Eyes 导览费用另计。",
          "以 Dolores Park 集合，结束后从 24th Street 一带安排返程；开车要把回取车的距离算入。",
          "参加导览就按当期场次反排公园时间，确认集合地址；不要沿用旧活动页的日期或票价。"
        ]
      },
      {
        "type": "heading",
        "text": "从草坡到壁画，分三站慢慢看"
      },
      {
        "type": "route",
        "title": "Dolores Park → 24th Street → Balmy Alley",
        "text": "三站是编辑推荐的方向，公园到壁画区不是一出门就到；体力不足可另乘交通接续。",
        "stops": [
          {
            "title": "第一站 · Dolores Park 的草坡与城市视野",
            "text": "先找一处不挡主路的位置坐下，看草坡与远处的城市轮廓，不必抢到最高处才算看过。带孩子可先到 Helen Diller 游乐场，按年龄挑设施；公园有坡度，推车与行动不便者沿正式铺装路径选合适的位置休息。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Mission%20Dolores%20Park%20San%20Francisco"
          },
          {
            "title": "第二站 · 24th Street 与 Precita Eyes",
            "text": "从公园步行或转乘到二十四街，先找午餐和坐下休息的机会，再到 Precita Eyes 中心了解壁画背景。若参加导览，按预约时间集合；自由行则挑少量作品认真看，记录作者与主题，让画面与街区的日常连起来。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Precita%20Eyes%202981%2024th%20Street%20San%20Francisco"
          },
          {
            "title": "第三站 · Balmy Alley 的近距离阅读",
            "text": "走进巷子后先看整面构图，再找人物、标语与色彩的关系；可以和孩子各选一幅，说说自己看到什么。这里也有居民出入口与车道，拍照时留出通行空间，不倚靠画面或进入私人区域；结束后回到二十四街安排交通。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Balmy%20Alley%20San%20Francisco"
          }
        ]
      },
      {
        "type": "heading",
        "text": "按阳光、坡度与同行者体力缩短路线"
      },
      {
        "type": "paragraph",
        "text": "晴天带水、防晒与薄外套；雨天草地不适合久坐，可缩短为壁画区与室内用餐。游乐场有无障碍进入路径，但不代表每项游具、草坡或街巷路面都适合轮椅。带娃先定休息点，遇到路口一起过街；返程提前查公共交通，若要回原停车点，留出额外步行或叫车时间。"
      },
      {
        "type": "checklist",
        "items": [
          "查 Precita Eyes 当期导览与中心营业安排。",
          "按同行者体力决定全程步行还是两段转乘。",
          "带饮水、防晒与野餐垃圾袋，离开时清理场地。",
          "保存集合点与返程位置，拍壁画时尊重居民通行。"
        ]
      },
      {
        "type": "link",
        "title": "查看社区壁画机构的当期安排",
        "text": "用 Precita Eyes 最新页面确认导览和集合信息。",
        "url": "https://www.precitaeyes.org/"
      },
      {
        "type": "cta",
        "title": "继续认识湾区的街区与文化",
        "text": "按同行者兴趣，继续比较城市散步、校园与艺术馆路线。",
        "primaryLabel": "浏览更多出游攻略",
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
    "readMinutes": 5,
    "updatedAt": "2026-09-26",
    "sourceNote": "官方资料核验于 2026 年 9 月 26 日。路线与停留时长为 BAYLINK 编辑建议；开放、票价、交通和通行条件请在出发前再次核对。",
    "slug": "alameda-uss-hornet-shoreline-day-guide",
    "title": "Alameda 一日两种节奏：USS Hornet 航母与海岸散步",
    "subtitle": "先把时间留给舰上展览，再独立转场到 Crab Cove 放慢脚步",
    "summary": "从机库与甲板认识航母，再接免费海岸短线；分清舰上通行限制、额外导览与两个目的地之间的交通。",
    "emoji": "⚓",
    "audience": [
      "喜欢航空与航海历史的人",
      "东湾家庭一日出游"
    ],
    "tags": [
      "东湾",
      "Alameda",
      "USS Hornet",
      "海岸与博物馆",
      "亲子出游"
    ],
    "sources": [
      {
        "title": "USS Hornet：参观安排",
        "url": "https://uss-hornet.org/visit-hornet/",
        "description": "官方参观入口、地址、展览与活动信息。"
      },
      {
        "title": "USS Hornet：门票与导览",
        "url": "https://uss-hornet.org/tickets/",
        "description": "核对普通入场、导览附加费用与适用开放日。"
      },
      {
        "title": "USS Hornet：游客提示",
        "url": "https://uss-hornet.org/visitor-tips/",
        "description": "儿童陪同、包袋、陡梯及轮椅和推车限制。"
      },
      {
        "title": "EBRPD：Crown Beach 与 Crab Cove",
        "url": "https://www.ebparks.org/parks/crown-beach",
        "description": "海岸入口、铺装路径、停车、水质与海滩规定。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "Alameda 的这一天，适合把好奇心与放空各留一半：登上 USS Hornet 看飞机与舰上空间，理解一艘航母怎样工作；下船后再到海岸看水面和飞鸟。航母与 Crab Cove 是两个独立目的地，中间需要转场，别把海滩当成走下舷梯就到的下一站。"
      },
      {
        "type": "heading",
        "text": "先订舰上重点，再安排海岸转场"
      },
      {
        "type": "list",
        "items": [
          "编辑建议留 4–5 小时，舰上约 2–3 小时，另留用餐、转场与海岸短走时间。",
          "航母需购票，部分导览另收费；海岸散步无需景点门票，但停车与交通另计。",
          "先到 707 W Hornet Avenue；想看特殊舱室要先查当日导览和身高等限制，不以普通门票推定全部可进入。",
          "提前选好航母到 Crab Cove 的驾车或其他接续方式；若搭渡轮，另核对码头到景点及末段返程。"
        ]
      },
      {
        "type": "heading",
        "text": "两段行程，三处认真停留"
      },
      {
        "type": "route",
        "title": "机库展览 → 开放甲板 → Crab Cove 海岸",
        "text": "按当天开放区域调整舰上顺序；第三站需要离馆后独立转场。",
        "stops": [
          {
            "title": "第一站 · USS Hornet 机库与展览",
            "text": "入馆先拿地图，向工作人员确认当天开放区域与想参加的导览，再从机库展览建立对整艘船的认识。带孩子可选一架飞机和一件展品仔细看，让他们找出用途与细节；不必把每个舱室都列为必须完成的项目。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=USS%20Hornet%20Museum%20Alameda"
          },
          {
            "title": "第二站 · 当天可进入的甲板与舰上空间",
            "text": "根据工作人员指引与同行者行动能力，选择能进入的甲板或舱室，比较船体尺度与飞机之间的关系。上下陡梯时留出间距并抓稳扶手，孩子全程由成人陪同；若不适合登梯，留在可通行展区，并询问机库内的虚拟参观。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=USS%20Hornet%20Sea%20Air%20Space%20Museum"
          },
          {
            "title": "第三站 · 转场到 Crab Cove 海岸短走",
            "text": "离馆用餐后重新导航到 McKay Avenue 的 Crab Cove 入口，把步调换成看海与坐下休息。沿开放的铺装路径选一小段往返，游客中心开放时再看海湾生态展览；不要为了凑完整海岸线而进入封闭区，体力用完就从原入口返程。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Crab%20Cove%20Visitor%20Center%20Alameda"
          }
        ]
      },
      {
        "type": "heading",
        "text": "历史舰船与海滩，各有不同的通行条件"
      },
      {
        "type": "paragraph",
        "text": "官方明确提示舰上轮椅与推车通行非常有限，带婴儿背架也有禁限，订票前先联系场馆确认实际可访范围。穿包头防滑鞋，甲板与海岸都备外套；遇雨可把时间留给可开放的室内展区。Crab Cove 有铺装路径，但沙滩并非普通轮椅路面；下水另查水质与现场条件，Crown Beach 没有救生员。看清停车场关门提示再散步。"
      },
      {
        "type": "checklist",
        "items": [
          "核对航母开放日、普通票与所选导览的条件。",
          "需要轮椅、推车或婴儿背架时提前联系场馆。",
          "穿防滑包头鞋，带外套，按官网要求精简包袋。",
          "保存两个目的地与返程位置，查海岸停车和水质公告。"
        ]
      },
      {
        "type": "link",
        "title": "查看 USS Hornet 当天参观信息",
        "text": "先确认门票、可进入区域与导览，再安排海岸时间。",
        "url": "https://uss-hornet.org/visit-hornet/"
      },
      {
        "type": "cta",
        "title": "继续比较东湾的一日路线",
        "text": "从博物馆、湖畔与自然公园中，选适合家人体力和兴趣的一天。",
        "primaryLabel": "浏览更多出游攻略",
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
    "readMinutes": 5,
    "updatedAt": "2026-09-26",
    "sourceNote": "官方资料核验于 2026 年 9 月 26 日。路线与停留时长为 BAYLINK 编辑建议；开放、票价、交通和通行条件请在出发前再次核对。",
    "slug": "fremont-coyote-hills-short-walk-guide",
    "title": "Fremont 的湿地半日：Coyote Hills 看鸟与短线散步",
    "subtitle": "先看游客中心，再把木栈道与 Bayview 步道拆成轻松小段",
    "summary": "用游客中心、湿地观察与铺装步道认识东湾自然，分清完整环线与短程折返，兼顾家庭、天气与返程安排。",
    "emoji": "🦆",
    "audience": [
      "第一次观鸟的人",
      "Fremont 周边亲子家庭"
    ],
    "tags": [
      "东湾",
      "Fremont",
      "Coyote Hills",
      "湿地观鸟",
      "自然教育"
    ],
    "sources": [
      {
        "title": "EBRPD：Coyote Hills 公园指南",
        "url": "https://www.ebparks.org/parks/coyote-hills",
        "description": "入口、停车、门禁、设施与 Bayview 铺装环线信息。"
      },
      {
        "title": "EBRPD：Coyote Hills 游客中心",
        "url": "https://www.ebparks.org/parks/visitor-centers/coyote-hills",
        "description": "Ohlone 文化、自然展览与游客中心开放安排。"
      },
      {
        "title": "EBRPD：Coyote Hills 官方步道图",
        "url": "https://www.ebparks.org/sites/default/files/maps/Coyote-Hills-Map.pdf",
        "description": "区分铺装路、坡度、湿地区域与季节性积水连接段。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "Coyote Hills 适合愿意把脚步放慢的人：水边的鸟、芦苇与远处起伏的草坡，比一张打卡照更有意思。先从展览认识 Ohlone 文化与湿地生态，再去找真实的植物和鸟影，孩子也容易参与。这里不需要登顶或走完环线才算来过，选短段折返更适合初访。"
      },
      {
        "type": "heading",
        "text": "先选入口，再区分公园与展馆时间"
      },
      {
        "type": "list",
        "items": [
          "编辑建议留 2–3 小时，展览、观鸟和短步道各留一段；不包含完整环线或往返交通。",
          "普通户外散步无需景点门票，驾车停车另收费；专项活动与预订项目单独核对。",
          "导航到 8000 Patterson Ranch Road 的主入口与游客中心区域，避免把不同 staging area 当同一集合点。",
          "公园门禁随季节变化，游客中心另有开放日；节假日官网页面可能不一致，专程看展前联系园方确认。"
        ]
      },
      {
        "type": "heading",
        "text": "游客中心、湿地与铺装路，三站认识公园"
      },
      {
        "type": "route",
        "title": "从游客中心出发的短段组合",
        "text": "按官方地图与现场开放选择往返小段；以下不代表全程无障碍或固定环线。",
        "stops": [
          {
            "title": "第一站 · 游客中心与自然展览",
            "text": "开放时先看 Ohlone 生活与湿地生态展览，再拿地图询问当天适合的短路段。可以让孩子挑一种鸟或植物作为观察任务；中心关闭时先读户外说明牌，仍以停车区附近为起点，不因想看展而临时绕去陌生入口。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Coyote%20Hills%20Visitor%20Center%20Fremont"
          },
          {
            "title": "第二站 · Marsh Boardwalk 湿地观察",
            "text": "按现场指示走到当天开放的木栈道或湿地边缘，停下来观察水面与芦苇间的动静。用望远镜把距离拉近，比追着鸟走更有收获；孩子留在正式路面内，不投喂、不伸手采集，若栈道关闭就改看已开放的岸边视野。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Marsh%20Boardwalk%20Coyote%20Hills%20Regional%20Park"
          },
          {
            "title": "第三站 · Bayview Trail 短段折返",
            "text": "回到适合接入的路口，按地图选一段 Bayview 铺装路慢走，看看湿地与草坡如何相接。官方完整环线较长，初访不必全走；先定返程时间，遇到坡度、逆风或孩子疲倦就原路折返，把剩余体力留给回停车区。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Bayview%20Trail%20Coyote%20Hills%20Fremont"
          }
        ]
      },
      {
        "type": "heading",
        "text": "铺装不等于平坦，阴凉与返程都要预留"
      },
      {
        "type": "paragraph",
        "text": "游客中心区域有无障碍停车与洗手间，但山坡和所有支线不能因此视为轮椅适用；带推车先问路面和坡度。晴天带足水、帽子与防晒，风起时加外套；雨后依路牌避开积水和泥泞段。搭公共交通需另查车站到公园的最后一段，不能把邻近 BART 站当步道起点。回程给停车场关门和叫车等候留余量。"
      },
      {
        "type": "checklist",
        "items": [
          "核对当天公园门禁、展馆开放与步道公告。",
          "下载官方地图，确定停车区、短路线与折返点。",
          "带水、防晒与望远镜，给孩子安排休息。",
          "先安排最后一段交通与回程，湿地区域按路牌通行。"
        ]
      },
      {
        "type": "link",
        "title": "查 Coyote Hills 当天安排与地图",
        "text": "对照公园公告选短线，节假日专程看展可先联系游客中心。",
        "url": "https://www.ebparks.org/parks/coyote-hills"
      },
      {
        "type": "cta",
        "title": "继续寻找湾区的轻松自然路线",
        "text": "把湿地、红杉林与海岸路线一起比较，选适合当天体力的一条。",
        "primaryLabel": "浏览更多出游攻略",
        "primaryAction": "guides"
      }
    ]
  }
];

export const sfEastExpandedAttractions: Attraction[] = [
  {
    "id": "lands-end",
    "slug": "sf-lands-end-sutro-baths-walk-guide",
    "title": "Lands End 与 Sutro Baths",
    "city": "San Francisco",
    "region": "sf",
    "themes": [
      "waterfront",
      "nature",
      "culture"
    ],
    "cost": "free",
    "duration": "2–3 小时",
    "note": "柏树林间看海与浴场遗址；无障碍短段之后有台阶，下到遗址需走陡坡。",
    "mapQuery": "Lands End Lookout San Francisco",
    "officialUrl": "https://www.nps.gov/goga/planyourvisit/landsend.htm"
  },
  {
    "id": "mission-dolores",
    "slug": "sf-mission-dolores-murals-walk-guide",
    "title": "Dolores Park 与 Mission 壁画",
    "city": "San Francisco",
    "region": "sf",
    "themes": [
      "culture",
      "nature"
    ],
    "cost": "free",
    "duration": "3–4 小时",
    "note": "在草坡看天际线，再读 Mission 社区壁画；公园与公共街巷免费，社区导览另计。",
    "mapQuery": "Mission Dolores Park San Francisco",
    "officialUrl": "https://sfrecpark.org/892/Mission-Dolores-Park"
  },
  {
    "id": "uss-hornet",
    "slug": "alameda-uss-hornet-shoreline-day-guide",
    "title": "USS Hornet 航母与 Alameda 海岸",
    "city": "Alameda",
    "region": "east-bay",
    "themes": [
      "museum",
      "waterfront",
      "culture"
    ],
    "cost": "mixed",
    "duration": "4–5 小时",
    "note": "看飞机与历史舰船，再到海岸放松；航母需票且通行有限，海岸是独立转场。",
    "mapQuery": "USS Hornet Museum Alameda",
    "officialUrl": "https://uss-hornet.org/visit-hornet/"
  },
  {
    "id": "coyote-hills",
    "slug": "fremont-coyote-hills-short-walk-guide",
    "title": "Coyote Hills 湿地与草坡",
    "city": "Fremont",
    "region": "east-bay",
    "themes": [
      "nature",
      "waterfront"
    ],
    "cost": "free",
    "duration": "2–3 小时",
    "note": "看鸟、读 Ohlone 文化与走湿地短线；停车另计，铺装环线也要按坡度与体力选段。",
    "mapQuery": "Coyote Hills Visitor Center Fremont",
    "officialUrl": "https://www.ebparks.org/parks/coyote-hills"
  }
];
