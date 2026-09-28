import type { Guide } from './guides';

// Official education sources checked 2026-09-27; school assignments require district confirmation.
export const schoolSfEastGuides: Guide[] = [
  {
    "category": "education",
    "categoryLabel": "学校与学区",
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "other"
    ],
    "readMinutes": 6,
    "updatedAt": "2026-09-27",
    "sourceNote": "资料于 2026 年 9 月 27 日查阅。学区、年级、申请学年与学校项目须分别核对；分配结果、材料要求及参观安排以官方当前回复为准。",
    "slug": "sf-school-district-enrollment-guide",
    "title": "旧金山学校与学区：从地址核对到 SFUSD 入学",
    "subtitle": "分清本学年新生、下一学年申请与在读转校，再安排看校",
    "summary": "按实际住址、孩子年级和入学学年找到 SFUSD 正确入口，理解申请与学校分配，另查 CCSF 和旧金山州立大学的校园与招生。",
    "emoji": "🎓",
    "audience": [
      "搬到旧金山的家庭",
      "需要申请、转校或看校的家长"
    ],
    "tags": [
      "学校与学区",
      "旧金山",
      "SFUSD",
      "入学申请",
      "大学校园",
      "日常办事"
    ],
    "sources": [
      {
        "title": "SFUSD：申请入口与学年",
        "url": "https://www.sfusd.edu/schools/enroll/apply",
        "description": "区分 2026–27 新生与 2027–28 申请，查看提交方式。"
      },
      {
        "title": "SFUSD：入学材料与居住要求",
        "url": "https://www.sfusd.edu/schools/enroll/apply/requirements",
        "description": "由家庭自行核对官方材料清单及特殊情况帮助。"
      },
      {
        "title": "SFUSD：分配优先规则",
        "url": "https://www.sfusd.edu/schools/enroll/student-assignment-policy/tiebreakers",
        "description": "不同年级和项目规则不同；附近学校不保证录取。"
      },
      {
        "title": "SFUSD：学校目录",
        "url": "https://www.sfusd.edu/schools/directory",
        "description": "按年级找到学校官网、项目和联系信息。"
      },
      {
        "title": "SFUSD：学校参观",
        "url": "https://www.sfusd.edu/schools/enroll/discover/sfusd-school-tours",
        "description": "核对当期参观开放、预约与学校安排。"
      },
      {
        "title": "SFUSD：春季转校",
        "url": "https://www.sfusd.edu/schools/enroll/apply/spring-transfer",
        "description": "仅适用于符合条件的在读学生；获分配后会替换原学校。"
      },
      {
        "title": "CCSF：校区与教学中心",
        "url": "https://www.ccsf.edu/about/our-locations",
        "description": "查 Ocean Campus 和分布在市内的教学中心。"
      },
      {
        "title": "CCSF：Start Here 入学入口",
        "url": "https://www.ccsf.edu/apply-ccsf/start-here",
        "description": "从当前入口选择学习项目，再完成入学和选课步骤。"
      },
      {
        "title": "旧金山州立大学：招生",
        "url": "https://future.sfsu.edu/admissions",
        "description": "本科新生、转学生、研究生及国际申请分别查看。"
      },
      {
        "title": "旧金山州立大学：参观校园",
        "url": "https://future.sfsu.edu/visit",
        "description": "提供预约导览、自助路线与虚拟参观。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "选学校先解决三个问题：实际住在哪里、孩子读几年级、准备哪个学年入学。把官方入口存好，再比较项目和接送安排，能避免把房源里的“附近名校”当成录取承诺。以下以公立 K–12 为主，大学与社区学院另走招生流程。"
      },
      {
        "type": "heading",
        "text": "先核对住址，理解“申请后分配”"
      },
      {
        "type": "paragraph",
        "text": "在 SFUSD 学校目录进入 School Finder，以实际街道地址和年级查学校，再向 Enrollment Center 确认居住资格及适用项目。邮寄城市、邮编、房产广告都不能代替核验。SFUSD 接收申请后按规则和名额分配，不保证最近学校；小学 attendance area 也不是保留学位。TK、小学、初中、高中的规则须分别查，不能把一所小学的安排一路推到高中；湾区其他地区还可能由不同学区分别负责各学段。"
      },
      {
        "type": "heading",
        "text": "按学年和学生状态办理"
      },
      {
        "type": "list",
        "items": [
          "2026–27 学年新生可全年联系 Enrollment Center；从 Apply 页面使用 ParentVUE，或按官方说明提交纸本／PDF，再确认学校、年级与开始上课日期。",
          "申请 2027–28 学年要选择下一学年入口，重新核对开放时间与截止日；不要把正在就读的学年、报名回执和最终分配混为一谈。",
          "住所、年龄及其他证明只按官网清单核对并交官方渠道，不发到本站或公开群。材料不齐、临时居住或需要语言支持时，先问招生中心可用帮助。"
        ]
      },
      {
        "type": "paragraph",
        "text": "在读学生想换校，应查适用的转校流程；Spring Transfer 面向符合条件的 SFUSD 在读生，不包含 charter school 学生。成功分配会自动替换原学校，不能当成收到结果后再决定的试探申请。跨学区就读另查 interdistrict permit，并向居住学区及接收学区确认。"
      },
      {
        "type": "heading",
        "text": "看校时比较每天真正会用到的条件"
      },
      {
        "type": "paragraph",
        "text": "从官方学校目录挑两三所，再查学校参观页预约。问清语言项目、学习支持、上放学时间、课后照护名额和接送方式；可先试走通勤路线。参观不等于招生承诺，校内活动和教室进入也需学校许可。不同项目要求以该学年说明为准。"
      },
      {
        "type": "heading",
        "text": "大学与社区学院：独立查校园和申请"
      },
      {
        "type": "paragraph",
        "text": "CCSF 的校区目录包括 Ocean Campus、Mission、Chinatown/North Beach 等教学中心，课程地点仍以课表为准；学位、证书或转学课程从 Start Here 进入，再按后续指引选课。旧金山州立大学从 Admissions 区分新生、转学生等身份，并用 Visit Campus 预约或看自助地图。两者都与 K–12 学区分配无关，住得近不会代替申请；参观日期、开放区域与便利设施先向校方核实。"
      },
      {
        "type": "template",
        "title": "给招生办公室的核对模板",
        "text": "我想办理［学年］［年级］的［新生／在读转校／跨学区］入学，预计［月份］开始。请确认适用入口、住址核验方式、材料清单、分配与报到步骤，以及［语言／学习支持］联系渠道。详细住址和文件仅在官方指定渠道提交。"
      },
      {
        "type": "checklist",
        "items": [
          "已分别记下年级、学年和预计入学月份。",
          "已向官方核对住址与适用申请类型。",
          "已保存提交回执并确认最终学校与报到要求。",
          "已核对接送、照护和参观预约。"
        ]
      },
      {
        "type": "link",
        "title": "打开 SFUSD 正式申请说明",
        "text": "先选对学年，再进入对应系统或联系招生中心。",
        "url": "https://www.sfusd.edu/schools/enroll/apply"
      },
      {
        "type": "cta",
        "title": "继续安排家庭在湾区的日常",
        "text": "结合通勤、图书馆和新居民指南，把入学后的生活一起安排好。",
        "primaryLabel": "查看更多本地生活攻略",
        "primaryAction": "guides"
      }
    ]
  },
  {
    "category": "education",
    "categoryLabel": "学校与学区",
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "other"
    ],
    "readMinutes": 6,
    "updatedAt": "2026-09-27",
    "sourceNote": "资料于 2026 年 9 月 27 日查阅。学区、年级、申请学年与学校项目须分别核对；分配结果、材料要求及参观安排以官方当前回复为准。",
    "slug": "east-bay-school-district-enrollment-guide",
    "title": "东湾学校与学区：先查地址，再找对招生办公室",
    "subtitle": "串起 Alameda 与 Contra Costa 两县目录、五个学区入口和大学申请",
    "summary": "按详细住址和年级核对负责学区，分清新生、区内转校与跨学区申请；再查学校参观、UC Berkeley 和 Peralta 学院入口。",
    "emoji": "🏫",
    "audience": [
      "搬到东湾的家庭",
      "需要核对学区和转学流程的家长"
    ],
    "tags": [
      "学校与学区",
      "东湾",
      "地址核验",
      "入学申请",
      "大学校园",
      "日常办事"
    ],
    "sources": [
      {
        "title": "ACOE：Alameda 县学校与学区目录",
        "url": "https://www.acoe.org/34593_3",
        "description": "含学区地图、官方联系入口及社区学院目录。"
      },
      {
        "title": "CCCOE：Contra Costa 县学区目录",
        "url": "https://www.cccoe.k12.ca.us/Departments--Schools/County-School-Districts/",
        "description": "从县教育局目录查学校与学区，再请学区核实边界。"
      },
      {
        "title": "OUSD：找学校、参观与申请",
        "url": "https://www.ousd.org/enroll/faqs/applying-for-next-year",
        "description": "介绍 ChooseOUSD 地址与年级筛选，以及 EnrollWise 申请。"
      },
      {
        "title": "Berkeley Unified：招生办公室",
        "url": "https://www.berkeleyschools.net/admissions/",
        "description": "核对年级对应报名、住所材料、分配与参观信息。"
      },
      {
        "title": "Fremont Unified：官方新生登记门户",
        "url": "https://fremontusd.aeries.net/enrollment/Default.aspx",
        "description": "说明独立招生账号、地址核验及后续预约；学年标签需向学区确认。"
      },
      {
        "title": "Mt. Diablo Unified：Enrollment Center",
        "url": "https://www.mdusd.org/families/enrollmentservices/enrollnow",
        "description": "集中办理招生、地址变更及转校，并提供 School Finder。"
      },
      {
        "title": "San Ramon Valley Unified：新生入学",
        "url": "https://www.srvusd.net/Departments/Educational-Services/Enrollment-Info/Enrollment/",
        "description": "由 School Site Locator、材料清单进入申请及审核。"
      },
      {
        "title": "Peralta：四所学院目录与入学",
        "url": "https://home.peralta.edu/enroll",
        "description": "选择学院、提交入学信息后，再在 Campus Solutions 选课。"
      },
      {
        "title": "UC Berkeley：本科申请",
        "url": "https://admissions.berkeley.edu/apply-to-berkeley/",
        "description": "分别查看 first-year 与 transfer 要求和申请清单。"
      },
      {
        "title": "UC Berkeley：校园参观",
        "url": "https://admissions.berkeley.edu/visit/",
        "description": "校园导览与招生说明会需按各自入口确认预约。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "东湾没有一套覆盖所有城市的报名系统。先确认住所所在县和详细地址，再找到孩子年级对应的学区，最后比较学校项目。县教育局目录是查找起点，不是自动分配学校的报名表；以下入口也不是学校排名。"
      },
      {
        "type": "heading",
        "text": "地址和年级要一起查"
      },
      {
        "type": "paragraph",
        "text": "Alameda 县从 ACOE 学校与学区目录及地图开始；Contra Costa 县从 CCCOE 学区目录进入学区官网。用完整街道地址核对 district boundary，再用该学区 School Locator 查具体学校。小学、初中、高中可能由不同学区负责；城市名、邮编及房产网站标注都不能代替核验。新街道、边界地址或地图结果不清楚时，请招生办公室确认，不自行推断。"
      },
      {
        "type": "heading",
        "text": "五个常用学区，从各自入口继续"
      },
      {
        "type": "list",
        "items": [
          "Oakland：ChooseOUSD 可按年级和地址查学校，申请使用 EnrollWise；需要本学年立即入学时先联系 Enrollment Office，核对当前轮次。",
          "Berkeley：Admissions Office 集中处理入学与分配；小学和初中分别查 zone，再看对应年级申请，不能把某个区域当成单校保证。",
          "Fremont：新生 Aeries 登记账号与 Parent Portal 不同。地址找不到时联系学区核验；页面仍有旧学年文字，先确认当前学年选项及提交后的预约步骤。",
          "Mt. Diablo：从 Enrollment Center 的 School Finder 查地址与年级，再走集中招生；地图仅作指引，特殊区域和最终学校请官方确认。",
          "San Ramon Valley：先查 School Site Locator，再准备材料、网上申请和等候审核；校方明确学校或年级可能满额，住所对应学校不保证有座位。"
        ]
      },
      {
        "type": "heading",
        "text": "新生、转校和看校分开办理"
      },
      {
        "type": "paragraph",
        "text": "核验时 Berkeley、Mt. Diablo 和 San Ramon Valley 均有 2026–27 入学入口；下一学年要重新看时间表。新生按官网清单核对住所、年龄及学习记录等文件，只交官方渠道。区内换校查 intradistrict，跨学区查 interdistrict，并向居住与接收学区确认许可、名额和结果时间。提交成功不是完成分配。"
      },
      {
        "type": "paragraph",
        "text": "从学区学校目录进入校方网站预约看校，问语言与学习支持、课程、课后照护和实际接送。不要未经许可进入校园。缺少常规住所文件或需要翻译时直接问招生人员的替代核验与支持办法，不把证件发给陌生人。"
      },
      {
        "type": "heading",
        "text": "大学与社区学院，不按 K–12 学区分配"
      },
      {
        "type": "paragraph",
        "text": "UC Berkeley 从本科申请页区分 first-year 与 transfer；校园参观页连接导览和招生说明会，两种活动分别核对预约。Peralta 入学页列出 Berkeley City College、College of Alameda、Laney、Merritt 四所学院，可先进入各校了解校园与课程，再选学院办理入学并在 Campus Solutions 选课。其他社区学院可从县目录继续找。大学申请资格、课程校区、费用和参观安排都单独确认，住在当地不等于录取或免学费。"
      },
      {
        "type": "template",
        "title": "给学区的询问模板",
        "text": "我计划［学年／月份］为［年级］学生办理［新生／区内转校／跨学区］。请确认地址核验入口、负责学区、所需材料、当前轮次、后续审核及看校方式。我会仅向官方指定渠道提供详细住所和学生文件。"
      },
      {
        "type": "checklist",
        "items": [
          "已按地址分别核对各年级负责学区。",
          "已区分本学年和下一学年申请。",
          "已确认转校类型及所需许可。",
          "已保存回执并向校方确认分配、报到和支持安排。"
        ]
      },
      {
        "type": "link",
        "title": "从 Alameda 县官方学区目录开始",
        "text": "Contra Costa 县及各学区入口见下方官方资料。",
        "url": "https://www.acoe.org/34593_3"
      },
      {
        "type": "cta",
        "title": "把上学路线和家庭生活一起安排",
        "text": "继续查看通勤与社区资源，整理真正能执行的入学清单。",
        "primaryLabel": "查看更多本地生活攻略",
        "primaryAction": "guides"
      }
    ]
  }
];
