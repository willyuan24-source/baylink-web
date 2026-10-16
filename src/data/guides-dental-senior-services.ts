import type { Guide } from './guides';

/** Reviewed referral routes; individual eligibility and clinical decisions stay with providers. */
export const dentalSeniorServiceGuides: Guide[] = [
  {
    "slug": "bay-area-dental-care-insurance-low-cost-guide",
    "title": "湾区看牙与牙科费用：保险网络、Medi-Cal Dental 和低费入口",
    "subtitle": "先核对牙科保障，再向诊所确认新病人、语言与书面报价",
    "summary": "Medicare 一般不付洗牙、补牙、拔牙和假牙；有 Medi-Cal 找不到接新病人的牙医，打 1-800-322-6384（可要求口译）；低费可问 NEMS 按收入减费和 UCSF 学生诊所。",
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
    "readMinutes": 4,
    "updatedAt": "2026-10-12",
    "sourceNote": "2026-10-12 读取 Medicare.gov、DHCS 牙科、NEMS 与 UCSF 官方页面。本文提供预约和咨询路径，不诊断牙病，也不判断个人保险资格。",
    "sources": [
      {
        "title": "Medicare.gov：牙科保障",
        "url": "https://www.medicare.gov/coverage/dental-services",
        "description": "多数情况下不付洗牙、补牙、拔牙和假牙。"
      },
      {
        "title": "DHCS：Medi-Cal 牙医目录",
        "url": "https://www.dental.dhcs.ca.gov/Members/Medi-Cal_Dental/Find_A_Dentist/",
        "description": "按县找牙医；找不到接新病人的，打 1-800-322-6384。"
      },
      {
        "title": "DHCS：牙科福利变动与延期说明",
        "url": "https://www.dhcs.ca.gov/services/medi-cal-dental-benefit-changes/",
        "description": "部分成人牙科变动延到 2027 年 7 月 1 日，附中文通知。"
      },
      {
        "title": "DHCS：牙科福利变动 FAQ",
        "url": "https://www.dhcs.ca.gov/services/medi-cal-dental-benefit-changes/medi-cal-dental-benefit-changes-frequently-asked-questions/",
        "description": "申请时间、覆盖范围与例外的官方问答。"
      },
      {
        "title": "NEMS：牙科服务",
        "url": "https://www.nems.org/services/dental/",
        "description": "机构列出成人及儿童的牙科检查、预防与治疗服务。"
      },
      {
        "title": "NEMS：费用、保险与按收入减费",
        "url": "https://www.nems.org/resources/paying-for-your-care/",
        "description": "不是免费诊所；按收入减费，每年重新登记。"
      },
      {
        "title": "UCSF：Parnassus 学生综合牙科诊所",
        "url": "https://dentistry.ucsf.edu/dental-center/clinics/student-general-dentistry-clinic-parnassus",
        "description": "接收 Denti-Cal；新病人网上自助预约，老病人打 415-502-5800。"
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
        "text": "Medicare.gov 写明：多数情况下 Medicare 不付洗牙、补牙、拔牙，也不付假牙和种植牙；只有住院做牙科手术等少数情况例外。牙科要看你的牙科计划或 Medicare Advantage 计划，按具体项目问，不只问“收不收医保”。"
      },
      {
        "type": "checklist",
        "items": [
          "分别问保险计划和诊所：这位牙医在不在你的网络里，现在接不接新病人。",
          "问清检查、X 光和后续治疗的保障、自付额、年度上限、等待期，以及是否要事先批准。",
          "预约时说要普通话、粤语或口译，问清当天能安排的语言；网站有中文，不等于每位牙医都讲中文。"
        ]
      },
      {
        "type": "heading",
        "text": "第二步：使用 Medi-Cal Dental 官方查找与求助入口"
      },
      {
        "type": "paragraph",
        "text": "有 Medi-Cal 的，用 DHCS 牙医目录按县查找，可以只看“接收新病人”的牙医，也能按普通话、粤语筛选，再打电话确认。找不到接新病人的牙医，打 Medi-Cal 牙科服务中心 1-800-322-6384（周一到周五 8 点到 17 点），可要求口译。医疗计划的网络和牙科网络是两回事。"
      },
      {
        "type": "link",
        "title": "打开 Medi-Cal 牙医目录",
        "text": "按县查找，可只看接收新病人的牙医。",
        "url": "https://www.dental.dhcs.ca.gov/Members/Medi-Cal_Dental/Find_A_Dentist/"
      },
      {
        "type": "paragraph",
        "text": "DHCS 写明：牙科福利变动已延到 2027 年 7 月 1 日。从那天起，19 岁以上、因移民身份不符合联邦全额 Medi-Cal 的成人，牙科只保急诊；这不是所有成年人的牙科都取消。申请时间、目前覆盖范围和怀孕／产后等例外各有规则，拿着自己的通知问县办公室或牙科服务中心。"
      },
      {
        "type": "link",
        "title": "核对 DHCS 牙科变动与中文通知",
        "text": "延期说明、常见问题和中文通知。",
        "url": "https://www.dhcs.ca.gov/services/medi-cal-dental-benefit-changes/"
      },
      {
        "type": "heading",
        "text": "第三步：费用吃紧时，询问有明确规则的低费路径"
      },
      {
        "type": "paragraph",
        "text": "NEMS（东北医疗中心）有成人和儿童牙科，接受多种牙科保险。NEMS 写明自己不是免费诊所：没有保险或项目不在保障内的，按收入分级减费，最多收全价；减费资格每年重新登记，过期就按全价。会员服务部会按你的收入证明定减费等级。"
      },
      {
        "type": "link",
        "title": "查看 NEMS 牙科与预约入口",
        "text": "牙科服务与预约入口。",
        "url": "https://www.nems.org/services/dental/"
      },
      {
        "type": "paragraph",
        "text": "UCSF Parnassus 学生综合牙科诊所接收 Denti-Cal，学生在 UCSF 教职牙医的指导下治疗，费用较低，但耗时更长、常要多次预约。新病人用 UCSF 的新病人自助预约入口，老病人打 415-502-5800。UCSF 各个诊所的规则不同，按具体诊所问。"
      },
      {
        "type": "link",
        "title": "查看 UCSF 学生牙科的新病人入口",
        "text": "新病人预约入口和保险说明。",
        "url": "https://dentistry.ucsf.edu/dental-center/clinics/student-general-dentistry-clinic-parnassus"
      },
      {
        "type": "heading",
        "text": "预约前准备这些资料与问题"
      },
      {
        "type": "checklist",
        "items": [
          "带上保险计划名称、会员卡、想处理的问题和以前的牙科记录。",
          "先要首次检查费和书面治疗计划，再逐项问保险付多少、自己付多少、能否分期；别只比广告上的起价。",
          "牙痛、肿胀等急诊，直接打给诊所说明情况，问当天怎么评估。"
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
        "text": "保险卡、完整生日、病历、收入材料和身份号码只交给核实过的机构，别发到公开帖子。"
      }
    ]
  },
  {
    "slug": "bay-area-chinese-senior-services-referral-guide",
    "title": "湾区中文长者服务：餐食、日间照护、陪伴与县级转介",
    "subtitle": "按居住县和实际需要找入口，再确认语言、资格、费用与候补",
    "summary": "先打所在县的老龄机构 AAA（全州 800-510-2020）；旧金山白天照护找安老自助处 415-677-7556；东湾中文探访 Family Bridges 510-839-2022，免费。分清活动、送餐、探访和日间照护。",
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
      "Family Bridges",
      "老人送餐",
      "送餐上门",
      "爸妈",
      "父母",
      "陪伴探访",
      "Meals on Wheels"
    ],
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "service",
      "newcomer"
    ],
    "readMinutes": 6,
    "updatedAt": "2026-10-16",
    "sourceNote": "2026-10-12 读取加州老龄事务局、安老自助处与 Family Bridges 官方网页，2026-10-16 补读 On Lok、San José Public Library 和 Cupertino 长者中心的官网。本文是找服务的入口，不判断个人福利或照护资格；费用、覆盖区域和候补以机构答复为准。",
    "sources": [
      {
        "title": "California Department of Aging：按县寻找服务",
        "url": "https://aging.ca.gov/Find_Services_in_my_County/",
        "description": "全州 800-510-2020 与各县 AAA 电话。"
      },
      {
        "title": "安老自助处：成人日间照护",
        "url": "https://www.selfhelpelderly.org/our-services/health-and-home-care/senior-care/adult-day-services",
        "description": "普通话、粤语、台山话员工；医生书面许可与 12 个月内的结核病检查。"
      },
      {
        "title": "安老自助处：餐食项目",
        "url": "https://www.selfhelpelderly.org/our-services/nutrition-services",
        "description": "送餐、到中心用餐与 CHAMPSS 三个项目。"
      },
      {
        "title": "安老自助处：社会服务",
        "url": "https://www.selfhelpelderly.org/our-services/social-services",
        "description": "查看旧金山资源协调、个案管理及照顾者支持入口。"
      },
      {
        "title": "Family Bridges：中文长者探访项目",
        "url": "https://familybridges.org/visiting-program/",
        "description": "普通话、粤语探访，免费；60 岁及以上，北 Alameda County 六个城市。"
      },
      {
        "title": "Family Bridges：Hong Lok 长者中心",
        "url": "https://familybridges.org/hong-lok-senior-centers/",
        "description": "Oakland 两处中心，电话 510-763-9017。"
      },
      {
        "title": "On Lok：30th Street 长者中心活动",
        "url": "https://www.onlok.org/senior-center/activities",
        "description": "60 岁及以上；活动用英语和西班牙语；415-550-2210。"
      },
      {
        "title": "San José Public Library：Edenvale 一对一电脑辅导",
        "url": "https://sjpl.bibliocommons.com/events/6a07b6ef278f7c2f008d79e2",
        "description": "免费，英语或中文，不用预约。"
      },
      {
        "title": "San José Public Library：中文活动（含 Berryessa 英语会话俱乐部）",
        "url": "https://sjpl.bibliocommons.com/v2/events?languages=5d65e5fbe6fec218adacff4d",
        "description": "普通话使用者英语会话俱乐部：免费，不用报名。"
      },
      {
        "title": "Cupertino：长者中心社交活动",
        "url": "https://www.cupertino.gov/Parks-Recreation/Senior-Center/Socials",
        "description": "会员免费；非会员 $5 访客通行证。"
      }
    ],
    "blocks": [
      {
        "type": "heading",
        "text": "先说清需要：活动、餐食与照护是不同项目"
      },
      {
        "type": "paragraph",
        "text": "中文长者需要的可能是读英文通知、参加活动、送餐、有人探访，或白天有人照护。活动中心不提供医疗照护，餐食项目也不等于全天照护。先说清长者住在哪个县、用什么语言、要哪种帮助，再问机构能做什么。"
      },
      {
        "type": "heading",
        "text": "全湾区第一入口：所在县的 AAA 信息与协助"
      },
      {
        "type": "paragraph",
        "text": "加州老龄事务局的按县目录列出各县的老龄机构（Area Agency on Aging，AAA），全州信息线是 800-510-2020。不住在下面这些社区项目附近，也可以打自己县的 AAA，问餐食、交通、照顾者支持和当地转介；先要求普通话、粤语或口译。"
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
        "text": "各县电话 2026-10-12 在官方目录核对。",
        "url": "https://aging.ca.gov/Find_Services_in_my_County/"
      },
      {
        "type": "heading",
        "text": "旧金山：安老自助处的日间照护与资源协调"
      },
      {
        "type": "paragraph",
        "text": "安老自助处（Self-Help for the Elderly）的成人日间照护有讲普通话、粤语、台山话的员工，地点在旧金山 Jackie Chan Center，408 22nd Avenue，电话 415-677-7556。参加前要有家庭医生书面许可和 12 个月内的结核病检查证明；符合资格的由 Medi-Cal 支付，也可以按照护程度自费。"
      },
      {
        "type": "link",
        "title": "查看安老自助处成人日间照护",
        "text": "白天照护咨询；只想找社区资源，可问社会服务部。",
        "url": "https://www.selfhelpelderly.org/our-services/health-and-home-care/senior-care/adult-day-services"
      },
      {
        "type": "heading",
        "text": "餐食：到中心吃饭、送餐和餐厅计划分别询问"
      },
      {
        "type": "paragraph",
        "text": "安老自助处的餐食分三种：送餐（Home Delivered Meals）、到中心一起吃饭（Congregate Meals）和 CHAMPSS 餐厅计划。能出门的问到中心用餐，难离家的问送餐。先问地址是否在覆盖区、怎样登记、要不要候补，以及饮食限制和付款或捐款方式。"
      },
      {
        "type": "link",
        "title": "查看安老自助处餐食项目",
        "text": "按项目问所在地、报名、语言和餐食安排。",
        "url": "https://www.selfhelpelderly.org/our-services/nutrition-services"
      },
      {
        "type": "heading",
        "text": "东湾：Family Bridges 中文陪伴与 Oakland 中心"
      },
      {
        "type": "paragraph",
        "text": "Family Bridges 的探访项目（Visiting Program）服务讲普通话或粤语的长者：志愿者定期上门探访、打电话问候、帮忙买点日用品。对象是住在 Alameda、Albany、Berkeley、Emeryville、Oakland 或 Piedmont，年满 60 岁、出门不便或很少与人来往的长者。项目免费，办公时间周一到周五 9 点到 15 点，电话 510-839-2022。先请项目看地址和需要、问清候补；志愿陪伴不是医疗或全天居家照护。"
      },
      {
        "type": "link",
        "title": "查看 Family Bridges 中文长者探访项目",
        "text": "服务区域、申请步骤和联系方式。",
        "url": "https://familybridges.org/visiting-program/"
      },
      {
        "type": "paragraph",
        "text": "想参加社区活动的，可以问 Family Bridges 的 Hong Lok 长者中心：Oakland 168 11th Street 和 388 9th Street #290 两处，电话 510-763-9017。去之前先打电话问当天开放安排、活动资格和语言。"
      },
      {
        "type": "link",
        "title": "查看 Hong Lok 中心当前地址与联系入口",
        "text": "先打电话再前往，说明需要中文协助。",
        "url": "https://familybridges.org/hong-lok-senior-centers/"
      },
      {
        "type": "heading",
        "text": "长者中心活动、电脑帮助和练英语"
      },
      {
        "type": "list",
        "items": [
          "旧金山 · On Lok 30th Street 长者中心：50 多项运动、学习和创作活动，有电脑室，给 60 岁及以上独立生活的长者和成年残障人士；官网写明活动用英语和西班牙语进行，需要中文的先打 415-550-2210 问。",
          "南湾 · Edenvale 图书馆（101 Branham Lane East, San Jose）一对一电脑辅导：免费，英语或中文，不用报名或预约，到馆直接找人帮忙；场次在 San José Public Library 的活动日历上。",
          "南湾 · Berryessa 图书馆的普通话使用者英语会话俱乐部：给成人英语学习者练日常口语，主持人讲英语和普通话，任何程度都欢迎；免费，不用报名。",
          "南湾 · Cupertino 长者中心社交活动：舞蹈、地滚球、打牌、高尔夫、卡拉 OK、网球等；会员免费（另有注明的除外），非会员在前台买 $5 访客通行证；很多活动随到随参加，有的要报名。"
        ]
      },
      {
        "type": "heading",
        "text": "家属或长者第一次联系时准备什么"
      },
      {
        "type": "checklist",
        "items": [
          "准备长者住的市和县、想用普通话、粤语还是其他语言，以及由本人还是获授权的家属联系。",
          "用日常事实说明需要：能不能出门吃饭、想不想有人陪、白天需要哪些帮助；照护评估交给项目的专业人员。",
          "逐项问服务区域、年龄等条件、医生转介、费用或捐款、候补、接送和语言，记下下一步和要提交的材料。"
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
        "text": "公开求助只写大致需要，不写完整生日、保险号码、医疗记录、住址或收入证明。家属代办前先问本人同意和机构的授权要求，材料走机构的安全渠道。"
      }
    ]
  }
];
