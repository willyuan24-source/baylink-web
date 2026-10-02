import type { Guide } from './guides';

// Published visitor guidance; source boundaries are recorded in docs.
// Official pages checked 2026-10-02; research and limits are in visitor-research.md.
export const visitorPersonaGuides: Guide[] = [
  {
    "slug": "bay-area-visitor-coast-redwoods-return-plan-2026",
    "title": "游客的湾区远郊日：红木林、Point Reyes、半月湾怎么选，怎样确保返程",
    "subtitle": "先选交通与回程，再决定风景；一日只做一个方向",
    "summary": "把三处容易被塞进同一天的目的地拆成可执行选择：十月红木林接驳、Point Reyes 公交边界、半月湾 294 路与海滩停车，附预算、离线资料、行动便利需求和订不到时的替代步骤。",
    "category": "city",
    "categoryLabel": "游客远郊决策",
    "emoji": "🌲",
    "audience": [
      "住在旧金山的短期游客",
      "带亲友去红木林或海岸的人"
    ],
    "tags": [
      "远郊交通",
      "Muir Woods",
      "Point Reyes",
      "Half Moon Bay",
      "返程计划"
    ],
    "priority": "P0",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "other",
      "ride"
    ],
    "readMinutes": 12,
    "updatedAt": "2026-10-02",
    "sourceNote": "核验日期：2026 年 10 月 2 日。费用和规则依据列出的官方页面；取舍、缓冲时间、携带清单与失败备选为 BAYLINK 编辑建议。实时班次、余位、天气和设施状态须再次确认。",
    "sources": [
      {
        "title": "NPS：Muir Woods 交通",
        "url": "https://www.nps.gov/muwo/planyourvisit/directions.htm",
        "description": "无手机信号、停车预约及公共交通步行条件。"
      },
      {
        "title": "NPS：Muir Woods 门票",
        "url": "https://www.nps.gov/muwo/planyourvisit/fees.htm",
        "description": "入园费、年龄门槛及停车接驳费用分开计算。"
      },
      {
        "title": "GoMuirWoods：接驳安排",
        "url": "https://gomuirwoods.com/muir/shuttleInfo",
        "description": "十月运营日、往返预约、上车地点与无障碍预订。"
      },
      {
        "title": "NPS：Point Reyes 区内交通",
        "url": "https://www.nps.gov/pore/planyourvisit/gettingaround.htm",
        "description": "公共交通覆盖与园内交通、加油限制。"
      },
      {
        "title": "NPS：Point Reyes 费用",
        "url": "https://www.nps.gov/pore/planyourvisit/fees.htm",
        "description": "普通日间游览和停车免费，露营等另计。"
      },
      {
        "title": "NPS：Point Reyes 当前状况",
        "url": "https://www.nps.gov/pore/planyourvisit/conditions.htm",
        "description": "出发前核对道路与步道限制；动态警报需在网页查看。"
      },
      {
        "title": "SamTrans：294 路",
        "url": "https://www.samtrans.com/routes/294",
        "description": "Hillsdale–Half Moon Bay，分方向与工作日、周末的班表入口。"
      },
      {
        "title": "加州州立公园：Half Moon Bay State Beach",
        "url": "https://www.parks.ca.gov/?page_id=531",
        "description": "车辆日间费、关门时间、Francis Beach 设施及海岸注意事项。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "先把“想看红木”“想看荒野海岸”“想吃午饭后看海”分开。编辑建议：三处只选一个作当天主目的地，租车日也不要把北湾与半岛海岸排在一起。导航的一段车程不会包含取车、排队、步行、吃饭、补能和回程拥堵。"
      },
      {
        "type": "list",
        "items": [
          "无车、能提前订好往返：优先检查 Muir Woods 指定日接驳；若不合适，改成市区公园或已有攻略中的 Sausalito 海滨半日。",
          "有车、想看开阔海岸：Point Reyes 适合独立一天；把 Bear Valley 与一个已确认开放的目的地作为上限，是编辑建议。",
          "住半岛、偏轻松吃饭散步：Half Moon Bay 可先比较 294 路与自驾；把到海边的最后一段也算进去。"
        ]
      },
      {
        "type": "heading",
        "text": "出发前一天：先填交通空格"
      },
      {
        "type": "paragraph",
        "text": "向每位同行者确认能走多久、是否需要轮椅或推车，以及当天必须回到住处的时间。编辑建议把最晚回程设在可接受的天黑前或晚餐前，再倒推现场可停留多久；需要赶飞机时，保留城市内行程通常更容易控制。"
      },
      {
        "type": "checklist",
        "items": [
          "保存完整目的地名称、预约日期、人数、票种、接驳集合点和订单号；不要只存“红木公园”或“半月湾”的地图图钉。",
          "公交方案同时保存去程、返程和较早的备用班次；核对周六、周日与工作日，不能凭上一班车的间隔推算下一班。",
          "开车准备驾照、租车取车要求及停车付款方式；把加油、充电和收费道路单列，实际价格由运营商或结账页确认。"
        ]
      },
      {
        "type": "heading",
        "text": "Muir Woods：入园与抵达是两张账"
      },
      {
        "type": "paragraph",
        "text": "NPS 当前列普通入园费为每名 16 岁及以上游客 $15，未满 16 岁免入园费；停车或接驳预约另算。已有适用公园通票的人先核对覆盖人数并带所需照片证件，但通票不替你占停车位，也不代替接驳预约。"
      },
      {
        "type": "paragraph",
        "text": "授权预约网站的详细运营段写明：十月接驳在周六、周日运行，地点为 Larkspur Ferry Terminal，成人往返 $4，15 岁及以下乘车免费；去程和回程均须预约。页首较泛的周五至周日描述不应用来推算十月周五有车，具体日期以票历为准。"
      },
      {
        "type": "link",
        "title": "先查接驳日期与往返预约",
        "text": "使用官方预约入口选择日期、人数与往返安排；有轮椅或行动辅助器具时，按网站要求提前预约 ADA 接驳。没有实际订单就不把座位写进日程。",
        "url": "https://gomuirwoods.com/muir/shuttleInfo"
      },
      {
        "type": "tip",
        "title": "船、接驳、停车分别确认",
        "text": "从 SF 坐船到 Larkspur 不等于已订红木林接驳。官网要求提前 15 分钟到接驳点；渡轮票与到码头的步行、候车另外安排。自驾到 Larkspur 的停车也要单独查，别把接驳往返价当全天总价。"
      },
      {
        "type": "paragraph",
        "text": "把确认单、地图和返程信息离线保存。NPS 说明林区没有手机信号，游客中心 Wi-Fi 有限；编辑建议整段都按无法联网准备。不要把离园后临时叫网约车当唯一返程，同行者分开前约定具体集合地点。"
      },
      {
        "type": "tip",
        "title": "订不到时怎样改",
        "text": "先换日期或查看另一种抵达方式，不占无预约停车位。NPS 所列 61 路方案要下山约 1.3 英里、回程再爬上山，不适合作为轮椅、推车或低体力游客的临时替代。编辑建议直接换成城市内的短游。"
      },
      {
        "type": "heading",
        "text": "Point Reyes：公交到达不代表能逛完整座公园"
      },
      {
        "type": "paragraph",
        "text": "普通入园、游客中心及步道口停车和一般日间活动不收 NPS 费用，露营、特别活动等另算。省下门票不等于没有出游成本：编辑建议先算车辆或公交、燃料、食物和返程，再决定能否完成这一天。"
      },
      {
        "type": "paragraph",
        "text": "NPS 的区内交通说明显示，West Marin Stagecoach 可从 San Rafael 联系到 Bear Valley 一带，但向西不超过 Inverness，园内没有可带你逐个游览景点的公共交通。无车且想看灯塔、Tomales Point 或远端海滩的人，应先落实全程交通，不能到游客中心再临时补。"
      },
      {
        "type": "tip",
        "title": "有车先补能，避免远端折返",
        "text": "NPS 提醒园内没有加油或汽车服务站。编辑建议离开城镇前补足燃料或电量、带饮水与当日午餐；电动车另核对可用充电点，不把地图上的充电标记当成实时可用。"
      },
      {
        "type": "link",
        "title": "出发前看 Point Reyes 道路与步道状况",
        "text": "先打开当期警报，再选实际目的地；网页空白或动态内容没有显示时，不把它理解为全园无关闭。也可联系游客中心确认目标路段。",
        "url": "https://www.nps.gov/pore/planyourvisit/conditions.htm"
      },
      {
        "type": "heading",
        "text": "Half Moon Bay：查清到的是市区还是海滩入口"
      },
      {
        "type": "paragraph",
        "text": "SamTrans 294 路官方页面列 Hillsdale–Half Moon Bay，并分别提供东行、西行及工作日、周六、周日班表。先找住宿到起点的接驳，再核对海岸端下车站与 95 Kelly Avenue 的距离；不要把 Hillsdale 商场一带与 Caltrain 站当成同一个地点。"
      },
      {
        "type": "paragraph",
        "text": "Half Moon Bay State Beach 当前列车辆日间使用费 $10，同时注明旺季、节日或周末可能有不同价格；园区时间为 08:00 至日落。Francis Beach 位于 95 Kelly Avenue，官网列有卫生间与野餐设施。入口收费与露营预约是不同安排，当天按入口公告付款。"
      },
      {
        "type": "tip",
        "title": "想轻松看海，停留在容易折返的范围",
        "text": "州立公园提醒海水冷且有离岸流。编辑建议把这一站安排成岸上散步，风浪大就缩短；需要沙滩轮椅可先询问 Francis Beach 入口站，官方列免费借用，但不保证到场有车。"
      },
      {
        "type": "link",
        "title": "逐方向查看 294 路班表",
        "text": "选择实际出游日类型，保存海岸返程站和目标班次；若衔接太少，改自驾、提前确认的往返接送，或城市内行程。",
        "url": "https://www.samtrans.com/routes/294"
      },
      {
        "type": "list",
        "items": [
          "红木林日：预约抵达 → 林内短走 → 按已订回程离开；可选延伸只放在回到交通枢纽以后。",
          "Point Reyes 日：Bear Valley 确认状况 → 一个可达目标 → 原路返程；远端关闭就保留近端，不追逐下一处照片点。",
          "半月湾日：先解决午餐 → Francis Beach 短走 → 提前回到返程点；等车时间不能挤占机场或晚餐的固定预约。"
        ]
      },
      {
        "type": "checklist",
        "items": [
          "带当天需要的票、通票与证件、离线地图、充电宝、防风层、饮水和垃圾袋；贵重物品随身。",
          "同行者共享集合点、必须开始返程的时间、联系不上时的等候位置和交通预算上限。",
          "出发前再查预约确认邮件、运营商班表、目标路段与天气；任一关键回程环节没有落实就缩短行程。"
        ]
      },
      {
        "type": "template",
        "title": "可复制的远郊确认单",
        "text": "日期：____；当天只选：____；去程集合点／时间：____；预约号：____；最晚折返时间：____；返程站／车次：____；备用交通及费用上限：____；离线资料保存于：____；同行者行动需求：____；关闭或无票时改去：____。"
      },
      {
        "type": "paragraph",
        "text": "最后把预算按“入园、停车或接驳、跨湾交通、餐饮、额外接送”五栏相加。此文给出的官方单项价格不包含全部行程，也不代表当天仍有票；两个人分摊租车是否划算，应与完整公交往返和个人体力一起比较。"
      }
    ]
  },
  {
    "slug": "sf-visitor-luggage-restrooms-lost-property-2026",
    "title": "退房后还能怎么玩：旧金山游客的行李、卫生间、无障碍与失物处理",
    "subtitle": "把当天最容易卡住的琐事提前处理，出了问题找对机构",
    "summary": "从酒店寄存询问、SFO 正规存包与找厕所，到 Muni、BART、机场失物的不同入口；附失窃报案边界、行动便利核对清单与可复制说明，方便短期游客和接待亲友的人保存。",
    "category": "city",
    "categoryLabel": "游客现场问题",
    "emoji": "🧳",
    "audience": [
      "退房后还有半天的旅客",
      "带长辈、儿童或行动辅助器具出行的人",
      "在湾区遗失物品的游客"
    ],
    "tags": [
      "行李寄存",
      "公共卫生间",
      "失物招领",
      "无障碍出行",
      "游客求助"
    ],
    "priority": "P0",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "other",
      "ride"
    ],
    "readMinutes": 13,
    "updatedAt": "2026-10-02",
    "sourceNote": "核验日期：2026 年 10 月 2 日。费用和规则依据列出的官方页面；取舍、缓冲时间、携带清单与失败备选为 BAYLINK 编辑建议。实时班次、余位、天气和设施状态须再次确认。",
    "sources": [
      {
        "title": "SFO：常见问题与行李寄存",
        "url": "https://www.flysfo.com/faqs",
        "description": "国际航站楼寄存位置、开放时间与按 24 小时计费方式。"
      },
      {
        "title": "SF Public Works：Pit Stop 公厕",
        "url": "https://sfpublicworks.org/pitstop",
        "description": "官方地点、营业时间及有人值守的设施说明。"
      },
      {
        "title": "SFMTA：Muni 失物招领",
        "url": "https://www.sfmta.com/getting-around/muni/muni-lost-found",
        "description": "四小时内重要物品先联系 311，线上登记与通知后领取。"
      },
      {
        "title": "BART：失物招领",
        "url": "https://www.bart.gov/guide/lostandfound",
        "description": "独立表格、Oakland 领取地点及避免重复报失。"
      },
      {
        "title": "SFO：按地点找失物部门",
        "url": "https://www.flysfo.com/services-amenities/lost-and-found",
        "description": "飞机、公共区域、安检处由不同单位处理。"
      },
      {
        "title": "SFPD：报警与报案",
        "url": "https://www.sanfranciscopolice.org/get-service/police-reports",
        "description": "紧急与非紧急分流，线上报案适用范围及外国护照例外。"
      },
      {
        "title": "SFMTA：Muni Metro 无障碍说明",
        "url": "https://www.sfmta.com/getting-around/accessibility/muni-accessibility/muni-access-guide/access-muni-metro",
        "description": "地下站电梯、地面无障碍上车点与路线核对入口。"
      },
      {
        "title": "SFMTA：缆车乘车说明",
        "url": "https://www.sfmta.com/getting-around/muni/cable-cars",
        "description": "历史缆车不具备无障碍上车设施，需另选交通。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "先画出今天的三个固定点：退房地点、行李领取地点、最终出发地点。编辑建议最后一天只在这条链附近安排一个活动；不把寄存、跨城游览和赶飞机叠成连续紧急任务。临时更改一个环节时，先重算取包与返程。"
      },
      {
        "type": "heading",
        "text": "退房前：先拿到寄存确认"
      },
      {
        "type": "checklist",
        "items": [
          "先问住宿处是否接受退房后寄存、最晚取件、按件还是按时收费、贵重品限制，以及取件是否需要房号或寄存凭条。酒店服务由各家决定。",
          "拍下行李外观和寄存凭条，保留柜台位置；把当天用的证件、药品、充电宝和交通支付工具放进随身小包。",
          "若酒店不收，先比较经其确认的寄存服务与提前去机场；核对真实营业地址、营业时间、超时和取件规则后再付款。"
        ]
      },
      {
        "type": "paragraph",
        "text": "SFO 官方 FAQ 确认机场行李寄存由 Airport Travel Agency 提供，位于国际航站楼出发／票务层、G1–G14 入口附近，每天 06:00–23:00；不要求预约，行李寄存前要经过 X 光检查。这里在机场，不是市中心的寄存网点。"
      },
      {
        "type": "paragraph",
        "text": "机场寄存按每件物品每 24 小时计费，不足 24 小时也按该档计，价格随尺寸而变，官网 FAQ 没给统一金额。编辑建议出发前询问尺寸报价和取件要求；只想逛市中心两小时的人，要把往返机场的时间与费用一并算入。"
      },
      {
        "type": "link",
        "title": "查看 SFO 当前寄存与航站楼服务",
        "text": "从官方 FAQ 进入 Airport Travel Agency 的联系页，核对当天时段、尺寸价格和特殊物品要求；不把现场免预约理解为保证无限容量。",
        "url": "https://www.flysfo.com/faqs"
      },
      {
        "type": "tip",
        "title": "寄存没有落实时，缩小当天路线",
        "text": "编辑建议改为先办理可用寄存、在附近用餐或直接去机场。不要默认每个景点、码头或餐厅都能收旅行箱；车辆后备箱也不能替代你已核实的寄存安排。"
      },
      {
        "type": "heading",
        "text": "找卫生间：保存两个点和各自时段"
      },
      {
        "type": "paragraph",
        "text": "SF Public Works 的 Pit Stop 页面列有人值守的公共厕所与各点时间。例如 Embarcadero Plaza 列每日 09:00–17:00，Grove/Larkin 列 07:00–19:00，Market/Castro 列 08:00–20:00；这些是不同地点的开放表，不是全市统一 24 小时服务。"
      },
      {
        "type": "list",
        "items": [
          "出门前在官方地点表找沿线的主选和备选，记录交叉路口而非只记街区；带孩子的人可在开始长段散步前先去。",
          "到场关闭、排队太久或设施不适用时，去备选点，或询问当前参观场馆的服务台；不要假设商业店铺必须提供免费厕所。",
          "需要轮椅转身空间、陪护者同行或婴儿换尿布台时，提前问具体设施；“有厕所”不能替代对这些需求的确认。"
        ]
      },
      {
        "type": "link",
        "title": "保存 Pit Stop 地点与营业时间",
        "text": "查看你实际路线上的路口和日期时段；设施临时停用时可向 311 查询，不靠旧地图截图判断一定开放。",
        "url": "https://sfpublicworks.org/pitstop"
      },
      {
        "type": "heading",
        "text": "无障碍：逐段确认从街面到目的地"
      },
      {
        "type": "paragraph",
        "text": "SFMTA 说明 Muni Metro 地下站通过电梯提供无障碍通道，但“该站有电梯”不等于今天的每部电梯都能用。编辑建议出发前核对起点、换乘点和终点的电梯状态，必要时请站务员或 311 协助找地面替代。"
      },
      {
        "type": "paragraph",
        "text": "地面轻轨要看具体无障碍上车站点；历史缆车则没有无障碍上车设施。要坐轮椅或无法踏上高台阶的同行者，应先选可用公交或其他交通，再决定景点；不要把“都是 Muni”理解成车辆和站台条件相同。"
      },
      {
        "type": "checklist",
        "items": [
          "告诉运营方轮椅或辅助器具的类型、是否能离开座椅、同行人数；按其要求补充尺寸与重量，不仅询问“方便吗”。",
          "向目的地确认无台阶入口、服务台、可用厕所和休息点；从车站到门口的坡度与路面也要算进去。",
          "关键电梯停用时，取消该段或改地面路线；由本人判断舒适度，不临时要求同行者搬抬轮椅上下楼。"
        ]
      },
      {
        "type": "link",
        "title": "按站点查 Muni Metro 上下车条件",
        "text": "从 SFMTA 无障碍指南确认地下和地面上车方式，再检查实时设施；这是路线核对入口，不是当日电梯可用保证。",
        "url": "https://www.sfmta.com/getting-around/accessibility/muni-accessibility/muni-access-guide/access-muni-metro"
      },
      {
        "type": "heading",
        "text": "东西不见了：先按最后出现地点分流"
      },
      {
        "type": "paragraph",
        "text": "先回想最后一次确定看到物品的时间、地点、车厢或座位，记录物品品牌、颜色、独特特征和可联系邮箱。编辑建议一人联系机构，另一人整理行程凭据；不要把手机密码或完整证件号码公开发到群里。"
      },
      {
        "type": "paragraph",
        "text": "Muni 官方要求：若钱包、手机、证件、药品等重要物品可能在最近四小时内遗留车上，立即联系 311，市外可拨 415-701-2311；其他情况走官方线上登记。不要直接跑服务中心询问，按找到物品后的通知领取。"
      },
      {
        "type": "paragraph",
        "text": "BART 有独立的失物表格，不能用 Muni 登记代替。官网提醒同一物品不要重复报失；领取办公室在 12th St/Oakland City Center 站，开放时间可能随人员安排变化，前往前拨 510-464-7090 核对。离开湾区前没收到回复，不等于机构已承诺找到。"
      },
      {
        "type": "list",
        "items": [
          "SFO 飞机内遗失：联系航空公司；不要先填机场公共区域的表格。",
          "SFO 航站楼、停车库或 AirTrain：官方列机场警察失物部门，电话 650-821-7014，邮箱 sfolostandfound@flysfo.com。",
          "SFO 安检处：按机场页面转 Covenant Aviation Security，电话 650-457-2670；不要把它与航空公司的行李延误索赔混在一起。"
        ]
      },
      {
        "type": "template",
        "title": "发给失物部门的描述模板",
        "text": "我在［当地日期／时间］乘坐［机构／线路／方向］，从［上车点］到［下车点］，可能把［品牌、颜色、型号、独特标记］留在［座位／车厢／区域］。我最后确认物品在手的地点是［地点］。现有查询编号：［编号］；可联系邮箱／电话：［联系方式］；离开湾区日期：［日期］。请告知后续核对与领取步骤。"
      },
      {
        "type": "heading",
        "text": "失窃或证件丢失：不要把报失当报案"
      },
      {
        "type": "paragraph",
        "text": "有人身危险、武器或犯罪正在发生时拨 911；已结束的 SF 非紧急案件可拨 SFPD 415-553-0123。警方官网列出线上可报的类型，并明确外国护照丢失或被盗不走该线上流程，应到警局处理；之后再联系证件签发国的官方领事机构。"
      },
      {
        "type": "checklist",
        "items": [
          "记录发生地、当地时间、物品清单、可证明的价值及已有照片；把“亲眼看到”与“推测”分开说明。",
          "向租车公司、住宿处或保险方询问所需报案编号和材料；保留原始收据，不自行保证一定理赔或可以立即补证。",
          "警方案件按事发辖区处理；在 Oakland、San José 或其他城市发生的事，不因你住 SF 就提交成 SF 案件。"
        ]
      },
      {
        "type": "link",
        "title": "核对 SFPD 线上、电话与现场报案入口",
        "text": "先阅读适用范围；网页提供中文入口及语言协助说明。提交前确认事发地点和事件类型，保存确认信息与后续编号。",
        "url": "https://www.sanfranciscopolice.org/get-service/police-reports"
      },
      {
        "type": "tip",
        "title": "返程受影响时，先处理必须的证件与联系",
        "text": "编辑建议暂停加景点：先联系航空公司和相应证件机构，确认能否按原计划出行，再改住宿或交通。失物招领、警方报案、证件补办和保险是不同流程，任何一个回执都不自动替代另一个。"
      }
    ]
  },
  {
    "slug": "sf-visitor-meals-markets-dietary-booking-2026",
    "title": "在旧金山吃得顺：游客的订位、饮食需求、买菜与账单指南",
    "subtitle": "按当天街区选一顿主餐，先问清能不能吃、几点能吃和最后付多少",
    "summary": "不靠网红排名安排三餐：区分 Ferry Building 与户外市集时段，选择日本城或 Mission 的半日用餐路线，准备过敏沟通、餐厅订位与杂货清单，再看懂税、服务费和自愿小费。",
    "category": "city",
    "categoryLabel": "游客餐饮与街区",
    "emoji": "🍽️",
    "audience": [
      "第一次在美国餐厅点餐的游客",
      "有明确饮食需求的同行家庭",
      "住带厨房住宿的短期旅客"
    ],
    "tags": [
      "餐厅订位",
      "餐饮预算",
      "饮食需求",
      "Ferry Building",
      "Japantown",
      "市集买菜"
    ],
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "other"
    ],
    "readMinutes": 12,
    "updatedAt": "2026-10-02",
    "sourceNote": "核验日期：2026 年 10 月 2 日。费用和规则依据列出的官方页面；取舍、缓冲时间、携带清单与失败备选为 BAYLINK 编辑建议。实时班次、余位、天气和设施状态须再次确认。",
    "sources": [
      {
        "title": "Ferry Building：参观与商户时间",
        "url": "https://www.ferrybuildingmarketplace.com/visit/",
        "description": "建筑与商店时间不同，现场座位和不提供储物柜的说明。"
      },
      {
        "title": "Foodwise：Ferry Plaza 市集访客信息",
        "url": "https://foodwise.org/markets/ferry-plaza-farmers-market/visitor-info/",
        "description": "周二、周四、周六时段、支付方式与卫生间。"
      },
      {
        "title": "Foodwise：各市集时间",
        "url": "https://foodwise.org/markets/",
        "description": "Mission Community Market 的季节、星期与地点。"
      },
      {
        "title": "Japantown 社区机构：Japan Center Malls",
        "url": "https://www.sfjapantown.org/japan-center-malls/",
        "description": "商场地址与公共开放时间，商户分别营业。"
      },
      {
        "title": "FDA：食物过敏与标签",
        "url": "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies",
        "description": "九大过敏原、包装食品标签与交叉接触的区别。"
      },
      {
        "title": "加州司法部：费用披露说明",
        "url": "https://oag.ca.gov/hiddenfees",
        "description": "餐饮强制费用的披露例外与自愿小费区分。"
      },
      {
        "title": "加州劳工专员：小费与服务费问答",
        "url": "https://www.dir.ca.gov/dlse/FAQ_TipsAndGratuities.html",
        "description": "自愿小费定义，以及服务费是否属于小费需按具体情况判断。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "编辑建议一天只设一顿需要准时到场的主餐，把另外两顿安排在住宿或当天活动附近。先写每人的含税费预算、能吃的食材、最长等位时间与最晚回程，再筛选店；不用为了凑三个街区，把吃饭变成连续赶路。"
      },
      {
        "type": "list",
        "items": [
          "早餐：确认住宿是否包含、开餐时间与你当天出门是否匹配；没有早餐时先查附近商户当天菜单与营业日。",
          "午餐：选活动附近的一顿坐下休息，或能核对配料的简单餐食；把找厕所和补水一起安排。",
          "晚餐：需要固定座位、较大人数或特殊饮食时先联系餐厅；交通延误概率高的远郊日不要紧接不可退的预约。"
        ]
      },
      {
        "type": "heading",
        "text": "订位前：看餐厅自己的入口与取消条件"
      },
      {
        "type": "checklist",
        "items": [
          "从餐厅官网进入预约平台，核对分店地址、当地日期、人数与座位类型；吧台、室外与普通餐桌不一定可互换。",
          "看清订金、预付套餐、最低消费、迟到保留时间、取消时限与未到店收费；不要把留信用卡都当成已经付过餐费。",
          "把婴儿也计入需要的座位说明，提出儿童椅、轮椅入口、楼层或安静位置需求；收到餐厅确认后再安排，不把备注栏当作保证。"
        ]
      },
      {
        "type": "paragraph",
        "text": "订不到时，编辑建议先换同店较早或较晚的时段，再问是否接受当天候位或外带。餐厅不能确认时，在同一街区另备一家已查看菜单的店；不要让全家饿着在门口等一个没有承诺的座位。"
      },
      {
        "type": "template",
        "title": "可复制给餐厅的订位询问",
        "text": "您好，我们希望在［当地日期／时间］用餐，共［成人／儿童／婴儿人数］，每人预算约［金额，含税费］。有［具体饮食限制］及［轮椅入口／儿童椅需求］。请问可安排的菜单与座位、总费用、是否需订金、取消时限和迟到规则？请确认这家店的完整地址。"
      },
      {
        "type": "heading",
        "text": "饮食需求：讲清成分，也问制作过程"
      },
      {
        "type": "paragraph",
        "text": "FDA 列出的美国九大主要过敏原是奶、蛋、鱼、甲壳类、树坚果、花生、小麦、大豆和芝麻；这并不涵盖所有人的过敏。请用自己的具体食材名称沟通，不仅说“海鲜过敏”或“不能吃坚果”。这是点餐准备，不是诊断建议。"
      },
      {
        "type": "list",
        "items": [
          "先区分食物过敏、乳糜泻相关要求、宗教饮食与口味偏好，向工作人员准确说明自己的情况和不可接受的成分。",
          "除了主料，还问汤底、酱汁、腌料及共用煎台、炸锅、夹具；“可以拿掉配料”不等于制作过程符合你的需求。",
          "服务员不确定时，请其向厨房核实；厨房无法确认就换明确可核对的选择，不用网评或一个菜名替自己判断安全。"
        ]
      },
      {
        "type": "tip",
        "title": "素食或不辣，不等于满足其他饮食要求",
        "text": "编辑建议逐项问：是否含肉汤、鱼类调味、奶蛋、酒精或你要避开的成分。需要 halal、kosher 等标准时向店家确认适用范围与证明；本指南不把某个街区、菜系或商户自动标为符合。"
      },
      {
        "type": "template",
        "title": "简短的过敏沟通卡",
        "text": "我对［具体食材英文名称］过敏，不是口味偏好。请向厨房确认这道菜的主料、酱汁、汤底，以及是否会接触共用设备。若无法确认，请直接告诉我，我会选择其他食物。／I am allergic to [ingredient]. This is not a preference. Please check the ingredients, sauces, stock and shared equipment with the kitchen. If you cannot confirm, please tell me."
      },
      {
        "type": "paragraph",
        "text": "购买包装食品时，逐次读配料表和 Contains 声明，不凭包装颜色或以前买过同名产品判断。FDA 的预包装标签规则不能直接替代现场餐厅沟通；有既定过敏应急计划的人按医疗团队给出的个人计划准备，旅途中不要临时试探不确定的食物。"
      },
      {
        "type": "heading",
        "text": "三种街区用餐路线：按日期选一条"
      },
      {
        "type": "paragraph",
        "text": "海滨市集版适合周六上午，或周二、周四午餐前后。Foodwise 官方列 Ferry Plaza 周六 08:00–14:00，周二与周四 10:00–14:00；Ferry Building 建筑通常每日 06:00–22:00，但店铺各自营业，建筑开门不能当作早餐或晚餐供应保证。"
      },
      {
        "type": "route",
        "title": "编辑路线 A：Ferry Building 吃一顿，再走一小段海滨",
        "text": "这是一条可随时缩短的用餐路线，不要求把每个摊位吃一遍。",
        "stops": [
          {
            "title": "到场先看菜单与休息点",
            "text": "先确认今天有没有户外市集，再找洗手间与可用座位；Foodwise 列建筑内南北通道有无障碍公共厕所。"
          },
          {
            "title": "买少量即食，或坐下吃主餐",
            "text": "先问分量和价格，不把市集等同低价超市；买需要冷藏的东西前先决定何时回住处。"
          },
          {
            "title": "按天气短走后返程",
            "text": "风大就留在建筑内已营业区域，或直接返程；Ferry Building 不提供储物柜，购物量要以自己能带走为限。"
          }
        ]
      },
      {
        "type": "link",
        "title": "查看 Ferry Plaza 当天市集与访客设施",
        "text": "出发前确认市集时段、商户与支付方式；官网说多数摊位接受卡或非接触支付，不代表每个摊位都接受同一种方式。",
        "url": "https://foodwise.org/markets/ferry-plaza-farmers-market/visitor-info/"
      },
      {
        "type": "paragraph",
        "text": "室内选项可放在日本城 Japan Center 一带。社区官方页列商场地址 1737 Post Street、公共时间 08:30–22:00，同时明确每家店各自营业。编辑建议先选一间能满足全组饮食需求的主餐，再逛一两家店；不要按商场关门时间推断厨房仍接单。"
      },
      {
        "type": "paragraph",
        "text": "周四下午已在 Mission 的游客，可把 Mission Community Market 放在顺路位置。Foodwise 当前列三月至十一月、周四 15:00–19:00，Bartlett 与 22nd Streets。编辑建议小量买菜后在同一街区吃晚餐；其他日期使用普通商户备选，不把市集当每日都有。"
      },
      {
        "type": "link",
        "title": "用官方目录核对日本城商户",
        "text": "由商场页进入商户信息，再确认实际店铺的菜单、休息日和预约入口；目录列名不是本站口味排名或过敏安全认证。",
        "url": "https://www.sfjapantown.org/japan-center-malls/"
      },
      {
        "type": "heading",
        "text": "短住买菜：按住宿设备决定购物量"
      },
      {
        "type": "checklist",
        "items": [
          "先问住宿是否有可用冰箱、餐具、饮水和可用厨房；“房间有吧台”或“有咖啡机”不等于能做饭。",
          "无厨房时优先买当天可吃完的食物；要冷藏的东西只在能妥善运输和存放时购买，别带着逛一整天。",
          "带购物袋，按人数与剩余晚数买；先看按磅、按件还是按盒标价，比较同一单位后再决定。",
          "返程要带食品时，另查目的地入境与航空行李规则；现场买得到，不代表能带入另一个国家。"
        ]
      },
      {
        "type": "tip",
        "title": "买菜失败时，也保留一顿简单饭",
        "text": "编辑建议预留一间住宿附近、已核对营业的普通餐饮点，不把农夫市集当唯一补给来源。若当日下雨、某摊位缺席或配料无法确认，就使用备选，不再跨城追同一种食物。"
      },
      {
        "type": "heading",
        "text": "结账：看清菜单价、税、强制费用和自愿小费"
      },
      {
        "type": "paragraph",
        "text": "加州司法部当前说明：餐厅、酒吧及部分餐饮商户在显著披露的条件下，可以把某些强制费用另列；不能据一般“隐藏费用法”直接认定菜单标价就是最终实付。点餐前读菜单脚注，并问清服务费、套餐附加费和税是否已含。"
      },
      {
        "type": "paragraph",
        "text": "小费是自愿加给员工的款项；服务费是否属于小费不能一概而论，加州劳工专员的 FAQ 说明需看具体情形。账单已有 service charge 或 gratuity 时，先请店家解释是否已含小费，再决定是否额外给，不因为刷卡机出现建议百分比就以为必须再付一次。"
      },
      {
        "type": "tip",
        "title": "用一张账单核对表控制预算",
        "text": "编辑示例：菜单项目合计 $40，若事先披露服务费 5%，该项就是 $2；再核对账单实际税额、已含的小费与自己选择的额外小费。这个数字只是算术示例，不是 SF 统一费率或某家餐厅报价。"
      },
      {
        "type": "checklist",
        "items": [
          "确认人数、菜品、数量与取消的项目是否正确，折扣是否适用于本次消费。",
          "有疑问先请工作人员解释，保留明细收据与预订条件；不要拍到其他顾客的支付信息。",
          "在同一份日预算里加入外卖配送、饮品、交通和购物；餐厅预约成功不代表其中任何一项免费。"
        ]
      },
      {
        "type": "template",
        "title": "当天用餐计划，一页就够",
        "text": "今天所在街区：____；主餐商户与地址：____；实际营业／厨房截止：____；预约确认号：____；全组饮食需求已确认：____；每人总预算：____；取消期限：____；可接受等位：____；同区备选：____；买菜后回住处时间：____。"
      }
    ]
  }
];
