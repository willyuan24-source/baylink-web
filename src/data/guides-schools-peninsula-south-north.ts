import type { Guide } from './guides';

// Official district and college sources reviewed 2026-09-27; no placement or admission is guaranteed.
export const schoolPeninsulaSouthNorthGuides: Guide[] = [
  {
    "category": "education",
    "categoryLabel": "学校与学区",
    "emoji": "🎒",
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "other"
    ],
    "readMinutes": 6,
    "updatedAt": "2026-09-27",
    "sourceNote": "资料于 2026 年 9 月 27 日查阅。学校边界、招生流程和服务会调整，请以对应学年官方页面与学区确认结果为准。",
    "slug": "peninsula-school-district-enrollment-guide",
    "title": "半岛学校与学区：先查地址和年级，再安排入学",
    "subtitle": "San Mateo County 与 Palo Alto 的查区、注册和看校入口",
    "summary": "分清小学、高中与统一学区，按学年查询住址对应学校，再确认注册、转学、新生语言支持及大学参访。",
    "audience": [
      "准备搬家或申请入学的家庭",
      "需要转学或新生支持的家长"
    ],
    "tags": [
      "半岛",
      "学校与学区",
      "入学与转学",
      "新生支持"
    ],
    "sources": [
      {
        "title": "SMCOE：学区与学校目录",
        "url": "https://www.smcoe.org/schools/school-districts",
        "description": "查县内学区、学校目录与学年日历。"
      },
      {
        "title": "SMFCSD：学校地址查询",
        "url": "https://www.smfcsd.net/district-departments/student-services/enrollment/school-locator",
        "description": "地址查询为初步归属，最终分配需注册确认。"
      },
      {
        "title": "SMFCSD：2026–27 新生注册",
        "url": "https://www.smfcsd.net/district-departments/student-services/enrollment/2026-2027-new-student-registration-process",
        "description": "核对当学年流程、材料与名额安排。"
      },
      {
        "title": "SMUHSD：新生入学",
        "url": "https://www.smuhsd.org/departments/student-services/enroll-a-new-student",
        "description": "高中学区单独审核注册与学校分配。"
      },
      {
        "title": "PAUSD：注册与学校查询",
        "url": "https://www.pausd.org/enrollment/registration",
        "description": "先核对地址是否在区内，再选相应学年。"
      },
      {
        "title": "PAUSD：英语学习者支持",
        "url": "https://www.pausd.org/student-supports/english-learner-program",
        "description": "了解语言评估、英语发展及学校联系人员。"
      },
      {
        "title": "College of San Mateo：校园与服务",
        "url": "https://collegeofsanmateo.edu/",
        "description": "首页提供校园地图、参访和学生服务入口。"
      },
      {
        "title": "College of San Mateo：申请入口",
        "url": "https://collegeofsanmateo.edu/apply/",
        "description": "按学生类型进入正式申请与注册流程。"
      },
      {
        "title": "Stanford：本科申请",
        "url": "https://admission.stanford.edu/apply/",
        "description": "区分一年级新生与转学申请。"
      },
      {
        "title": "Stanford：校园与线上参访",
        "url": "https://admission.stanford.edu/engage/",
        "description": "预约参访或了解线上项目，不代表申请结果。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "半岛找学校，先准备入学学年、年级和实际居住地址。房源写着 San Mateo、Redwood City 或 Palo Alto，不能据此认定学区，更不能认定具体学校。以下从公立 K–12 查区开始；私校和特殊项目另有申请规则。"
      },
      {
        "type": "heading",
        "text": "先查县目录，再分别确认小学和高中"
      },
      {
        "type": "list",
        "items": [
          "San Mateo County：从 SMCOE 目录找负责地址的学区。县内既有统一学区，也有分开的初等与高中学区；兄弟姐妹年级不同，可能需要联系两个办公室。",
          "以 San Mateo–Foster City 为例，先用 SMFCSD locator 查小学或初中；高中另核对 SMUHSD。查询结果不是空位保证，也不要把这个组合套用到整个半岛。",
          "Palo Alto：使用 PAUSD 注册页里的 School Finder，确认居住地址及目标年级。城市邮寄地址、附近校门或房产广告都不能替代官方确认。"
        ]
      },
      {
        "type": "heading",
        "text": "注册、转学和语言支持分开办理"
      },
      {
        "type": "paragraph",
        "text": "选对学年后，按学区清单准备居住、年龄和健康等证明，通过指定系统提交并保存回执。当前学年搬入与下一学年优先窗口不同；不要照旧页面的截止日判断能否申请。SMUHSD 要由工作人员审核后确认分配，SMFCSD 也可能因年级名额安排其他学校。区内换校与跨区转学要问不同表格、审核与通知流程，填表不代表获准。"
      },
      {
        "type": "paragraph",
        "text": "英语不是家庭主要语言时，主动问家庭语言调查、语言评估、翻译及课堂支持；PAUSD 有英语学习者服务入口。若已有学习支持计划，问如何安全转交和安排衔接；新环境适应或课后照护需求也可一并询问，不预设每校项目相同。"
      },
      {
        "type": "heading",
        "text": "看校问日常安排，大学另走申请系统"
      },
      {
        "type": "paragraph",
        "text": "从官方目录进入学校网站，先约办公室、说明会或开放日，再比较课程、到放学时间、接送和课后项目的名额与费用。College of San Mateo 可由首页找校园地图和参访，再到 Apply 申请；Stanford 则分别用 Engage 看校园、Apply 查本科新生或转学要求。大学与社区学院不按 K–12 住址学区分配，参访也不保证录取。"
      },
      {
        "type": "tip",
        "title": "地址只填官方入口",
        "text": "在官方查询器中输入完整居住地址；不要在公开提问、社区帖或本网站提交孩子姓名、出生日期、住址或证件。资料缺项、合住或临时居住情况，直接向学区问替代核验与协助办法。"
      },
      {
        "type": "template",
        "title": "询问学区的简短模板",
        "text": "您好，我们计划在［学年／月份］申请［年级］，已查看贵学区官方地址查询。请问应走新生注册、区内换校还是跨区转学？还需哪些材料，如何确认分配学校及开学安排？我们也想了解［语言／学习／课后照护］支持。"
      },
      {
        "type": "checklist",
        "items": [
          "分别保存相应年级、学年与学区的官方查询结果。",
          "确认申请已审核，并问清学校分配与首次到校日期。",
          "问好语言支持、接送和课后照护安排。",
          "大学参访与申请分别预约、准备，不当作 K–12 注册。"
        ]
      },
      {
        "type": "link",
        "title": "从 San Mateo County 官方学区目录开始",
        "url": "https://www.smcoe.org/schools/school-districts",
        "text": "Palo Alto 家庭可直接使用来源中的 PAUSD 注册与查询入口。"
      },
      {
        "type": "cta",
        "title": "继续安排全家的湾区生活",
        "text": "结合通勤、图书馆与生活服务指南，把看校和搬家清单一起保存。",
        "primaryLabel": "查看更多本地攻略",
        "primaryAction": "guides"
      }
    ]
  },
  {
    "category": "education",
    "categoryLabel": "学校与学区",
    "emoji": "🎒",
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "other"
    ],
    "readMinutes": 6,
    "updatedAt": "2026-09-27",
    "sourceNote": "资料于 2026 年 9 月 27 日查阅。学校边界、招生流程和服务会调整，请以对应学年官方页面与学区确认结果为准。",
    "slug": "south-bay-school-district-enrollment-guide",
    "title": "南湾学校与学区：San José、Cupertino、Sunnyvale 怎么查",
    "subtitle": "先确认年级与边界版本，再做注册、转学和新生准备",
    "summary": "从 Santa Clara County 官方目录查学区，区分统一学区与小学、高中分属不同学区的情况，并处理新旧学年边界。",
    "audience": [
      "准备搬家或申请入学的家庭",
      "需要转学或新生支持的家长"
    ],
    "tags": [
      "南湾",
      "学校与学区",
      "入学与转学",
      "新生支持"
    ],
    "sources": [
      {
        "title": "SCCOE：按地址查学区",
        "url": "https://www.sccoe.org/resources/families/Pages/School-District-Locator.aspx",
        "description": "先找负责学区，再向学区确认具体学校。"
      },
      {
        "title": "SCCOE：公立学校目录",
        "url": "https://publicschooldirectory.sccoe.org/",
        "description": "查询学区、学校与官方联系方式。"
      },
      {
        "title": "SJUSD：按学年注册与查询",
        "url": "https://www.sjusd.org/enrollment",
        "description": "2026–27 与 2027–28 以后使用不同查询入口。"
      },
      {
        "title": "Cupertino Union：学校查询",
        "url": "https://www.cusdk8.org/registration/locator",
        "description": "查询初步学校归属，注册时由负责部门确认。"
      },
      {
        "title": "Sunnyvale School District：新生注册",
        "url": "https://www.sesd.org/about-usnew/departments/student-information-enrollment/new-student-registration",
        "description": "按年级、学年和名额核对注册步骤。"
      },
      {
        "title": "FUHSD：高中注册与地址核验",
        "url": "https://www.fuhsd.org/departments/enrollment",
        "description": "使用高中学区自己的地址工具与入学中心。"
      },
      {
        "title": "San José State：申请入口",
        "url": "https://sjsu.edu/admissions/",
        "description": "按本科新生、转学等身份查要求。"
      },
      {
        "title": "San José State：校园参访",
        "url": "https://www.sjsu.edu/soar/campus-tours/index.php",
        "description": "查看导览、自助与线上参访选项。"
      },
      {
        "title": "Foothill College：申请与注册",
        "url": "https://foothill.edu/apply-and-register/",
        "description": "按学生类型选择申请、辅导与选课步骤。"
      },
      {
        "title": "Foothill College：招生办公室与校园地图",
        "url": "https://foothill.edu/apply-and-register/admissions-and-records/index.html",
        "description": "核对校园服务位置和当前联系办法。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "南湾同一座城市里可能有多个学区，同一住址的小学和高中也可能分属不同系统。先确定年级、入学学年及实际住址，再进入 Santa Clara County 教育办公室 SCCOE 的查询和目录；县级入口帮助找到学区，最终校址与分配仍要由学区确认。"
      },
      {
        "type": "heading",
        "text": "三座城市都要按地址和年级查"
      },
      {
        "type": "list",
        "items": [
          "San José：不要看到城市名就默认 SJUSD。确认在区内后，当前 2026–27 学年用该年 locator；2027–28 及以后用另一入口，不能把未来边界当作现在的分配。",
          "Cupertino：Cupertino Union（CUSD）的初等阶段查询不能替代高中查询。升高中时另外使用 Fremont Union High School District（FUHSD）的 Address Check Tool。",
          "Sunnyvale：Sunnyvale School District 的注册与 FUHSD 高中注册分开办理，但不是每个 Sunnyvale 地址都属于这两个学区；先由县目录和各区工具交叉确认。"
        ]
      },
      {
        "type": "heading",
        "text": "提交后继续跟进学校分配"
      },
      {
        "type": "paragraph",
        "text": "按正确学年的清单准备材料，线上提交或询问现场协助，并保存回执。SJUSD 明确须完成要求且收到工作人员确认，才算完成入学；其他区也应问审核状态、具体学校及到校安排。跨区申请与区内换校不是重新填一份普通注册表，先问转出、接收与候补程序；升入高中也不要自行认定注册已自动完成。"
      },
      {
        "type": "paragraph",
        "text": "新来家庭可问英语学习者评估、翻译、辅导员会面，以及原校成绩和学习支持计划的转交方式。中途搬来要确认课程衔接，尤其高中学分与课表；未拿到接收安排前，先让两校说明衔接步骤。"
      },
      {
        "type": "heading",
        "text": "看校与大学探索都从官网预约"
      },
      {
        "type": "paragraph",
        "text": "用 SCCOE 目录打开学校官网，联系办公室了解可预约的参访；重点问课程、课后项目名额及收费、每日接送和新生联系人。SJSU 的招生页与校园导览分别处理申请和参访；Foothill College 可先看申请步骤，再查办公室及校园地图。大学或社区学院要按学生类型、学期和课程另行申请，不沿用 K–12 住址分配，也不因到访取得名额。"
      },
      {
        "type": "tip",
        "title": "地址只填官方入口",
        "text": "在官方查询器中输入完整居住地址；不要在公开提问、社区帖或本网站提交孩子姓名、出生日期、住址或证件。资料缺项、合住或临时居住情况，直接向学区问替代核验与协助办法。"
      },
      {
        "type": "template",
        "title": "询问学区的简短模板",
        "text": "您好，我们计划在［学年／月份］申请［年级］，已查看贵学区官方地址查询。请问应走新生注册、区内换校还是跨区转学？还需哪些材料，如何确认分配学校及开学安排？我们也想了解［语言／学习／课后照护］支持。"
      },
      {
        "type": "checklist",
        "items": [
          "查区使用了目标年级和正确学年的边界。",
          "升高中另查高中学区，没有只沿用小学结果。",
          "保存正式入学确认，核对课表或第一天到校安排。",
          "问清语言、学习支持和课后项目的联系人。"
        ]
      },
      {
        "type": "link",
        "title": "从 Santa Clara County 官方查区入口开始",
        "url": "https://www.sccoe.org/resources/families/Pages/School-District-Locator.aspx",
        "text": "找到学区后，再进入对应年级与学年的招生页面。"
      },
      {
        "type": "cta",
        "title": "继续安排全家的湾区生活",
        "text": "结合通勤、图书馆与生活服务指南，把看校和搬家清单一起保存。",
        "primaryLabel": "查看更多本地攻略",
        "primaryAction": "guides"
      }
    ]
  },
  {
    "category": "education",
    "categoryLabel": "学校与学区",
    "emoji": "🎒",
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "other"
    ],
    "readMinutes": 6,
    "updatedAt": "2026-09-27",
    "sourceNote": "资料于 2026 年 9 月 27 日查阅。学校边界、招生流程和服务会调整，请以对应学年官方页面与学区确认结果为准。",
    "slug": "north-bay-school-district-enrollment-guide",
    "title": "北湾学校与学区：Marin、Sonoma、Napa 分县找入口",
    "subtitle": "按住址查负责学区，区分注册、换校和大学申请",
    "summary": "北湾不是一个学区。按三个县的目录查询，再核对年级、学年、转学规则与新生支持，并安排学校或社区学院参访。",
    "audience": [
      "准备搬家或申请入学的家庭",
      "需要转学或新生支持的家长"
    ],
    "tags": [
      "北湾",
      "学校与学区",
      "入学与转学",
      "新生支持"
    ],
    "sources": [
      {
        "title": "Marin County：学区目录与边界",
        "url": "https://www.marinschools.org/districts-schools/districts/marin-county-school-districts",
        "description": "按地址查初等、高中或统一学区。"
      },
      {
        "title": "Sonoma County：学校与学区目录",
        "url": "https://www.scoe.org/directory",
        "description": "目录连接官方学区查询与学校信息。"
      },
      {
        "title": "Sonoma County：就读与转学选项",
        "url": "https://www.scoe.org/for-families/attendance-options",
        "description": "区分区内换校与跨区转学审核。"
      },
      {
        "title": "Napa County：各学区入口",
        "url": "https://napacoe.org/districts/",
        "description": "核对 NVUSD、St. Helena、Calistoga 等不同学区。"
      },
      {
        "title": "NVUSD：新生注册与学校归属",
        "url": "https://www.nvusd.org/enrolling-in-nvusd/school-registration",
        "description": "先确认适用学年、学校归属与当前系统状态。"
      },
      {
        "title": "College of Marin：申请",
        "url": "https://www1.marin.edu/apply",
        "description": "按学生类别完成学院申请。"
      },
      {
        "title": "College of Marin：两校区参访",
        "url": "https://ss.marin.edu/outreach",
        "description": "可联系安排 Kentfield 或 Indian Valley 校区导览。"
      },
      {
        "title": "Santa Rosa Junior College：招生与注册",
        "url": "https://admissions.santarosa.edu/",
        "description": "提供申请步骤及 Santa Rosa、Petaluma 服务位置。"
      },
      {
        "title": "Santa Rosa Junior College：校园导览",
        "url": "https://studentlife.santarosa.edu/campus-tours",
        "description": "潜在学生可按官方安排了解校园。"
      },
      {
        "title": "Napa Valley College：申请与校园服务",
        "url": "https://www.napavalley.edu/admissions-and-aid/index.html",
        "description": "从申请步骤进入 Welcome Center、校园地图与停车信息。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "北湾跨 Marin、Sonoma 与 Napa 三县，招生由具体学区办理，没有统一的北湾报名表。先选县，再用实际住址、年级和入学学年查学区；城市名称或离家最近的校门都不能直接决定就读学校。县教育办公室目录适合找入口，学校分配则向负责学区确认。"
      },
      {
        "type": "heading",
        "text": "三个县各自怎么查"
      },
      {
        "type": "list",
        "items": [
          "Marin：官方学区页有地址或地块边界查询，并分列初等、高中和统一学区。小学与高中可能不同，分别保存结果，再查所需年级的学校目录。",
          "Sonoma：从 SCOE Directory 进入 District Lookup，找到学区后再确认校内招生边界。学区范围与某所学校的招生范围是两层查询，不能只凭县级地图选择校区。",
          "Napa：NCOE 目录列有 NVUSD、St. Helena、Calistoga 及其他学区，不能把整个县都当 NVUSD。若归 NVUSD，按注册页提示用 School of Residence 核对；交互地图有更新提示时，以学区确认结果为准。"
        ]
      },
      {
        "type": "heading",
        "text": "先问当前学年，再准备注册与支持"
      },
      {
        "type": "paragraph",
        "text": "确认负责学区后，问现在入学还是下一学年申请，领取对应材料清单、提交入口和审核联系。网站旧日期或系统维护提示不代表当前不能入学；Napa 页面若不同段落学年不一致，先向注册办公室确认，避免误用过期窗口。区内换校与跨区转学需单独申请，Sonoma 官方说明也明确接收并非自动获准，应跟进转出与接收两端的决定。"
      },
      {
        "type": "paragraph",
        "text": "新到家庭可询问语言评估、翻译、辅导员及家校沟通工具；已有学习支持计划时问记录如何安全衔接。预约看校从官方学校目录联系办公室，问清放学接送、课后照护的资格与费用，以及校车是否覆盖住址，不把邻居的安排当作全县标准。"
      },
      {
        "type": "heading",
        "text": "社区学院另有申请与校园入口"
      },
      {
        "type": "paragraph",
        "text": "College of Marin 可联系参访 Kentfield 或 Indian Valley，再从 Apply 选择申请身份。SRJC 的招生页列 Santa Rosa 与 Petaluma 服务位置，校园导览另查预约。Napa Valley College 的 Admissions & Aid 连接新生步骤、Welcome Center 与校园地图。学院申请、选课和费用依学生类型及项目核对，不沿用 K–12 学区分配，也不承诺课程余位或转学录取。"
      },
      {
        "type": "tip",
        "title": "地址只填官方入口",
        "text": "在官方查询器中输入完整居住地址；不要在公开提问、社区帖或本网站提交孩子姓名、出生日期、住址或证件。资料缺项、合住或临时居住情况，直接向学区问替代核验与协助办法。"
      },
      {
        "type": "template",
        "title": "询问学区的简短模板",
        "text": "您好，我们计划在［学年／月份］申请［年级］，已查看贵学区官方地址查询。请问应走新生注册、区内换校还是跨区转学？还需哪些材料，如何确认分配学校及开学安排？我们也想了解［语言／学习／课后照护］支持。"
      },
      {
        "type": "checklist",
        "items": [
          "已确认县、学区、年级和适用学年。",
          "地图有疑问时已向学区确认，没有按城市名推断。",
          "保存注册审核或转学决定，问清接收学校和到校日期。",
          "提前了解语言支持、接送、课后照护及费用。"
        ]
      },
      {
        "type": "link",
        "title": "打开 Marin 官方学区与边界目录",
        "url": "https://www.marinschools.org/districts-schools/districts/marin-county-school-districts",
        "text": "Sonoma 与 Napa 家庭请使用下方各县来源，不跨县套用。"
      },
      {
        "type": "cta",
        "title": "继续安排全家的湾区生活",
        "text": "结合通勤、图书馆与生活服务指南，把看校和搬家清单一起保存。",
        "primaryLabel": "查看更多本地攻略",
        "primaryAction": "guides"
      }
    ]
  }
];
