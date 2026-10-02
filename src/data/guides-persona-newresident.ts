import type { Guide } from "./guides";

export const newResidentPersonaGuides: Guide[] = [
  {
    "slug": "bay-area-first-doctor-insurance-network-guide",
    "emoji": "🩺",
    "title": "搬来湾区后第一次找医生：核对保险网络、预约与转诊",
    "subtitle": "把“有保险卡”推进到“有人接诊”，并留下可追踪的确认记录",
    "summary": "为新居民拆解首次非急诊就医：辨认具体保险计划，找接收新病人的基层医生，准备资料和口译，再处理没有名额、转诊未到和账单不一致。",
    "category": "newcomer",
    "categoryLabel": "新居民就医导航",
    "audience": [
      "刚搬到湾区的成年人和家庭",
      "换保险或需要重新找医生的人"
    ],
    "tags": [
      "首次预约",
      "保险网络",
      "基层医生",
      "中文口译",
      "医疗账单"
    ],
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "other"
    ],
    "readMinutes": 9,
    "updatedAt": "2026-10-02",
    "sourceNote": "官方入口核验于 2026-10-02。本文提供预约、资料与保险核对流程，不判断病情、不推荐治疗，也不判定任何人的保险或补助资格。接收新病人、实际费用、网络归属和授权必须由诊所与计划方按具体服务确认。",
    "sources": [
      {
        "title": "DMHC：选择基层医生与准备就诊",
        "url": "https://www.dmhc.ca.gov/HealthCareinCalifornia/YourHealthCareRights/YouandYourDoctor.aspx",
        "description": "说明 PCP、medical group、新病人名额、语言协助和就诊问题清单。"
      },
      {
        "title": "DMHC：及时获得医疗服务",
        "url": "https://www.dmhc.ca.gov/HealthCareinCalifornia/YourHealthCareRights/TimelyAccesstoCare.aspx",
        "description": "查看适用计划的预约时限、例外以及无法约到时的求助顺序。"
      },
      {
        "title": "DMHC：计划申诉与 Help Center",
        "url": "https://www.dmhc.ca.gov/FileaComplaint.aspx",
        "description": "核对主管范围、先向计划申诉的要求、紧急例外与授权协助表。"
      },
      {
        "title": "CMS：看懂保险与医疗账单术语",
        "url": "https://www.cms.gov/initiatives/your-patient-rights/medical-bill-rights/get-help/medical-bill-guides-resources/health-insurance-terms-you-should-know",
        "description": "区分 EOB、copay、deductible、网络内服务和自费费用估算。"
      },
      {
        "title": "UCSF Health：Primary Care 官方入口",
        "url": "https://www.ucsfhealth.org/care/services/primary-care",
        "description": "按地点和医生进入预约；页面存在不等于当前有新病人名额。"
      },
      {
        "title": "Santa Clara Valley Medical Center：官方电话目录",
        "url": "https://scvmc.scvh.org/contact-us/phone-directory",
        "description": "分开列出预约、账单、客户服务与财务协助联系。"
      },
      {
        "title": "Covered California：寻找认证申请协助",
        "url": "https://www.coveredca.com/get-help/find-an-enroller",
        "description": "按地区和语言寻找免费申请或计划选择协助；资格仍需个别核验。"
      },
      {
        "title": "HRSA：按地址寻找 Health Center",
        "url": "https://findahealthcenter.hrsa.gov/",
        "description": "以城市或邮编找社区医疗机构，再向机构确认接诊和费用安排。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "这份流程适合安排日常、非急诊的首次就诊。目标是拿到一个确认过保险网络、地点、时间和材料的预约。若正在发生医疗紧急情况，请拨 911；不确定该去哪里时，使用保险卡上的医疗咨询电话，由专业人员判断，别等待普通预约流程。"
      },
      {
        "type": "heading",
        "text": "第一步：先把自己的计划认准"
      },
      {
        "type": "checklist",
        "items": [
          "准备保险卡正反面、会员号码、计划完整名称、保障开始日期，以及卡上是否已指定 PCP 或 medical group；资料只交诊所或保险方。",
          "登录会员门户，找 Provider Directory、Member Services 和 benefits；只有雇主的参保邮件时，向福利团队确认实际生效状态。",
          "写下成人或儿科、希望使用的语言、能到达的城市和可约时段；需要无障碍或陪同安排也一起说明。"
        ]
      },
      {
        "type": "paragraph",
        "text": "先问保险方：“我的具体计划在湾区使用哪个网络？是否必须先选 PCP 或 medical group？专科、检验和影像需要什么转诊或授权？”诊所说“收这个保险品牌”还不够。把答复日期、客服姓名或确认号记下来，再按诊所与计划双方答复推进。"
      },
      {
        "type": "heading",
        "text": "第二步：从保险目录筛三家，再逐家确认"
      },
      {
        "type": "paragraph",
        "text": "按地点、年龄范围与语言筛选，再用诊所官网找预约联系方式。给每家记三栏：是否网络内、是否收新病人、最早实际可约时间。PCP 是日常照护联系起点；medical group 是合作医生组织，不能仅凭医院楼名推断可以使用其中所有医生。"
      },
      {
        "type": "template",
        "title": "打给诊所的预约模板",
        "text": "您好，我刚搬来，想建立［成人／儿科］基层医疗关系。我的计划完整名称是［名称］，卡上显示［PCP／medical group，如有］。这位医生和这个地址是否接受我的具体网络？是否收新病人？最早预约及取消候补怎样安排？需要先改 PCP、转诊或授权吗？我需要［普通话／粤语／其他语言］口译，怎样预约？"
      },
      {
        "type": "link",
        "title": "旧金山示例：从 UCSF Primary Care 找地点和预约",
        "text": "先查地点，再确认具体医生的新病人名额与保险；预约请求需要诊所明确回复日期和时间。",
        "url": "https://www.ucsfhealth.org/care/services/primary-care"
      },
      {
        "type": "link",
        "title": "南湾示例：使用 SCVMC 官方电话目录",
        "text": "预约与咨询列为 888-334-1000；账单和财务协助另有号码。拨打前复核目录，按需求选择部门。",
        "url": "https://scvmc.scvh.org/contact-us/phone-directory"
      },
      {
        "type": "heading",
        "text": "第三步：预约与保险两边都要有确认"
      },
      {
        "type": "paragraph",
        "text": "预约台给出时间后，核对医生姓名、门牌、现场或视频、new patient visit 类型、到达时间、改约与取消规定。问报价包含什么、是否另有会员费或设施费；这是询问清单，不表示每家都会收。再请保险方核对这次服务的自付安排，不把预约成功当报销承诺。"
      },
      {
        "type": "paragraph",
        "text": "需要专科时，分别追踪 referral 是否发出、所需 authorization 是否完成、接收诊所是否收到资料并可以排期。向两边索取提交日期、接收渠道和缺件说明。“已经转了”不等于有预约；现有照护如何衔接，也要向相关医护人员确认。"
      },
      {
        "type": "heading",
        "text": "第四步：把就诊材料准备成一页索引"
      },
      {
        "type": "checklist",
        "items": [
          "带诊所要求的身份证明和保险资料；提前问旧病历、近期报告与影像如何安全传送，是否需签释放记录授权。",
          "整理药物、非处方药和补充剂名称及剂量，另记已知过敏、主要担忧和三个问题；不要按攻略自行调整药物。",
          "事先申请具体语言的口译；就诊后用自己的话复述下一步，问清结果如何通知、复诊怎么约、非上班时间联系谁。"
        ]
      },
      {
        "type": "heading",
        "text": "约不到：让保险方协助找名额"
      },
      {
        "type": "paragraph",
        "text": "保存打过的诊所、日期、拒收原因与最早可约日，交给 Member Services，请其找合适的服务方。可以问其他地点、取消候补或视频安排；哪种适合你的医疗需要由医护人员确认，不能仅为缩短等待自行更换照护类型。"
      },
      {
        "type": "tip",
        "title": "预约时限不是指定医生的空位承诺",
        "text": "DMHC 对适用计划公布非急诊基层医生 10 个工作日、专科 15 个工作日等标准，并有临床记录支持的例外。具体适用范围、急迫程度和是否需更快安排，向计划或 DMHC 确认；这不是可以安全等待这么久的诊疗判断。"
      },
      {
        "type": "link",
        "title": "查看 DMHC 预约标准和求助渠道",
        "text": "先联系计划；解决不了时向 Help Center 提供尝试记录和当前阻碍。",
        "url": "https://www.dmhc.ca.gov/HealthCareinCalifornia/YourHealthCareRights/TimelyAccesstoCare.aspx"
      },
      {
        "type": "heading",
        "text": "还没有可用保险：同时问保障申请与接诊费用"
      },
      {
        "type": "paragraph",
        "text": "从 Covered California 的 Find an Enroller 按地区、语言找免费申请协助，说明现有保障与搬家情况，让认证人员核对路径、生效日和材料。同时可用 HRSA 查就近 Health Center，问新病人登记、付款方式和费用协助审核。目录收录不代表免费，也不代表已经具备某项资格。"
      },
      {
        "type": "link",
        "title": "按城市或邮编找社区 Health Center",
        "text": "记录可到达的地点，再确认预约、材料、语言和费用；网上没显示名额时向机构问新病人登记。",
        "url": "https://findahealthcenter.hrsa.gov/"
      },
      {
        "type": "heading",
        "text": "费用：把估算、EOB 和正式账单分开"
      },
      {
        "type": "paragraph",
        "text": "有保险时问 copay、deductible 与 coinsurance 如何适用于这次服务；检查和影像也分别核对。自费或不使用保险时，向提供方询问书面 Good Faith Estimate 的适用办法，说明计划接受的服务。这里没有统一看诊价，预计费用也不是最终账单。"
      },
      {
        "type": "paragraph",
        "text": "收到 EOB（Explanation of Benefits）时核对姓名、服务日期、项目和保险处理结果；CMS 明确 EOB 不是账单。将它与提供方账单对应，有差异就问账单部门：哪项待更正、是否仍向保险提交、何时跟进。保存双方记录，不凭一个总额截图判断应付金额。"
      },
      {
        "type": "heading",
        "text": "网络、授权或账单问题解决不了时"
      },
      {
        "type": "paragraph",
        "text": "先向计划提交对应问题的 grievance 并保存回复。DMHC 通常要求先走计划申诉程序，30 天未解决或不满意答复时按官网流程求助；紧急健康问题另有即时协助。DMHC 会核对监管范围，不归其管的计划会转指其他机构。让朋友协助时用官方授权手续，不交出门户密码。"
      },
      {
        "type": "link",
        "title": "打开 DMHC 官方申诉说明",
        "text": "核对流程和材料；Help Center 为 1-888-466-2219，联系前再按官网复核。",
        "url": "https://www.dmhc.ca.gov/FileaComplaint.aspx"
      },
      {
        "type": "template",
        "title": "保存一张“已接上医疗服务”卡",
        "text": "计划与网络：［完整名称］\n基层诊所与医生：［名称／官方电话］\n预约：［日期、地点或视频入口、到达要求］\n尚待完成：［PCP 指派／转诊／授权／病历／口译］\n费用核对：［联系对象与日期］\n结果与复诊：［查看入口和联系人］\n备用联系：［计划医疗咨询／会员服务］\n仅个人保存，不公开证件或会员号码。"
      }
    ]
  },
  {
    "slug": "bay-area-k12-midyear-enrollment-guide",
    "emoji": "🎒",
    "title": "学年中搬来湾区：从旧校档案到孩子第一天报到",
    "subtitle": "把材料审核、学校分配、课程与支持衔接拆成可以追踪的步骤",
    "summary": "给 2026–27 学年中途搬入的家庭一份实操清单：向旧校索取什么、健康材料找谁核验、系统显示提交后还缺哪一步，以及高中学分、语言和学习支持怎样衔接。",
    "category": "newcomer",
    "categoryLabel": "新居民家庭报到",
    "audience": [
      "学年中搬家的 K–12 家庭",
      "从外州或海外转入的学生家庭"
    ],
    "tags": [
      "学年中转入",
      "档案交接",
      "首次报到",
      "健康材料",
      "高中课程衔接"
    ],
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "other"
    ],
    "readMinutes": 10,
    "updatedAt": "2026-10-02",
    "sourceNote": "流程核验于 2026-10-02，重点是当前 2026–27 学年转入。学区边界、材料、健康审核、年级与课程认定均由负责学区处理；下列跟进顺序是编辑建议，不是全湾区统一规则或保证报到期限。",
    "sources": [
      {
        "title": "SFUSD：当前学年申请方式",
        "url": "https://www.sfusd.edu/schools/enroll/apply",
        "description": "2026–27 新生可在学年中申请；区分当前年和下一学年入口。"
      },
      {
        "title": "SFUSD：材料清单与替代证明",
        "url": "https://www.sfusd.edu/schools/enroll/apply/requirements",
        "description": "核对住所、年龄、监护、健康及高中成绩材料，不跨学区套用。"
      },
      {
        "title": "SMFCSD：2026–27 新生注册",
        "url": "https://www.smfcsd.net/district-departments/student-services/enrollment/2026-2027-new-student-registration-process",
        "description": "四步注册、文件核验、独立注册账号及名额满时的安排。"
      },
      {
        "title": "SJUSD：注册、边界版本与完成确认",
        "url": "https://www.sjusd.org/enrollment",
        "description": "当前与未来学年使用不同 locator；工作人员确认后才完成注册。"
      },
      {
        "title": "SMUHSD：高中当前学年入学",
        "url": "https://www.smuhsd.org/departments/student-services/enroll-a-new-student",
        "description": "当前年入口、审核通知、合住表格和材料不足时的联系。"
      },
      {
        "title": "CDPH：学校健康记录与转入常见问题",
        "url": "https://www.cdph.ca.gov/Programs/CID/DCDC/Pages/Immunization/School/laws-requirement-faqs.aspx",
        "description": "由学校核验免疫记录与适用转入规定；不是自行判断接种方案的清单。"
      },
      {
        "title": "CDE：无稳定住所学生的入学资源",
        "url": "https://www.cde.ca.gov/ds/sg/homelessyouth.asp",
        "description": "说明符合条件学生的即时入学与材料障碍，联系学区 liaison 个别评估。"
      },
      {
        "title": "SJUSD：学校健康办公室与表格",
        "url": "https://www.sjusd.org/resources/health-information",
        "description": "向学校健康办公室询问校园用药、健康安排和当地所需表格。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "这篇从“孩子已经在别处上学，我们现在搬来”开始。最终要拿到五项确认：接收学校、第一天到校时间、班级或课表、健康与学习支持联系人、每天接送安排。网上出现 submitted 只是中间状态；不必等下一学年招生才询问当前入学。"
      },
      {
        "type": "heading",
        "text": "先从已有区域指南确认负责学区"
      },
      {
        "type": "list",
        "items": [
          "旧金山、东湾、半岛、南湾和北湾已有各自学校总览；先按完整地址、孩子年级与 2026–27 学年确定招生办公室，再使用本文。兄弟姐妹年级不同，可能由不同学区处理。",
          "说明是新搬入该区、原区内换校，还是想住在区外继续就读。三种情形的表格和批准环节不同；不要替孩子重复建多份身份档案。"
        ]
      },
      {
        "type": "link",
        "title": "先看旧金山学校与学区入口",
        "text": "已有五区总览负责查区和选校；本篇继续处理学年中报到的材料与衔接。",
        "url": "https://www.baylink.us/guides/sf-school-district-enrollment-guide"
      },
      {
        "type": "link",
        "title": "东湾家庭：先找负责地址的学区",
        "text": "从 Alameda 或 Contra Costa 县的官方目录进入，不按城市名推定学校。",
        "url": "https://www.baylink.us/guides/east-bay-school-district-enrollment-guide"
      },
      {
        "type": "link",
        "title": "半岛家庭：分别核对小学与高中学区",
        "text": "不同年级可能需要两套申请与档案交接。",
        "url": "https://www.baylink.us/guides/peninsula-school-district-enrollment-guide"
      },
      {
        "type": "link",
        "title": "南湾家庭：按目标学年核对边界",
        "text": "查清实际负责学区后，再选择对应注册系统。",
        "url": "https://www.baylink.us/guides/south-bay-school-district-enrollment-guide"
      },
      {
        "type": "link",
        "title": "北湾家庭：按县找到招生办公室",
        "text": "Marin、Sonoma、Napa 分别查询，再由具体学区确认。",
        "url": "https://www.baylink.us/guides/north-bay-school-district-enrollment-guide"
      },
      {
        "type": "heading",
        "text": "离开旧校前：先问接收方式，再索取档案"
      },
      {
        "type": "paragraph",
        "text": "联系新学区，问旧校应寄给谁、电子或密封纸本是否接受、是否需要家长签 records release。把新校或学区收件联系人交给旧校 registrar。自己保存一份可读副本用于解释课程与支持；它是否能替代正式档案，由接收方确认。"
      },
      {
        "type": "checklist",
        "items": [
          "学生信息：姓名、出生日期、当前年级、原校名称和联系人；按要求准备出生证明、家长身份与监护关系文件。",
          "学习记录：最近成绩单、正在修读的课程、学期起止与评分说明；高中另问是否需要课程描述、已修学分和当前未结课成绩。",
          "支持记录：已有 IEP、504 计划、语言评估或相关校内支持文件；向接收方问安全传送方式，不公开整份档案。",
          "健康记录：保留原始免疫记录和日期，问是否需要翻译、TB clearance 或当地健康表；由学校健康人员核验。"
        ]
      },
      {
        "type": "paragraph",
        "text": "与两校协调旧校最后出勤日和新校预计开始日，记录交接中的未完成事项。归还设备、图书与办理离校手续按旧校要求处理；如果记录迟迟不到，告诉接收办公室具体缺哪份、旧校联系过谁，要求说明可先做的步骤，而不是自行把开学无限延后。"
      },
      {
        "type": "heading",
        "text": "住址材料：同一份账单不一定通用"
      },
      {
        "type": "paragraph",
        "text": "先拿目标学区当前清单，逐项标记“已有／需补／需问替代”。以 SFUSD 为例，其页面把某些近期文件列为 45 天内，也列出当前有效租约等其他类别，并明确不接受手机账单作为住址证明。这里只说明 SFUSD 的常见卡点，不能把份数、日期或表格要求套到其他学区。"
      },
      {
        "type": "paragraph",
        "text": "合住、住址与证件不一致或缺标准账单时，先找招生人员问学校认可的声明或核验流程。SMUHSD 单列 shared residency／caregiver 表；SFUSD 也说明部分材料无法取得时的宣誓声明。不要把亲友账单直接当本人住所证明，也不要自行改姓名或日期。"
      },
      {
        "type": "heading",
        "text": "三个地区的当前学年提交节点"
      },
      {
        "type": "link",
        "title": "SFUSD：选 2026–27 当前年，再联系招生顾问",
        "text": "可走 ParentVUE，或按页面提交纸本／PDF。学年中需要分配学校时，联系 Enrollment Center：415-241-6085，说明已提交与仍缺材料。",
        "url": "https://www.sfusd.edu/schools/enroll/apply"
      },
      {
        "type": "link",
        "title": "SMFCSD：在线注册后，完成第四步文件核验",
        "text": "Aeries Registration 与已有学生 Parent Portal 是不同账号；记录核验完成才算注册完成。优先期结束不等于学年中不能登记，年级满额时另问分配安排。",
        "url": "https://www.smfcsd.net/district-departments/student-services/enrollment/2026-2027-new-student-registration-process"
      },
      {
        "type": "link",
        "title": "SJUSD：用正确边界版本，等工作人员确认",
        "text": "2026–27 与 2027–28 以后分用 locator。线上交件或到 Enrollment Center 求助后，须完成要求并收到工作人员确认邮件；预约和材料问题可问 408-535-6412。",
        "url": "https://www.sjusd.org/enrollment"
      },
      {
        "type": "paragraph",
        "text": "半岛高中家庭另用 SMUHSD 的 current school year 链接，不要被页面醒目的 2027–28 注册日期带走。Student Services 审核后才邮件确认核验与分配；缺材料可联系 650-558-2251 或 enrollment@smuhsd.org。门户显示成功时，继续问学生是否已经获准参加课程。"
      },
      {
        "type": "heading",
        "text": "健康与学习支持：交给负责人员接续"
      },
      {
        "type": "paragraph",
        "text": "健康文件看不懂或原校还未寄到，联系 school health office，提交现有原始记录并问下一步。CDPH 对转入学生记录追索有专门规则，是否适用由学校核验；不要自己换算海外疫苗名称、补接种次数或宣布可以先上课。需要医疗评估或表格时，请学校说明应联系的合格服务方。"
      },
      {
        "type": "paragraph",
        "text": "孩子在校需要用药、过敏应对或其他健康安排时，提前问校方表格、医护签字及交接方式。SJUSD 健康页提供学校健康联系与相关文件，其他学区使用自己的流程。先确认谁收材料、谁负责日常联系，不能把一张家长便条视为已经完成学校安排。"
      },
      {
        "type": "paragraph",
        "text": "已有 IEP 或 504 计划时，在申请阶段就告知招生办公室，请其连接接收学校的负责团队；列出正在接受的支持、原校联系人和可提供记录。问清开学前谁讨论衔接、第一周如何联系、还需哪些评估。不要仅因新门户没有上传栏就等到问题出现后再提。"
      },
      {
        "type": "paragraph",
        "text": "如实填写 Home Language Survey，说明孩子已学过的语言、原来课程语言以及家长希望使用的沟通语言。问是否有语言评估、何时进行、评估期间如何上课，并保存语言支持联系人。家庭说中文不是替孩子自动选定某个语言项目；具体项目资格另问学区。"
      },
      {
        "type": "heading",
        "text": "高中转入：在第一张课表前做一次课程核对"
      },
      {
        "type": "checklist",
        "items": [
          "约 counselor，带成绩单与正在修读的课程列表，逐项问哪些学分已被接受、哪些还待审核。",
          "把旧校学期结束日、尚未结课科目和考试安排说清楚，问新课表能否接续、是否需要补交成绩。",
          "毕业要求、课程先修和大学申请安排分开核对；不自行把海外课程或 AP／IB 名称等同为当地学分。"
        ]
      },
      {
        "type": "heading",
        "text": "两种卡点：学校满额与暂时没有稳定住所"
      },
      {
        "type": "paragraph",
        "text": "地址对应学校满额时，向招生办公室问可安排的学校、开始日期、候补规则和接送办法。SMFCSD 与 SJUSD 都说明可能安排至有空位的学校；不要把房屋地址或参观经历当作保留座位。记录“现在去哪里上课”和“以后是否等待原校”这两个独立决定。"
      },
      {
        "type": "paragraph",
        "text": "因失去住房、经济困难等暂住他人家、旅馆或其他不稳定住所时，向学区 homeless liaison 描述真实情况。CDE 说明符合条件学生有即时入学等保护，不能简单因缺常规记录就被挡住；是否符合及如何处理由 liaison 协助。不是所有短租或住旅馆家庭都自动属于这一类别。"
      },
      {
        "type": "link",
        "title": "材料与住房障碍：查看 CDE 官方说明",
        "text": "向负责学区索取 liaison 联系方式，提供问题与已有申请记录，避免在公开群发布孩子档案。",
        "url": "https://www.cde.ca.gov/ds/sg/homelessyouth.asp"
      },
      {
        "type": "heading",
        "text": "报到前与第一周：把生活安排接上"
      },
      {
        "type": "checklist",
        "items": [
          "收到工作人员确认后，问第一天到哪个办公室、几点、由谁迎接，家长是否需陪同；保存校历和迟到／缺勤报告方法。",
          "核对接送授权、放学出口、午餐、设备登录与家校消息系统；课后项目单独问名额、收费、减免和结束时间，不把入学当成已获照护名额。",
          "编辑建议在到校后第三天及第一周末各核对一次：课表能用、支持联系人接通、家长收到消息、接送正常。发现缺口交给具体负责人员。"
        ]
      },
      {
        "type": "template",
        "title": "可复制：给招生办公室的进度询问",
        "text": "我们申请的是 2026–27 当前学年［年级］，申请号为［号码］。已提交［材料类型］，尚缺［项目／旧校仍在传送］。请确认下一步由谁处理、可接受的替代材料或协助、是否已完成学校分配，以及第一天报到安排。还需衔接［健康／IEP／语言／高中课程］，请提供负责联系人。敏感文件将只通过贵方指定渠道提交。"
      },
      {
        "type": "paragraph",
        "text": "完成标准是孩子已经有可执行的到校与课程安排，待补件有联系人和下一次跟进日期。保留审核邮件、课表与关键电话，未解决项继续追踪；“填完一次网上表”不是整件事的终点。"
      }
    ]
  },
  {
    "slug": "bay-area-phone-bank-first-bill-guide",
    "emoji": "🧾",
    "title": "新居民手机、银行与第一张账单：开通、实测、取消和争议",
    "subtitle": "把每月真实支出与取消方法问清楚，再把账户接入日常生活",
    "summary": "不排行运营商或银行，而是给出办理材料、套餐标签对照、开户后验证、自动付款区别、首张账单核对与官方投诉分流，解决新来者最常见的账户卡点。",
    "category": "newcomer",
    "categoryLabel": "新居民账户与账单",
    "audience": [
      "刚搬来、准备建立本地账户的人",
      "收到第一张账单或准备换服务的人"
    ],
    "tags": [
      "手机套餐",
      "开户材料",
      "自动付款",
      "取消订阅",
      "账单争议"
    ],
    "priority": "P1",
    "featuredOnHome": false,
    "recommendedForCategories": [
      "other"
    ],
    "readMinutes": 9,
    "updatedAt": "2026-10-02",
    "sourceNote": "官方消费者操作资料查阅于 2026-10-02。本文不推荐金融产品、不保证开户或退款，不给个人法律或财务判断。材料、优惠、取消费用和争议期限以具体机构当前书面条款及主管机构说明为准；示例表格为编辑工具。",
    "sources": [
      {
        "title": "FCC：手机与网络问题官方入口",
        "url": "https://consumercomplaints.fcc.gov/hc/en-us",
        "description": "连接解锁、转号指南及电话、网络的正式投诉；区分投诉与分享经历。"
      },
      {
        "title": "FCC：2026 年 Broadband Labels 更新说明",
        "url": "https://docs.fcc.gov/public/attachments/FCC-26-48A2.pdf",
        "description": "2026 年 7 月官方声明确认标签继续提供价格、促销费率、速度与流量信息。"
      },
      {
        "title": "CPUC：公用服务账单投诉步骤",
        "url": "https://www.cpuc.ca.gov/consumer-support/file-a-complaint/utility-complaint",
        "description": "先找服务方，未解决再准备材料提交 CAB；市营公用服务不在此程序范围。"
      },
      {
        "title": "FDIC：开立支票或储蓄账户的步骤",
        "url": "https://www.fdic.gov/getbanked/pdf/how-to-open-a-bank-account.pdf",
        "description": "身份核验、申请、首笔存款、条款披露和启用账户工具；网上验证可能因刚搬家受阻。"
      },
      {
        "title": "CFPB：自动付款与银行 Bill Pay 的区别",
        "url": "https://www.consumerfinance.gov/ask-cfpb/how-do-automatic-payments-from-a-bank-account-work-en-2021/",
        "description": "区分商家扣款与银行发款，保存授权条款并监控余额。"
      },
      {
        "title": "CFPB：停止自动扣款",
        "url": "https://www.consumerfinance.gov/ask-cfpb/how-do-i-stop-automatic-payments-from-my-bank-account-en-2023/",
        "description": "说明联系商家和银行、书面记录，以及停扣款不等于取消合同。"
      },
      {
        "title": "CFPB：金融产品或服务投诉",
        "url": "https://www.consumerfinance.gov/complaint/",
        "description": "准备事实、文件和希望解决的事项，按产品选择官方提交路径。"
      },
      {
        "title": "FTC：免费试用、自动续费与订阅取消",
        "url": "https://consumer.ftc.gov/articles/getting-and-out-free-trials-auto-renewals-and-negative-option-subscriptions",
        "description": "查看期限、取消方式和保存证据；取消后仍扣款应及时联系发卡机构。"
      }
    ],
    "blocks": [
      {
        "type": "paragraph",
        "text": "新账户最常见的问题，是开通时只记住优惠价，第二个月才发现附加费用；或电话已经能上网，却收不到办事验证码。这里把手机、付款账户和账单放在一起检查，完成标准是服务实际可用、费用有书面依据、取消和求助路径能找到。"
      },
      {
        "type": "heading",
        "text": "先建一个账户记录表，不保存公开可见的敏感号码"
      },
      {
        "type": "checklist",
        "items": [
          "每项服务记录：法律或账单上的公司名、套餐／账户完整名称、开通日、优惠结束日、账单日、到期日和官方客服。",
          "保存订单、价格标签、费用表、合同、授权与取消条款；手机截图要包含日期和套餐名称，不能只留促销大字。",
          "把未完成事项写成下一步：设备兼容未确认、地址验证被拒、折扣未生效或旧账户尚未结清；各自附一个联系人。"
        ]
      },
      {
        "type": "heading",
        "text": "手机与宽带：先看标签，再问套餐以外的费用"
      },
      {
        "type": "paragraph",
        "text": "要求查看该具体网络套餐的 Broadband Facts／Broadband Consumer Label。按 FCC 说明，重点对照基础月价、优惠期后价格、流量与典型速度等项目；自动付款或组合折扣可能另列。把设备分期、语音短信、国际服务、设备租金和一次性开通费再单独问清，不能只比较一个月费数字。"
      },
      {
        "type": "template",
        "title": "同一口径比较两个套餐",
        "text": "套餐：［完整名称］\n优惠期内基础月价：［金额／持续多久］\n优惠结束后的基础月价：［金额］\n设备与其他每月收费：［逐项］\n一次性费用：［开通／安装／运送］\n折扣条件：［自动付款方式／多条线路／其他条件］\n流量、热点、短信与国际使用：［是否包含／超出后怎样收费］\n取消、退设备、剩余分期：［规则］\n按自己的预计使用期汇总，不把一次性费用漏掉。"
      },
      {
        "type": "paragraph",
        "text": "带原手机时，用运营商官方兼容检查并确认解锁状态、实体 SIM 或 eSIM 支持。想保留已有美国号码，先向新运营商核对能否转入及需要的账户资料，再协调旧服务结束；别先主动注销号码。新卡启用后检查来电、拨出、短信和移动数据，确认转号状态及旧线最终账单。"
      },
      {
        "type": "paragraph",
        "text": "编辑建议在退换或试用条件允许的期间，实测住处室内、常去工作／学习地点和日常路线。记录无信号位置、时间与设备；出问题先问技术支持，要求说明是否有其他设置或退换办法。覆盖图和“典型速度”不是对你房间或每班列车的保证。"
      },
      {
        "type": "link",
        "title": "FCC：查看手机指南或选择正式投诉",
        "text": "电话、网络问题按对应分类进入；“Share your story”只是分享经历，不会作为投诉送服务商处理。",
        "url": "https://consumercomplaints.fcc.gov/hc/en-us"
      },
      {
        "type": "heading",
        "text": "银行开户前：向实际机构索取适用材料清单"
      },
      {
        "type": "paragraph",
        "text": "先写明账户用途：收款、日常刷卡、付房租或提取现金，再问机构支持哪些方式、限额和费用。比较月维护费及减免条件、最低开户存款、最低余额、ATM 与转账费用，以及余额不足时怎样处理。这里不按开户奖励推荐银行，也不把有 App 等同为银行账户。"
      },
      {
        "type": "checklist",
        "items": [
          "询问姓名、出生日期、身份证明、当前住所和邮寄地址分别要哪些文件，原件还是电子版，以及是否要预约网点。",
          "如没有 SSN、ITIN 或美国本地证件，直接说明现有文件并问该机构能否接受、还需什么；不要沿用朋友的开户经验或填写不真实号码。",
          "姓名拼写或地址与旧证件不同，带上真实解释与机构认可的补充材料；保留银行给出的补件说明。"
        ]
      },
      {
        "type": "link",
        "title": "FDIC：核对开户六步与材料准备",
        "text": "从身份核验、申请到首笔存款、签署披露文件和启用账户工具；实际材料和批准仍由银行判断。",
        "url": "https://www.fdic.gov/getbanked/pdf/how-to-open-a-bank-account.pdf"
      },
      {
        "type": "paragraph",
        "text": "网上验证失败不一定能从错误提示判断原因。FDIC 提醒刚搬家或无法电子核验地址时，线上方式可能走不通。保存错误代码，向银行问能否在网点或电话完成下一步、需要哪些材料；若申请被拒，索取可提供的原因和后续处理说明，别连续提交彼此不一致的申请。"
      },
      {
        "type": "heading",
        "text": "开户后：验证可用余额与付款方式，再安排自动扣款"
      },
      {
        "type": "paragraph",
        "text": "按银行官方流程启用卡、登录和安全验证，检查通信地址及寄卡状态。首次入账时查看 available balance 与仍在处理中金额，问资金何时可用。用自己本来需要的一笔小额付款验证工具，保存凭证；不能把“转账已发出”当作对方已经收到或可以使用。"
      },
      {
        "type": "paragraph",
        "text": "CFPB 区分两种自动化：商家 automatic debit 是你授权商家来扣；银行 recurring bill-pay 是你授权银行发送付款。记清每笔由谁发起、金额固定还是变化、用哪个账户、何时执行；同时开两种可能重复付款。保存授权，并在账单日前核对可用余额。"
      },
      {
        "type": "heading",
        "text": "第一张账单：按订单逐行核，不只看合计"
      },
      {
        "type": "checklist",
        "items": [
          "对照服务起始日与账期，询问是否包含部分月份、下期预收或一次性费用，不把首账单直接当稳定月费。",
          "核对优惠是否有生效条件、设备款与服务费是否分列、是否增加了自己没选的服务；不清楚就索取书面明细。",
          "记录应付日、实际扣款日与争议联系日；向机构问处理期间该怎样付款、是否有期限，不能假定投诉会自动暂停欠款或断线流程。"
        ]
      },
      {
        "type": "template",
        "title": "可复制：首张账单差异说明",
        "text": "订单／套餐：［名称与开通日］\n账期与争议项目：［日期、项目、金额］\n依据：［订单／价格标签／客服确认］\n差异：［预期与实际，逐项列］\n我希望核实或更正：［具体事项］\n请提供案件号、需要的材料、预计答复方式，以及争议期间付款与期限的说明。敏感号码仅通过官方安全渠道提供。"
      },
      {
        "type": "heading",
        "text": "取消服务、停止自动扣款、退设备分别结项"
      },
      {
        "type": "paragraph",
        "text": "按商家的正式取消方式办理，确认生效日、最后一个账期、设备归还地点和期限、尚余分期或合同费用。保存取消编号、退件收据和追踪信息。免费试用也记结束日和取消步骤；只删 App、拔掉设备或不再使用，不能作为已取消的确认。"
      },
      {
        "type": "paragraph",
        "text": "若需撤回商家从银行账户自动扣款的授权，按 CFPB 指引联系商家和银行，并留下书面记录；银行可能另有 stop payment 表格与费用。停止扣款本身不会终止合同或清除已产生的款项。把“合同已结束”“授权已撤回”“最后账单已处理”列成三项核验。"
      },
      {
        "type": "link",
        "title": "CFPB：按步骤停止自动扣款",
        "text": "选择与实际付款方式相符的流程，保存请求日期，并继续检查是否还有未经许可的扣款。",
        "url": "https://www.consumerfinance.gov/ask-cfpb/how-do-i-stop-automatic-payments-from-my-bank-account-en-2023/"
      },
      {
        "type": "heading",
        "text": "解决不了：按问题类别找官方渠道"
      },
      {
        "type": "paragraph",
        "text": "电话或网络账单、转号、服务问题：先向服务商说明事实和希望更正的项目，再使用 FCC 对应投诉类别。加州受 CPUC 监管的公用服务争议，可按 CAB 流程提交；CPUC 页面明确不处理市营公用服务投诉，遇到这类账单应向该市服务方问处理入口。不要把所有家庭账单都交同一个部门。"
      },
      {
        "type": "link",
        "title": "CPUC：服务方未解决后的投诉步骤",
        "text": "先核对服务是否属于受理范围，再准备账单、往来记录和希望解决的事项。",
        "url": "https://www.cpuc.ca.gov/consumer-support/file-a-complaint/utility-complaint"
      },
      {
        "type": "paragraph",
        "text": "银行账户或付款服务问题先走机构自己的争议流程，及时询问适用期限与书面提交要求；仍需协助可用 CFPB 金融产品投诉入口。订阅取消后持续收费，按 FTC 建议联系发卡机构并保存取消证据。投诉不是退款保证，也不替代向银行及时报告交易问题。"
      },
      {
        "type": "link",
        "title": "CFPB：提交金融产品或服务投诉",
        "text": "按事实时间线提交，列清文件与希望的处理；使用官方系统，不把完整账户资料发到社区帖。",
        "url": "https://www.consumerfinance.gov/complaint/"
      },
      {
        "type": "paragraph",
        "text": "一个账户真正接入生活的标准：电话能完成所需联系，付款工具已验证，稳定月费和优惠结束日已记下，首张账单核对过，旧服务与设备有结束凭证。把这张记录表留到第二个账期再复核一次，后续换服务可以继续复用。"
      }
    ]
  }
];
