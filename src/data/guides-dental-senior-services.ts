import type { Guide } from './guides';

/** Reviewed referral routes; individual eligibility and clinical decisions stay with providers. */
export const dentalSeniorServiceGuides: Guide[] = [
  {
    "slug": "bay-area-dental-care-insurance-low-cost-guide",
    "title": "湾区看牙与牙科费用：保险网络、Medi-Cal Dental 和低费入口",
    "subtitle": "先核对牙科保障，再向诊所确认新病人、语言与书面报价",
    "summary": "从官方牙医目录、NEMS 费用减免和 UCSF 学生诊所开始，分清牙科与一般医保；附预约前的问题、材料与福利变动核对路径。",
    "category": "service",
    "categoryLabel": "牙科就医",
    "emoji": "🦷",
    "audience": [
      "需要找牙医的人",
      "牙科保险不足或没有牙科保险的人",
      "帮助家人预约牙科的居民"
    ],
    "tags": [
      "牙医",
      "牙科",
      "牙齿",
      "看牙",
      "dentist",
      "dental care",
      "Medi-Cal Dental",
      "Denti-Cal",
      "低费牙科"
    ],
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "service",
      "newcomer"
    ],
    "readMinutes": 5,
    "updatedAt": "2026-10-06",
    "sourceNote": "2026-10-06 编辑并读取 Medicare、DHCS 牙科变动及机构服务说明。DHCS 牙医目录原站直接读取未成功，本次仅取得可检索说明。本文提供预约与咨询路径，不诊断牙病、不判断个人保险资格，也不保证费用、中文服务或即时名额；预约时以机构确认及个人保障为准。",
    "sources": [
      {
        "title": "Medicare.gov：牙科保障",
        "url": "https://www.medicare.gov/coverage/dental-services",
        "description": "一般牙科与特定医疗治疗关联的例外须分开核对。"
      },
      {
        "title": "DHCS：Medi-Cal 牙医目录",
        "url": "https://www.dental.dhcs.ca.gov/Members/Medi-Cal_Dental/Find_A_Dentist/",
        "description": "按地区寻找牙医；无法找到接收新病人的机构时可拨打 1-800-322-6384。本次直接读取未成功。"
      },
      {
        "title": "DHCS：牙科福利变动与延期说明",
        "url": "https://www.dhcs.ca.gov/services/medi-cal-dental-benefit-changes/",
        "description": "官方专门更新页说明部分成人牙科变动延至 2027 年 7 月 1 日，并提供中文通知。"
      },
      {
        "title": "DHCS：牙科福利变动 FAQ",
        "url": "https://www.dhcs.ca.gov/services/medi-cal-dental-benefit-changes/medi-cal-dental-benefit-changes-frequently-asked-questions/",
        "description": "申请时间、覆盖范围与例外各有规则；个人情况应由县或牙科服务中心核对。"
      },
      {
        "title": "NEMS：牙科服务",
        "url": "https://www.nems.org/services/dental/",
        "description": "机构列出成人及儿童的牙科检查、预防与治疗服务。"
      },
      {
        "title": "NEMS：费用、保险与按收入减费",
        "url": "https://www.nems.org/resources/paying-for-your-care/",
        "description": "并非免费诊所；费用减免按家庭人数、收入及材料核对，并需每年重新登记。"
      },
      {
        "title": "UCSF：Parnassus 学生综合牙科诊所",
        "url": "https://dentistry.ucsf.edu/dental-center/clinics/student-general-dentistry-clinic-parnassus",
        "description": "确认新病人预约、当前保险参与和 Denti-Cal 接收情况；不同诊所不能混用规则。"
      },
      {
        "title": "UCSF：牙科中心常见问题",
        "url": "https://dentistry.ucsf.edu/dental-center/faq",
        "description": "学生诊所与教职牙医费用不同，学生治疗可能需要更长时间和多次预约。"
      }
    ],
    "blocks": [
      {
        "type": "heading",
        "text": "第一步：把牙科保险与一般医保分开"
      },
      {
        "type": "paragraph",
        "text": "有医疗保险不代表所有牙科项目都被支付。Medicare 官方说明，大多数常规洗牙、补牙、拔牙、假牙与种植牙不由 Original Medicare 支付；与特定受保障医疗治疗直接相关的牙科服务可能有例外。请按自己的牙科计划或 Medicare Advantage 计划询问具体项目，不只问“收不收医保”。"
      },
      {
        "type": "checklist",
        "items": [
          "请保险计划和诊所分别确认：牙医是否属于你的具体网络，现在是否接收新病人。",
          "问清检查、X 光及后续治疗的保障、自付额、共同支付、年度上限、等待期和事先批准要求；未确认的金额先保留为空。",
          "预约时说明需要普通话、粤语或口译，确认当天能够安排的语言与费用；网站有中文不代表每位牙医都讲中文。"
        ]
      },
      {
        "type": "heading",
        "text": "第二步：使用 Medi-Cal Dental 官方查找与求助入口"
      },
      {
        "type": "paragraph",
        "text": "持有 Medi-Cal 时，先核对自己当前牙科保障和就诊路径，再使用 DHCS 牙医目录查询。目录中的接诊信息仍需电话确认；找不到接收新病人的牙医，可拨打官方牙科服务中心 1-800-322-6384 请求帮助。不要自行把医疗计划网络当作牙科网络。"
      },
      {
        "type": "link",
        "title": "打开 Medi-Cal 牙医目录",
        "text": "先查询所在地，再向诊所确认接诊、语言和保障。",
        "url": "https://www.dental.dhcs.ca.gov/Members/Medi-Cal_Dental/Find_A_Dentist/"
      },
      {
        "type": "paragraph",
        "text": "福利变动要看最新专门通知。2026-10-06 读取的 DHCS 牙科更新页说明，部分成人因移民身份而受影响的非急诊牙科变动已延至 2027 年 7 月 1 日；这不是所有成年人的牙科都取消。申请时间、目前覆盖范围、怀孕／产后或原寄养青年等例外要分别核对。带自己的通知向县或牙科服务中心确认，不用旧的 2026 年截图替自己判断。"
      },
      {
        "type": "link",
        "title": "核对 DHCS 牙科变动与中文通知",
        "text": "官方延期说明和 FAQ 有助于准备个人保障问题；本文不判定你的身份或资格。",
        "url": "https://www.dhcs.ca.gov/services/medi-cal-dental-benefit-changes/"
      },
      {
        "type": "heading",
        "text": "第三步：费用吃紧时，询问有明确规则的低费路径"
      },
      {
        "type": "paragraph",
        "text": "NEMS（东北医疗中心）提供成人与儿童牙科，可从牙科服务页联系，并向会员服务询问保险及按收入减费。机构明确说明不是免费诊所：减费需要按家庭人数、收入和证明材料评估，每年重新登记；未被保障或不符合减费的项目可能按完整费用收费。先问牙科项目是否适用，再提交机构要求的材料。"
      },
      {
        "type": "link",
        "title": "查看 NEMS 牙科与预约入口",
        "text": "另读来源区的费用说明；请机构确认所选地点的牙科与语言安排。",
        "url": "https://www.nems.org/services/dental/"
      },
      {
        "type": "paragraph",
        "text": "UCSF 的 Parnassus 学生综合牙科诊所是另一条可以询问的路线。官网说明学生在教职牙医监督下治疗，该诊所接收 Denti-Cal；学生服务可能较低费，但耗时更长、需要多次预约。先通过该诊所的新病人入口问评估、当前保险与完整治疗报价；教职、专科与学生诊所的规则不同，不能只凭“UCSF”推定价格或接收情况。"
      },
      {
        "type": "link",
        "title": "查看 UCSF 学生牙科的新病人入口",
        "text": "按具体诊所核对预约和保险，接受评估不等于一定能完成所需治疗。",
        "url": "https://dentistry.ucsf.edu/dental-center/clinics/student-general-dentistry-clinic-parnassus"
      },
      {
        "type": "heading",
        "text": "预约前准备这些资料与问题"
      },
      {
        "type": "checklist",
        "items": [
          "整理保险计划名称、会员卡、希望处理的问题与既往牙科记录；是否需要 X 光转移，由诊所说明。",
          "先问首次检查费与书面治疗计划，再核对每项保险支付、自付费用和分期条件；不要只比较广告中的起价。",
          "需要急诊牙科时，直接联系诊所说明情况，问其当天评估方式；指南和保险查询不能替代医疗人员判断。"
        ]
      },
      {
        "type": "template",
        "title": "联系牙科诊所时这样问",
        "text": "我住在___，需要为成人／儿童安排___的牙科评估。保险计划是___／目前没有牙科保险。请问是否在网络内、接收新病人，首次费用与低费评估规则是什么？能否安排普通话／粤语／口译？治疗前会提供书面报价吗，需要哪些资料、可能要预约几次？"
      },
      {
        "type": "tip",
        "title": "个人资料只交给核实后的机构",
        "text": "不要在公开帖子上传保险卡、完整生日、病历、收入材料或身份号码。先从官网核对联系方式，再使用机构指定的安全渠道。"
      }
    ]
  },
  {
    "slug": "bay-area-chinese-senior-services-referral-guide",
    "title": "湾区中文长者服务：餐食、日间照护、陪伴与县级转介",
    "subtitle": "按居住县和实际需要找入口，再确认语言、资格、费用与候补",
    "summary": "为中文老人、中文长者与照顾者整理安老自助处、Family Bridges 及县级 AAA 的实际入口，分清活动中心、送餐和成人日间照护。",
    "category": "service",
    "categoryLabel": "长者服务",
    "emoji": "🤝",
    "audience": [
      "需要中文协助的长者",
      "为父母找服务的家属",
      "照顾者与独居长者"
    ],
    "tags": [
      "中文老人",
      "中文长者",
      "长者服务",
      "老人",
      "老人服务",
      "养老",
      "送餐",
      "日间照护",
      "照顾者",
      "Chinese seniors",
      "senior services",
      "AAA",
      "Self-Help for the Elderly",
      "Family Bridges"
    ],
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "service",
      "newcomer"
    ],
    "readMinutes": 5,
    "updatedAt": "2026-10-06",
    "sourceNote": "2026-10-06 编辑并读取加州老龄事务局、安老自助处与 Family Bridges 官方网页。以下是寻找和准备服务的入口，不判断个人福利或照护资格；机构提及某种语言不等于每个地点、时段和项目都可安排。费用、覆盖区域、转介要求及候补请向项目直接确认。",
    "sources": [
      {
        "title": "California Department of Aging：按县寻找服务",
        "url": "https://aging.ca.gov/Find_Services_in_my_County/",
        "description": "全州与湾区各县的 AAA 信息及协助电话；先按长者居住县转介。"
      },
      {
        "title": "安老自助处：成人日间照护",
        "url": "https://www.selfhelpelderly.org/our-services/health-and-home-care/senior-care/adult-day-services",
        "description": "明确列出普通话、粤语、台山话等员工语言，以及评估、医生书面许可与费用路径。"
      },
      {
        "title": "安老自助处：餐食项目",
        "url": "https://www.selfhelpelderly.org/our-services/nutrition-services",
        "description": "区分送餐、集体用餐与 CHAMPSS；各项目报名和覆盖范围应另外核对。"
      },
      {
        "title": "安老自助处：社会服务",
        "url": "https://www.selfhelpelderly.org/our-services/social-services",
        "description": "查看旧金山资源协调、个案管理及照顾者支持入口。"
      },
      {
        "title": "Family Bridges：中文长者探访项目",
        "url": "https://familybridges.org/visiting-program/",
        "description": "普通话与粤语陪伴项目面向北 Alameda County 指定城市中居家或较少社交的 60 岁以上长者。"
      },
      {
        "title": "Family Bridges：Hong Lok 长者中心",
        "url": "https://familybridges.org/hong-lok-senior-centers/",
        "description": "当前官网列出 Oakland 中心地址与 510-763-9017；活动、开放时间和语言须先询问。"
      }
    ],
    "blocks": [
      {
        "type": "heading",
        "text": "先说清需要：活动、餐食与照护是不同项目"
      },
      {
        "type": "paragraph",
        "text": "中文长者需要的可能是读英文通知、参加活动、送餐、有人探访，或白天需要照护。活动中心不自动提供医疗照护，餐食项目也不等于全天照护；先说明长者所在县、需要的语言与帮助类型，再问能处理的项目。不要只问“有没有老人福利”而漏掉居住范围和转介步骤。"
      },
      {
        "type": "heading",
        "text": "全湾区第一入口：所在县的 AAA 信息与协助"
      },
      {
        "type": "paragraph",
        "text": "加州老龄事务局的按县目录可寻找 Area Agency on Aging（AAA），全州信息线为 800-510-2020。即使不住在下列社区项目附近，也可以从自己县的入口询问餐食、交通、照顾者支持和当地转介。先要求普通话、粤语或口译，再确认机构实际能安排什么。"
      },
      {
        "type": "list",
        "items": [
          "San Francisco：415-355-3555；San Mateo：844-868-0938；Santa Clara：408-350-3200。",
          "Alameda：510-577-1900；Contra Costa：925-229-8434。",
          "Marin：415-473-4636；Sonoma：707-565-4636；Napa／Solano：707-784-8960。"
        ]
      },
      {
        "type": "link",
        "title": "按长者居住县查官方转介电话",
        "text": "以上号码来自本次读取的官方目录，拨打前可再次核对更新。",
        "url": "https://aging.ca.gov/Find_Services_in_my_County/"
      },
      {
        "type": "heading",
        "text": "旧金山：安老自助处的日间照护与资源协调"
      },
      {
        "type": "paragraph",
        "text": "安老自助处（Self-Help for the Elderly）的成人日间照护页列出普通话、粤语、台山话等员工语言，地点为旧金山 Jackie Chan Center，408 22nd Avenue，电话 415-677-7556。项目按个人情况评估照护，官网说明参加者需要医生书面许可及符合要求的结核病检查证明；Medi-Cal 支付仅适用于符合资格者，另有自费路线。先问当前转介、语言安排、接送、费用和名额，不把网站服务清单当作每个人都能取得的承诺。"
      },
      {
        "type": "link",
        "title": "查看安老自助处成人日间照护",
        "text": "需要白天照护时向该项目咨询；主要想读通知或找社区资源时，也可从来源区的社会服务入口询问。",
        "url": "https://www.selfhelpelderly.org/our-services/health-and-home-care/senior-care/adult-day-services"
      },
      {
        "type": "heading",
        "text": "餐食：到中心吃饭、送餐和餐厅计划分别询问"
      },
      {
        "type": "paragraph",
        "text": "安老自助处的餐食页分别提供 Home Delivered Meals、Congregate Meals 和 CHAMPSS 项目入口。能够出门聚餐与难以离家需要送餐，应说明不同情况。先问自己的地址是否在覆盖区、如何评估或登记、是否候补，以及饮食限制与付款／捐款规则；不要把一个项目的条件套到另一个项目。"
      },
      {
        "type": "link",
        "title": "查看安老自助处餐食项目",
        "text": "从对应项目入口核对所在地、报名、语言与餐食安排。",
        "url": "https://www.selfhelpelderly.org/our-services/nutrition-services"
      },
      {
        "type": "heading",
        "text": "东湾：Family Bridges 中文陪伴与 Oakland 中心"
      },
      {
        "type": "paragraph",
        "text": "Family Bridges 的 Visiting Program 明确服务普通话或粤语长者，提供探访、电话联系及轻量购物协助；官网列出的对象是 Alameda、Albany、Berkeley、Emeryville、Oakland 或 Piedmont 中年满 60 岁、居家不便或社交较少的长者。当前项目页电话为 510-839-2022。先请项目评估地址与需要、确认候补和具体安排；志愿陪伴不是医疗或全天居家照护。"
      },
      {
        "type": "link",
        "title": "查看 Family Bridges 中文长者探访项目",
        "text": "以当前项目页联系方式为准，先询问服务区域与申请步骤。",
        "url": "https://familybridges.org/visiting-program/"
      },
      {
        "type": "paragraph",
        "text": "主要想参加社区活动，可另问 Family Bridges 的 Hong Lok 长者中心：当前官网列出 168 11th Street 与 388 9th Street #290，Oakland，电话 510-763-9017。先确认具体地点、当天开放安排、活动资格与可用语言；旧网页缓存里的地址、免费或年龄说明，不代替项目现在的确认。"
      },
      {
        "type": "link",
        "title": "查看 Hong Lok 中心当前地址与联系入口",
        "text": "先致电确认后再前往，并说明需要的中文协助。",
        "url": "https://familybridges.org/hong-lok-senior-centers/"
      },
      {
        "type": "heading",
        "text": "家属或长者第一次联系时准备什么"
      },
      {
        "type": "checklist",
        "items": [
          "准备长者居住的市和县、偏好的普通话／粤语／其他语言，以及希望自己联系还是由获授权家属协助。",
          "用日常事实说明需求：能否出门用餐、是否希望有人陪伴、白天需要怎样的协助；需要照护评估时交给项目专业人员。",
          "逐项问服务区域、年龄或其他条件、医生转介、费用／捐款、候补、接送与语言；确认下一步和需要安全提交的材料。"
        ]
      },
      {
        "type": "template",
        "title": "给长者服务机构的询问说明",
        "text": "我为自己／获授权协助家属找服务，住在___市___县，希望用普通话／粤语／___联系。现在需要餐食／活动／探访／日间照护／照顾者支持，情况是___。贵项目是否服务这个地址？资格、评估、费用和候补怎样核对？可以安排什么语言、交通或转介，下一步应联系谁？"
      },
      {
        "type": "tip",
        "title": "先核实机构，再提交长者资料",
        "text": "公开求助只描述大致需要，不上传完整生日、保险号码、医疗记录、住址或收入证明。家属帮助前先确认本人同意及机构授权要求，通过核实后的安全渠道递交材料。"
      }
    ]
  }
];
