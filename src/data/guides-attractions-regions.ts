import type { Guide } from './guides';

// Official sources verified 2026-09-09; route timing is editorial guidance.
export const regionalAttractionGuides: Guide[] = [
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
    "updatedAt": "2026-09-09",
    "sourceNote": "官方资料核验于 2026 年 9 月 9 日。路线顺序与停留时长为 BAYLINK 编辑建议；票价、开放、预约和交通请在出发前再次核对。图片为注明来源的资料照片，不代表当天花况、展陈或路况。",
    "slug": "berkeley-campus-botanical-garden-half-day",
    "title": "从校园钟楼到山中植物园：Berkeley 的两种慢生活",
    "subtitle": "先看 Sather Gate 和 Memorial Glade，再用一段明确的交通接上花园",
    "summary": "把 UC Berkeley 校园外景与山上的植物收藏分成两段，讲清门票、周二闭园、周末接驳空档和坡道路面。",
    "emoji": "🌳",
    "audience": [
      "喜欢校园与植物的人",
      "东湾半日出游"
    ],
    "tags": [
      "东湾",
      "Berkeley",
      "UC Berkeley",
      "植物园",
      "校园散步"
    ],
    "sources": [
      {
        "title": "UC Berkeley：自助校园地图",
        "url": "https://visit.berkeley.edu/sites/default/files/berkeley-self-guided-tour-map-2021.pdf",
        "description": "定位 Sather Gate、Memorial Glade 等地标；旧地图结合现场通行标识使用。"
      },
      {
        "title": "UC Botanical Garden：参观与门票",
        "url": "https://botanicalgarden.berkeley.edu/visit/plan-your-visit/",
        "description": "核对周二闭园、年龄票种、建议预约及温室较早关闭。"
      },
      {
        "title": "UC Botanical Garden：上山与停车",
        "url": "https://botanicalgarden.berkeley.edu/visit/plan-your-visit/directions-parking/",
        "description": "H shuttle 仅工作日，停车另计且不保证车位。"
      },
      {
        "title": "UC Botanical Garden：无障碍说明",
        "url": "https://botanicalgarden.berkeley.edu/visit/accessibility/",
        "description": "路径包括坡道、碎石与台阶，请按行动需要选线。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "Berkeley 好玩的反差，是上午还在图书馆外的草地看学生来往，稍后就站在山坡上读植物名牌。别把两处当成一座平坦公园：校园适合随意走，植物园在 Strawberry Canyon，需要另算上山交通。这条路线把“看名校”和“认真看一片叶子”放在同一天，但给两段都留了退出空间。"
      },
      {
        "type": "heading",
        "text": "先分开安排校园与植物园"
      },
      {
        "type": "list",
        "items": [
          "建议预留 3.5–4.5 小时；校园外景约一小时，植物园约两小时，中间留交通缓冲。",
          "校园公共室外路线免门票；植物园成人 $18，65+ 与非 UCB 学生 $12，5–17 岁 $8，4 岁及以下免费。优惠票需核身份。",
          "植物园通常 10:00–17:00，16:30 最后入场，周二关闭；温室与 Redwood Grove 提前至 16:00 关闭。普通访客建议提前预约。"
        ]
      },
      {
        "type": "heading",
        "text": "从钟楼草坪走向山中植物"
      },
      {
        "type": "route",
        "title": "两段路线：校园不赶场，花园选一条环线",
        "text": "停留时长是编辑建议，不含往返交通；按现场开放和同行者体力调整。",
        "stops": [
          {
            "title": "先逛 · Sather Gate 到 Memorial Glade",
            "text": "看校门、钟楼外景与草坪，选一个位置坐十分钟。建筑内部能否进入按门口规定，登钟楼不包含在本路线的免票部分。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Sather%20Gate%20Berkeley"
          },
          {
            "title": "再上山 · 植物园入口",
            "text": "导航到 200 Centennial Drive。工作日可查 Hearst Mining Circle 的 H shuttle；周末别等这班车，也别把偶尔开行的溢出停车接驳当校园专线。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=UC%20Botanical%20Garden%20Berkeley"
          },
          {
            "title": "慢慢看 · 主路与当天开放的植物区",
            "text": "先拿地图，选两三个地理植物区，比较叶片与生长环境；拍完标签再拍植物，回家能继续认识。结束回到入口，按原先约好的交通下山。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=UC%20Botanical%20Garden%20Berkeley"
          }
        ]
      },
      {
        "type": "paragraph",
        "text": "停车场在花园入口对面，官网列 $1.50/小时，数量有限；手机信号也可能弱，先保存付款和返程信息。校园到花园不是轻松平移：官方只建议能适应至少半小时上坡的人步行或骑车前往。轮椅与小轮推车家庭应事先查看路面图，并向花园确认适合的短线，不把“有无障碍设施”理解成每条小径都平整。"
      },
      {
        "type": "heading",
        "text": "上山前，确认交通与同行者体力"
      },
      {
        "type": "checklist",
        "items": [
          "确认当天不是周二或临时闭园日，想看温室就把它排早。",
          "先定上山和下山方式，比赛日另查校园道路调整。",
          "保存门票、停车付款方式与官方地图，带水和防晒。"
        ]
      },
      {
        "type": "link",
        "title": "查植物园当天开放与预约",
        "text": "打开官方页面，按实际出行日期核对后再订票或出发。",
        "url": "https://botanicalgarden.berkeley.edu/visit/plan-your-visit/"
      },
      {
        "type": "cta",
        "title": "把实际体验留给下一位湾区邻居",
        "text": "欢迎分享当天的开放提醒、适合同行者的短路线和一张自己拍的照片；约同行时写明日期、集合点、交通与预计结束时间。",
        "primaryLabel": "发布出游分享或同行需求",
        "primaryAction": "post",
        "postType": "client",
        "postCategorySlug": "other"
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
    "updatedAt": "2026-09-09",
    "sourceNote": "官方资料核验于 2026 年 9 月 9 日。路线顺序与停留时长为 BAYLINK 编辑建议；票价、开放、预约和交通请在出发前再次核对。图片为注明来源的资料照片，不代表当天花况、展陈或路况。",
    "slug": "oakland-lake-merritt-omca-half-day",
    "title": "Oakland 不必绕湖一整圈：Lake Merritt 与 OMCA 的松弛半日",
    "subtitle": "从 BART 出发，先看湖，再在加州艺术与花园里停下来",
    "summary": "把 Lake Merritt 南侧与 OMCA 连成短程，给出免费花园和收费展厅的分界、家庭玩法及返程选择。",
    "emoji": "🦆",
    "audience": [
      "想坐 BART 出游的人",
      "喜欢艺术与城市水景的人"
    ],
    "tags": [
      "东湾",
      "Oakland",
      "Lake Merritt",
      "OMCA",
      "博物馆",
      "半日路线"
    ],
    "sources": [
      {
        "title": "OMCA：开放、门票与到达",
        "url": "https://museumca.org/visit/",
        "description": "核对票种、Lake Merritt BART、停车与无障碍入口。"
      },
      {
        "title": "OMCA：免费花园",
        "url": "https://museumca.org/on-view/garden/",
        "description": "免费花园随博物馆开放，临时关闭与聚会另有规则。"
      },
      {
        "title": "Oakland 市府：Lakeside Park",
        "url": "https://www.oaklandca.gov/Community/Parks-Facilities/Parks/Lakeside-Park",
        "description": "了解湖区、铺装步道与园内设施；不是每项设施都免费。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "第一次逛 Lake Merritt，不需要用绕完整圈证明自己来过。把注意力放在南侧的水面与城市轮廓，再转进 Oakland Museum of California，看同一片加州如何被艺术、历史和自然科学重新讲述。想省预算的人可以只逛花园；想躲太阳或深入看展的人，再为展厅留票钱。"
      },
      {
        "type": "heading",
        "text": "选好看展日，分清花园与展厅"
      },
      {
        "type": "list",
        "items": [
          "建议 3–4 小时：湖边约 45 分钟，花园约半小时，展厅按兴趣再留 1–2 小时。",
          "OMCA 通常周三至周日 11:00–17:00，周五延长到 21:00，周一、二关闭；节假日另查。",
          "花园免费但有开放时间。全馆含特展票成人 $25、65+ $22、13–17 岁及持有效证件的学生/教育工作者 $18，12 岁及以下免费。首个周日优惠按官方当期说明。"
        ]
      },
      {
        "type": "heading",
        "text": "把湖边与博物馆连成半天"
      },
      {
        "type": "route",
        "title": "以博物馆为锚点的小环线",
        "text": "停留时长是编辑建议，不含往返交通；按现场开放和同行者体力调整。",
        "stops": [
          {
            "title": "集合 · Lake Merritt BART",
            "text": "从 Oak Street 一侧确认去 OMCA 的方向；博物馆主入口在 1000 Oak Street。先认清回程站口，再开始走。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Lake%20Merritt%20BART%20Oakland"
          },
          {
            "title": "放空 · 湖的南侧",
            "text": "沿开放的公共步道看水鸟和天际线，走到舒服的折返点就返回。别临时把北端所有景点都加进来；湖边活动和餐饮各自收费。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Lake%20Merritt%20Boulevard%20Oakland"
          },
          {
            "title": "收尾 · OMCA 花园或展厅",
            "text": "从开放入口进花园，先看本土植物与台地空间；买票后再选一个最感兴趣的展厅。孩子可用“找一种动物、一件物品、一幅作品”做观察游戏，最后回 BART。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Oakland%20Museum%20of%20California"
          }
        ]
      },
      {
        "type": "paragraph",
        "text": "OMCA 距 Lake Merritt BART 约一个街区，适合把停车任务省掉。开车则认准官网列的馆内车库，费用通常 $5/小时，入库与闭库时间要先看。馆内有坡道、电梯和无障碍卫生间，但顶层屋顶花园不能靠电梯到达；需要无台阶路线时，向前台说明具体需求。室内吃喝限制与户外不同，午餐不要直接带进展厅。"
      },
      {
        "type": "heading",
        "text": "离开前，留好返程与休息时间"
      },
      {
        "type": "checklist",
        "items": [
          "先选免费花园版还是含展厅版，预算加入交通与餐饮。",
          "查周一、二闭馆与节假日安排，购票前确认特展内容。",
          "约好湖边折返点；推车和轮椅路线向馆方核对。"
        ]
      },
      {
        "type": "link",
        "title": "查看 OMCA 的开放与票种",
        "text": "打开官方页面，按实际出行日期核对后再订票或出发。",
        "url": "https://museumca.org/visit/"
      },
      {
        "type": "cta",
        "title": "把实际体验留给下一位湾区邻居",
        "text": "欢迎分享当天的开放提醒、适合同行者的短路线和一张自己拍的照片；约同行时写明日期、集合点、交通与预计结束时间。",
        "primaryLabel": "发布出游分享或同行需求",
        "primaryAction": "post",
        "postType": "client",
        "postCategorySlug": "other"
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
    "updatedAt": "2026-09-09",
    "sourceNote": "官方资料核验于 2026 年 9 月 9 日。路线顺序与停留时长为 BAYLINK 编辑建议；票价、开放、预约和交通请在出发前再次核对。图片为注明来源的资料照片，不代表当天花况、展陈或路况。",
    "slug": "stanford-cantor-campus-art-walk",
    "title": "Stanford 的免费艺术下午：Main Quad、Cantor 与一小段校园散步",
    "subtitle": "不赶招生导览，把石拱廊、雕塑和一间展厅当作今天的主角",
    "summary": "以 Cantor 为固定室内站，搭配 Stanford Main Quad 外景；区分博物馆免费、停车收费和校园导览预约。",
    "emoji": "🏛️",
    "audience": [
      "半岛周末看展",
      "带亲友逛校园的人"
    ],
    "tags": [
      "半岛",
      "Stanford",
      "Cantor Arts Center",
      "免费艺术",
      "校园散步"
    ],
    "sources": [
      {
        "title": "Cantor：参观、开放与无障碍",
        "url": "https://museum.stanford.edu/visit",
        "description": "核对免费入场、周二三闭馆、展厅及无障碍入口。"
      },
      {
        "title": "Stanford：校园访客信息",
        "url": "https://visit.stanford.edu/",
        "description": "自助参观与招生导览不同，官方导览有预约和学期安排。"
      },
      {
        "title": "Stanford：停车与付款",
        "url": "https://transportation.stanford.edu/parking-stanford",
        "description": "访客停车使用指定区域，查 ParkMobile 与标牌时段。"
      },
      {
        "title": "Stanford：校园公共艺术地图",
        "url": "https://public-art.stanford.edu/",
        "description": "按作品位置选择短线，不把校园看成必须走完的大圈。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "Stanford 最适合慢看的，不只是那张人人都拍的红瓦拱廊。先在 Main Quad 看光影怎么穿过柱廊，再到 Cantor 选一件让你愿意多站一分钟的作品。免费的好处，是你不必为了“值回票价”把每个展厅都看完；给同行者各选一件作品，聊聊为什么喜欢，就已经有了一个完整下午。"
      },
      {
        "type": "heading",
        "text": "先核 Cantor 开放日与停车"
      },
      {
        "type": "list",
        "items": [
          "建议 2.5–3.5 小时。Cantor 免费，校园公共室外段免门票；餐饮、往返交通与可能的停车费用另计。",
          "Cantor 当前周一/五 11:00–18:00，周四 11:00–20:00，周六/日 10:00–17:00，周二/三关闭。不是每天都能进馆。",
          "10 人及以上馆内团体需提前登记；招生导览另行预约。2026/8/29–9/17 官方校园导览暂停，期间仍可自助访问公共区域。"
        ]
      },
      {
        "type": "heading",
        "text": "沿校园空间慢慢看艺术"
      },
      {
        "type": "route",
        "title": "三站就够：建筑、展厅、户外艺术",
        "text": "停留时长是编辑建议，不含往返交通；按现场开放和同行者体力调整。",
        "stops": [
          {
            "title": "第一站 · Main Quad 外景",
            "text": "从指定通行路线看石拱廊和庭院，不进入正在上课或限制访客的空间。拍照时给自行车和校园日常通行让路。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Stanford%20Main%20Quad"
          },
          {
            "title": "第二站 · Cantor Arts Center",
            "text": "按当天开放先选一至两个展厅，给每个人留“自己看”的时间。想听导览，就查该日安排，不把普通入场当成包含导览场次。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Cantor%20Arts%20Center%20Stanford"
          },
          {
            "title": "第三站 · 馆外雕塑与返程",
            "text": "用校园艺术地图挑馆外附近一站，看作品与树木、建筑的关系。之后回原来的停车点或车站，不临时横穿整个校园追下一件作品。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Cantor%20Arts%20Center%20Stanford"
          }
        ]
      },
      {
        "type": "paragraph",
        "text": "先把“到 Stanford”变成“到哪一处入口”。Cantor 在 Museum Way 与 Lomita Drive 一带，和 Main Quad 不是同一个门口。访客停车按指定区域和现场时段用 ParkMobile 付款，不能看到校园周末较安静就停进任何保留车位。馆方列有南侧坡道、Lomita Drive 无障碍落客点及可借轮椅；校园室外段的实际距离与路面，仍需按同行者状况缩短。"
      },
      {
        "type": "heading",
        "text": "带着适合自己的步行计划出发"
      },
      {
        "type": "checklist",
        "items": [
          "核对 Cantor 当天开馆时间，避免周二或周三只剩校园外景。",
          "需要团体或校园导览时，确认独立预约已完成。",
          "保存停车区域或返程站点；带水，给户外段留防晒。"
        ]
      },
      {
        "type": "link",
        "title": "核对 Cantor 的当天参观信息",
        "text": "打开官方页面，按实际出行日期核对后再订票或出发。",
        "url": "https://museum.stanford.edu/visit"
      },
      {
        "type": "cta",
        "title": "把实际体验留给下一位湾区邻居",
        "text": "欢迎分享当天的开放提醒、适合同行者的短路线和一张自己拍的照片；约同行时写明日期、集合点、交通与预计结束时间。",
        "primaryLabel": "发布出游分享或同行需求",
        "primaryAction": "post",
        "postType": "client",
        "postCategorySlug": "other"
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
    "updatedAt": "2026-09-09",
    "sourceNote": "官方资料核验于 2026 年 9 月 9 日。路线顺序与停留时长为 BAYLINK 编辑建议；票价、开放、预约和交通请在出发前再次核对。图片为注明来源的资料照片，不代表当天花况、展陈或路况。",
    "slug": "filoli-house-garden-day-trip",
    "title": "Filoli 不只是一张花园照：把老宅、花径和林间留成半天",
    "subtitle": "先订好日期与入场时段，再决定今天看花还是走远一点",
    "summary": "以 Woodside 的 Filoli 老宅与正式花园为主线，整理按日票价、停车包含、无台阶路线及野餐边界。",
    "emoji": "🌸",
    "audience": [
      "喜欢花园与建筑的人",
      "想轻松约会或带家人出游的人"
    ],
    "tags": [
      "半岛",
      "Woodside",
      "Filoli",
      "花园",
      "历史建筑"
    ],
    "sources": [
      {
        "title": "Filoli：日期、门票与开放时间",
        "url": "https://filoli.org/visit/opening-times/",
        "description": "选择实际日期与入场时间；普通票与夜间特别活动不同。"
      },
      {
        "title": "Filoli：交通与停车",
        "url": "https://filoli.org/visit/directions-parking/",
        "description": "停车包含在参观内，繁忙时可能使用溢出停车区。"
      },
      {
        "title": "Filoli：无障碍参观",
        "url": "https://filoli.org/visit/accessibility/",
        "description": "有无台阶地图，但砖石、草地与碎石仍影响通行。"
      },
      {
        "title": "Filoli：推车及访客常见问题",
        "url": "https://filoli.org/visit/faqs/visit-faqs/wagons-strollers/",
        "description": "核对入场窗口、食物、普通推车和拖车式推车的不同限制。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "来 Filoli，最容易犯的错误是只追着照片里的花走。花季会换，真正耐看的还有老宅的比例、树篱把空间分成一间间“房间”的方式，以及走出正式花园后突然安静下来的感觉。把半天留在一处，比拍完一张照就赶下一站更能看出这座庄园的层次。"
      },
      {
        "type": "heading",
        "text": "先选日期，再安排庄园门票"
      },
      {
        "type": "list",
        "items": [
          "建议预留 2.5–4 小时。普通门票包含 House、Garden、redwoods 与 trails，停车也包含；餐饮和特别活动另核。",
          "票价、最晚入场和延时开放按日期查看官方日历及售票页面；不要把某晚活动票当作普通日间票。",
          "官方建议所有访客及会员提前订票，按所选一小时窗口签到。周末与花季可能售罄，未订到就另选日期。"
        ]
      },
      {
        "type": "heading",
        "text": "把宅邸、花园与休息串起来"
      },
      {
        "type": "route",
        "title": "先近后远：让行程随体力展开",
        "text": "停留时长是编辑建议，不含往返交通；按现场开放和同行者体力调整。",
        "stops": [
          {
            "title": "开始 · 老宅与入口片区",
            "text": "从签到处拿地图，按开放安排看老宅；需要避开台阶，先请工作人员指出入屋坡道。不要为了跟别人相同机位占住门口。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Filoli%20Historic%20House%20Woodside"
          },
          {
            "title": "中段 · 正式花园",
            "text": "选一条花径慢走，观察花色、树篱与水景，不要求每个花坛都有盛花。坐下休息后，再决定要不要加林间段。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Filoli%20Garden%20Woodside"
          },
          {
            "title": "可选延伸 · 开放的红木与步道",
            "text": "只按当天地图进入开放路线，留足回到入口的时间。步道比庄园提前半小时关闭；体力有限就从花园结束，回原停车区或约好的接车点。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Filoli%20Woodside"
          }
        ]
      },
      {
        "type": "paragraph",
        "text": "导航用 86 Cañada Road, Woodside。开车按工作人员指引停车；网约车上下客在主停车片区，返程最好事先安排。无台阶路线并不意味着所有路面光滑，老庄园仍有砖、碎石与草地，也不提供轮椅或助行器借用。普通婴儿推车可以，wagon 与 stroller wagon 不允许。野餐留在入口附近指定桌区，正式花园与场地不能随意铺垫开餐。"
      },
      {
        "type": "heading",
        "text": "出门前核对车辆、推车与路面"
      },
      {
        "type": "checklist",
        "items": [
          "预订实际日期与时段，保存票据，检查最晚入场和离园时间。",
          "需要无障碍路线时下载专用地图，自备行动辅助设备。",
          "拍照只在开放步道上进行；商业或人像拍摄另查许可规则。"
        ]
      },
      {
        "type": "link",
        "title": "选日期查看 Filoli 票价与开放",
        "text": "打开官方页面，按实际出行日期核对后再订票或出发。",
        "url": "https://filoli.org/visit/opening-times/"
      },
      {
        "type": "cta",
        "title": "把实际体验留给下一位湾区邻居",
        "text": "欢迎分享当天的开放提醒、适合同行者的短路线和一张自己拍的照片；约同行时写明日期、集合点、交通与预计结束时间。",
        "primaryLabel": "发布出游分享或同行需求",
        "primaryAction": "post",
        "postType": "client",
        "postCategorySlug": "other"
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
    "updatedAt": "2026-09-09",
    "sourceNote": "官方资料核验于 2026 年 9 月 9 日。路线顺序与停留时长为 BAYLINK 编辑建议；票价、开放、预约和交通请在出发前再次核对。图片为注明来源的资料照片，不代表当天花况、展陈或路况。",
    "slug": "san-jose-tech-japantown-day-trip",
    "title": "San Jose 一天，两种节奏：The Tech 动手玩，再去 Japantown 散步",
    "subtitle": "把一个室内主项目与一个街区配在一起，别误当成相邻两扇门",
    "summary": "给 The Tech 留足实验和 IMAX 时间，再到 Jackson Street 看街区；说明票价、停车验证、换乘与感官资源。",
    "emoji": "🔬",
    "audience": [
      "喜欢动手体验的家庭",
      "南湾城市周末"
    ],
    "tags": [
      "南湾",
      "San Jose",
      "The Tech Interactive",
      "Japantown",
      "亲子"
    ],
    "sources": [
      {
        "title": "The Tech：门票与每日安排",
        "url": "https://www.thetech.org/visit/",
        "description": "普通票包含一部教育类 IMAX，开馆时间按季节与日期变化。"
      },
      {
        "title": "The Tech：到达与停车验证",
        "url": "https://www.thetech.org/visit/directions-parking/",
        "description": "核对两处参与车库与特别活动收费例外。"
      },
      {
        "title": "Japantown 商业协会：位置与交通",
        "url": "https://www.japantownsanjose.org/where-is-jtown",
        "description": "Jackson 与 North Fifth 是中心片区，轻轨站不在每家商店门口。"
      },
      {
        "title": "The Tech：感官参观资源",
        "url": "https://www.thetech.org/explore/sensory-resources/",
        "description": "用感官地图与社交故事提前了解声音、光线和互动环境。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "在 The Tech，最好把“今天要学会什么”换成“今天想动手试什么”。让孩子或同行朋友挑一个实验，多试一次，比把每个装置摸一下更有意思。离馆后再换到 Japantown：从实验室的声光回到 Jackson Street 的店面、街角与社区历史，这样的一天才有呼吸感。"
      },
      {
        "type": "heading",
        "text": "给科技馆留足时间和预算"
      },
      {
        "type": "list",
        "items": [
          "建议安排 5–6 小时，含餐饮与市区移动；只有半天时只选 The Tech 或 Japantown 其中一个。",
          "The Tech 成人普通票 $38；3–17 岁、学生及 65+ $28，包含一次教育类 IMAX。其他电影、活动与优惠按所选日期核对。",
          "开馆时间使用每日时刻表，先定电影场次再排实验。Japantown 公共街区散步免门票，店铺餐饮和博物馆各自收费、各自营业。"
        ]
      },
      {
        "type": "heading",
        "text": "先动手探索，再到 Japantown 散步"
      },
      {
        "type": "route",
        "title": "白天动手，后半程把脚步放慢",
        "text": "停留时长是编辑建议，不含往返交通；按现场开放和同行者体力调整。",
        "stops": [
          {
            "title": "第一站 · The Tech Interactive",
            "text": "导航到 201 S. Market Street。进馆先看当天可参加的体验与电影，把最感兴趣的一项放前面，给休息留空档。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=The%20Tech%20Interactive%20San%20Jose"
          },
          {
            "title": "中间连接 · 确认交通与吃饭",
            "text": "先离馆休息，再用实际导航选择开车或公共交通去 Japantown。不要因为两处都叫 downtown 就把带幼儿长距离步行设成默认。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Japantown%20Ayer%20Station%20San%20Jose"
          },
          {
            "title": "第二站 · Jackson 与 North Fifth",
            "text": "以街口为起终点，选一小段 Jackson Street 看店面和街区细节；想进历史馆就单独查开放与票价。走完回接车点或 Japantown/Ayer 站。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=North%20Fifth%20Street%20and%20Jackson%20Street%20San%20Jose"
          }
        ]
      },
      {
        "type": "paragraph",
        "text": "The Tech 的 $5 停车验证只适用于官网列出的 Convention Center 与 2nd and San Carlos 车库，要把停车票带进馆验证；市府收特别活动停车费时不适用。Japantown 是另一段停车安排，别假设同一张验证票通用。对噪声、暗场或拥挤敏感的同行者，先看馆方感官指南，选择可退出的体验；IMAX 不必成为人人必须完成的一关。"
      },
      {
        "type": "heading",
        "text": "回程前核验停车与街区营业"
      },
      {
        "type": "checklist",
        "items": [
          "核当天馆历、电影时间和票种，确认想玩的体验开放。",
          "开车认准可验证车库，离馆前处理验证；去 Japantown 另查停车。",
          "用 Jackson/North Fifth 约集合，先定两站之间与返程的交通。"
        ]
      },
      {
        "type": "link",
        "title": "查看 The Tech 今日安排",
        "text": "打开官方页面，按实际出行日期核对后再订票或出发。",
        "url": "https://www.thetech.org/visit/"
      },
      {
        "type": "cta",
        "title": "把实际体验留给下一位湾区邻居",
        "text": "欢迎分享当天的开放提醒、适合同行者的短路线和一张自己拍的照片；约同行时写明日期、集合点、交通与预计结束时间。",
        "primaryLabel": "发布出游分享或同行需求",
        "primaryAction": "post",
        "postType": "client",
        "postCategorySlug": "other"
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
    "updatedAt": "2026-09-09",
    "sourceNote": "官方资料核验于 2026 年 9 月 9 日。路线顺序与停留时长为 BAYLINK 编辑建议；票价、开放、预约和交通请在出发前再次核对。图片为注明来源的资料照片，不代表当天花况、展陈或路况。",
    "slug": "hakone-gardens-saratoga-half-day",
    "title": "Saratoga 山脚的安静下午：Hakone 的池桥、竹影与慢步",
    "subtitle": "这是一座需要慢走的山坡花园，不是平坦的城市公园",
    "summary": "安排 90 分钟至两小时的 Hakone 花园短程，讲清季节开放、居民免票变化、石阶与池塘整修信息。",
    "emoji": "🎋",
    "audience": [
      "喜欢日式庭园的人",
      "想安静约会或散步的人"
    ],
    "tags": [
      "南湾",
      "Saratoga",
      "Hakone Gardens",
      "日式庭园",
      "慢旅行"
    ],
    "sources": [
      {
        "title": "Hakone：访客信息与园区地图",
        "url": "https://www.hakone.com/visitor-info",
        "description": "核对年龄票价、季节时间、居民优惠及石阶路面。"
      },
      {
        "title": "Hakone：庭园地图入口",
        "url": "https://www.hakone.com/gardens",
        "description": "按正式园区地图选路，避免把山坡所有区域都视为无障碍。"
      },
      {
        "title": "Hakone：池塘整修项目",
        "url": "https://www.hakone.com/koi-pond-renovation",
        "description": "项目涉及池体与无障碍改善，不能据资料照片保证当前池况。"
      },
      {
        "title": "Hakone：当天公告",
        "url": "https://www.hakone.com/",
        "description": "特殊活动可能改变开放区域与入场时间。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "Hakone 的舒服，来自不需要走很远就能换一个角度：池边看桥，桥外看树，回头又看见屋檐。想认真逛，可以把手机暂时收起来，听一会儿风再拍照。这里位于 Saratoga 山坡，石阶和碎石是庭园的一部分；把它当作需要选路的历史花园，体验会比想象成平坦大公园更准确。"
      },
      {
        "type": "heading",
        "text": "按季节与身份核对入园条件"
      },
      {
        "type": "list",
        "items": [
          "建议 90–120 分钟，导航 21000 Big Basin Way。先查当天活动；预约导览、课程或特殊活动不能用普通门票代替。",
          "成人 18–64 岁 $15、65+ $12、5–17 岁 $10、4 岁及以下免费。首个周二的居民免票只限 Saratoga，须出示带当地地址的政府照片证件；不是整个 Santa Clara County。",
          "2026/3/9–10/31：工作日 10:00–17:00，16:30 最后入场；周末 11:00–17:00，16:00 最后入场。冬季较早关闭，特别活动另查。"
        ]
      },
      {
        "type": "heading",
        "text": "用池桥、竹影和短线认识庭园"
      },
      {
        "type": "route",
        "title": "不爬满山坡的庭园短线",
        "text": "停留时长是编辑建议，不含往返交通；按现场开放和同行者体力调整。",
        "stops": [
          {
            "title": "先看图 · 入口与可走路面",
            "text": "到入口先问当天关闭处与适合的短线。需要轮椅或推车通行，直接说明设备与同行者状况，不等走到台阶才折返。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Hakone%20Estate%20and%20Gardens%20Saratoga"
          },
          {
            "title": "主停留 · 池桥与庭园层次",
            "text": "沿开放路径选择池边或较平缓的观景点，观察树、石与建筑怎样组成画面。官网有池塘整修项目，实际水景和可进入范围需当天核对。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Hakone%20Gardens%20Saratoga"
          },
          {
            "title": "收尾 · 选一段竹影后回入口",
            "text": "只在开放区域加一小段，不追求走遍所有高低路径。回到入口整理照片，想吃东西用指定野餐区；再按原交通离开。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Hakone%20Estate%20and%20Gardens%20Saratoga"
          }
        ]
      },
      {
        "type": "paragraph",
        "text": "园方提供无障碍停车和卫生间，但历史地形并非全园无障碍；上山入口路也有急弯与坡度。开车先按园区指示停放，需要特殊车位就提前联系礼品店。拍照留在步道上，不坐桥栏或攀石；商业与正式人像拍摄另有许可。给同行者一个简单任务：各找一处喜欢的框景，最后交换照片，说说为什么停在那里。"
      },
      {
        "type": "heading",
        "text": "把整修与行动需要放进行前准备"
      },
      {
        "type": "checklist",
        "items": [
          "核季节时间与特别活动，居民优惠先核城市与证件。",
          "查看园图与池塘公告，按行动需要选择短线。",
          "穿防滑鞋，吃喝按指定区域，拍照不给通行添堵。"
        ]
      },
      {
        "type": "link",
        "title": "核对 Hakone 当期访客说明",
        "text": "打开官方页面，按实际出行日期核对后再订票或出发。",
        "url": "https://www.hakone.com/visitor-info"
      },
      {
        "type": "cta",
        "title": "把实际体验留给下一位湾区邻居",
        "text": "欢迎分享当天的开放提醒、适合同行者的短路线和一张自己拍的照片；约同行时写明日期、集合点、交通与预计结束时间。",
        "primaryLabel": "发布出游分享或同行需求",
        "primaryAction": "post",
        "postType": "client",
        "postCategorySlug": "other"
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
    "updatedAt": "2026-09-09",
    "sourceNote": "官方资料核验于 2026 年 9 月 9 日。路线顺序与停留时长为 BAYLINK 编辑建议；票价、开放、预约和交通请在出发前再次核对。图片为注明来源的资料照片，不代表当天花况、展陈或路况。",
    "slug": "muir-woods-reservation-day-trip",
    "title": "第一次去 Muir Woods：先订停车，再用短环线走进红木林",
    "subtitle": "门票与停车是两笔安排；选 Bridge 2 或 Bridge 3，不必一口气上山",
    "summary": "适合初访者的红木林短程，拆开停车/接驳与门票，说明无信号准备、主步道折返和推车路况。",
    "emoji": "🌲",
    "audience": [
      "第一次看海岸红木的人",
      "带长辈或孩子的家庭"
    ],
    "tags": [
      "北湾",
      "Muir Woods",
      "红木林",
      "预约",
      "轻徒步"
    ],
    "sources": [
      {
        "title": "NPS：Muir Woods 费用与通票",
        "url": "https://www.nps.gov/muwo/planyourvisit/fees.htm",
        "description": "16 岁及以上普通入园 $15，停车或接驳不包含在门票中。"
      },
      {
        "title": "官方授权：停车与接驳预约",
        "url": "https://gomuirwoods.com/",
        "description": "查询可订日期、标准车辆停车及接驳票，不在山谷临时找信号下单。"
      },
      {
        "title": "NPS：步道与短环线",
        "url": "https://www.nps.gov/muwo/planyourvisit/hike.htm",
        "description": "Bridge 2、3、4 距离不同，上山延伸路不等同主步道。"
      },
      {
        "title": "NPS：无障碍与无信号准备",
        "url": "https://www.nps.gov/muwo/planyourvisit/accessibility.htm",
        "description": "主步道部分路面有根系隆起和裂缝，先问当天条件。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "红木林最值得看的，是人站在树下突然变小的感觉。Muir Woods 不需要靠长距离徒步才能获得这种体验，入口附近的主步道已经穿过高大的海岸红木。第一次来，把精力放在“顺利到达、慢慢抬头、完整返回”这三件事上，比临时追一条看起来更厉害的山路更舒服。"
      },
      {
        "type": "heading",
        "text": "先处理门票之外的到达预约"
      },
      {
        "type": "list",
        "items": [
          "建议给园内留 1.5–2.5 小时，再另算弯曲山路或接驳时间。园区关闭随季节变化，先查当天公告。",
          "普通入园 16 岁及以上每人 $15，15 岁及以下免费。标准车辆停车预约 $10；接驳 16+ 往返 $4，儿童票免费但仍需预约。",
          "所有车辆与接驳乘客都须提前预约；门票或公园通票不代替停车/接驳名额。接驳按可运营日期、上车点和班次安排。"
        ]
      },
      {
        "type": "heading",
        "text": "用桥的编号选择红木短环线"
      },
      {
        "type": "route",
        "title": "把桥当折返点，而不是必须越走越远",
        "text": "停留时长是编辑建议，不含往返交通；按现场开放和同行者体力调整。",
        "stops": [
          {
            "title": "入园 · Visitor Center",
            "text": "出发前下载预约凭证、地图和返程信息；山谷及周边没有手机信号或 Wi-Fi。到达先问主步道开放与需要避开的路面。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Muir%20Woods%20Visitor%20Center"
          },
          {
            "title": "短版 · Bridge 2 环线",
            "text": "主步道到第二座桥的环线约 0.5 英里，官方估约半小时；加上看树与停留可慢慢走更久。按现场方向标识回入口。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Muir%20Woods%20National%20Monument"
          },
          {
            "title": "加长版 · Bridge 3 后返回",
            "text": "有余力可选约 1 英里的 Bridge 3 环线，官方估一小时。桥 2–3 西侧路面更不平；行动不便时先问 Ranger，不为凑环线走 Hillside Trail。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Muir%20Woods%20National%20Monument"
          }
        ]
      },
      {
        "type": "paragraph",
        "text": "回程比去程更需要提前安排：不要计划出林后才叫车。同行者先约定集合位置和时间，把司机、接驳上车点与离开方式写在离线笔记里。主步道有木栈道和铺装段，也可能有树根隆起，推车或轮椅并不是全程无感通过。停下来拍仰角时站到不挡路的位置，不翻栏、不离开指定步道；户外野餐不能默认安排在园内。"
      },
      {
        "type": "heading",
        "text": "进入无信号山谷前再检查一次"
      },
      {
        "type": "checklist",
        "items": [
          "停车或接驳已有确认，再核门票或通票资格。",
          "下载全部凭证与地图，出发前约定返程，带水和保暖层。",
          "按体力选 Bridge 2 或 3，先问步道状况与闭园时间。"
        ]
      },
      {
        "type": "link",
        "title": "预约 Muir Woods 停车或接驳",
        "text": "打开官方页面，按实际出行日期核对后再订票或出发。",
        "url": "https://gomuirwoods.com/"
      },
      {
        "type": "cta",
        "title": "把实际体验留给下一位湾区邻居",
        "text": "欢迎分享当天的开放提醒、适合同行者的短路线和一张自己拍的照片；约同行时写明日期、集合点、交通与预计结束时间。",
        "primaryLabel": "发布出游分享或同行需求",
        "primaryAction": "post",
        "postType": "client",
        "postCategorySlug": "other"
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
    "updatedAt": "2026-09-09",
    "sourceNote": "官方资料核验于 2026 年 9 月 9 日。路线顺序与停留时长为 BAYLINK 编辑建议；票价、开放、预约和交通请在出发前再次核对。图片为注明来源的资料照片，不代表当天花况、展陈或路况。",
    "slug": "sausalito-waterfront-ferry-half-day",
    "title": "坐船去 Sausalito 发半天呆：海滨、长椅和一段小镇散步",
    "subtitle": "把返程船先选好，今天只逛一座小镇",
    "summary": "从 San Francisco Ferry Building 出发的 Sausalito 无车半日，讲清船公司、单程票价、海滨短线与登船缓冲。",
    "emoji": "⛴️",
    "audience": [
      "不想开车的周末游客",
      "喜欢海湾景色的人"
    ],
    "tags": [
      "北湾",
      "Sausalito",
      "渡轮",
      "海滨散步",
      "无车"
    ],
    "sources": [
      {
        "title": "Golden Gate Ferry：现行时刻表",
        "url": "https://www.goldengate.org/ferry/schedules-maps/",
        "description": "分别选择工作日与周末班次，查服务警报。"
      },
      {
        "title": "Golden Gate Ferry：单程票价与支付",
        "url": "https://www.goldengate.org/ferry/ferry-fares-payment/",
        "description": "Clipper/非接触银行卡与纸票价格不同，每位乘客需自己的支付凭证。"
      },
      {
        "title": "Golden Gate Ferry：无障碍登船",
        "url": "https://www.goldengate.org/ferry/accessibility/",
        "description": "可向码头人员要求提前登船，需预留至少 20 分钟。"
      },
      {
        "title": "Sausalito 市府：Gabrielson Park",
        "url": "https://www.sausalito.gov/Home/Components/FacilityDirectory/FacilityDirectory/2/690",
        "description": "码头旁有草地、长椅与海湾视野，活动会影响现场使用。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "去 Sausalito 的船程，本身就可以算半个景点。离开市区后看天际线慢慢退远，到岸再找张长椅，把赶路模式关掉。这篇不同时塞进 Tiburon、Angel Island 或 Muir Woods：第一次就留在码头周边，把海边散步与一顿自己挑的午餐做得从容一点。"
      },
      {
        "type": "heading",
        "text": "从船公司、票价和返程班次开始"
      },
      {
        "type": "list",
        "items": [
          "建议小镇停留 2–3 小时，往返船程与候船另算。先选回程班次，再倒推午餐与散步时间。",
          "本文搭 Golden Gate Ferry，从 San Francisco Ferry Building 的渡轮码头出发；不要导航到另一船公司的 Pier 41。出发闸口按当天公告。",
          "Sausalito 单程成人 Clipper/非接触银行卡 $8.50，19–64 岁成人纸票 $14；5–18 岁及 65+ $7。4 岁及以下每名全票成人最多带两名免费儿童。每人需自己的票/支付方式。"
        ]
      },
      {
        "type": "heading",
        "text": "在一座海滨小镇把脚步放慢"
      },
      {
        "type": "route",
        "title": "以码头为起终点的海滨短线",
        "text": "停留时长是编辑建议，不含往返交通；按现场开放和同行者体力调整。",
        "stops": [
          {
            "title": "抵达 · Gabrielson Park",
            "text": "下船先确认返程排队位置，再到旁边公园坐一会儿。看 Angel Island 与湾面，给同行者留时间穿外套、喝水和整理东西。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Gabrielson%20Park%20Sausalito"
          },
          {
            "title": "散步 · Bridgeway 海滨",
            "text": "沿开放的人行路线走一段，挑喜欢的海景折返；餐厅与商店各有营业时间，别为攻略里的固定清单排长队。遇到窄路让行，不进入私人码头。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Bridgeway%20Sausalito"
          },
          {
            "title": "返回 · 码头附近休息",
            "text": "把最后一段休息留在码头附近，再按预留时间去排队。错过一班可能改变跨湾返程，别等店里结完账才第一次看时刻表。",
            "mapUrl": "https://www.google.com/maps/search/?api=1&query=Sausalito%20Ferry%20Terminal"
          }
        ]
      },
      {
        "type": "paragraph",
        "text": "海滨公共散步不收景点门票，但这趟不是“零预算”：船票、到 Ferry Building 的交通与餐饮要一起算。周末与工作日时刻表不同，保存截图之后也要留意当天服务警报。轮椅乘客可使用 Golden Gate Ferry；若需提前登船，至少早 20 分钟到并向工作人员说明。镇上的坡道、窄人行道和当天潮风仍需自己选路，走累就回码头公园，不勉强把山坡住宅区也爬一遍。"
      },
      {
        "type": "heading",
        "text": "登船前留下这些必要信息"
      },
      {
        "type": "checklist",
        "items": [
          "保存往返时刻表、运营方和实际出发码头，查当日服务警报。",
          "每位乘客准备自己的票或支付方式，优惠票核年龄与证件。",
          "带防风层，预留登船时间，只走开放公共海滨路线。"
        ]
      },
      {
        "type": "link",
        "title": "先选 Sausalito 往返船班",
        "text": "打开官方页面，按实际出行日期核对后再订票或出发。",
        "url": "https://www.goldengate.org/ferry/schedules-maps/"
      },
      {
        "type": "cta",
        "title": "把实际体验留给下一位湾区邻居",
        "text": "欢迎分享当天的开放提醒、适合同行者的短路线和一张自己拍的照片；约同行时写明日期、集合点、交通与预计结束时间。",
        "primaryLabel": "发布出游分享或同行需求",
        "primaryAction": "post",
        "postType": "client",
        "postCategorySlug": "other"
      }
    ]
  }
];
