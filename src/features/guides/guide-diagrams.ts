/**
 * H22 (SV13-03, GR-10): simple diagrams for the eight pilot guides (senior services + the seven paperwork pillars), so a phone
 * reader meets a picture at least every two screens. Coded diagrams, labelled 示意图 / Diagram: no photos of real cards, no AI
 * pictures, nothing that looks like an agency's own form. Every figure, phone number, date and amount below is printed in the
 * guide's own text (src/data/guides-*.ts) and the `source` index is the guide's source it cites there; a diagram restates the
 * article, it never adds a fact (tests/guide-diagrams.test.ts checks every number against the article).
 * Build-time data: scripts/generate-guide-data.ts puts each guide's diagrams in its own record, so no other page loads them.
 */
export type DiagramCopy = { zh: string; en: string };
export type DiagramItem = { title: DiagramCopy; text?: DiagramCopy; number?: string; tel?: string };
export type GuideDiagram =
  /** Two to four steps in order, arrows between them. */
  | { kind: 'flow'; title: DiagramCopy; steps: readonly DiagramItem[]; source?: number }
  /** Two or three things side by side that readers mix up. */
  | { kind: 'compare'; title: DiagramCopy; columns: readonly DiagramItem[]; footer?: DiagramCopy; source?: number }
  /** Marks along a line: ages, months or days. `total` names the whole span. */
  | { kind: 'timeline'; title: DiagramCopy; marks: readonly DiagramItem[]; total?: DiagramCopy; source?: number; scale?: { count: number; highlight: number } }
  /** The Bay Area counties as tiles in their rough places, each with its number (not to scale). */
  | { kind: 'map'; title: DiagramCopy; tiles: readonly (DiagramItem & { area: string })[]; footer?: DiagramCopy; source?: number };
/** Where a diagram goes: `lead` = after 30 秒看懂 (before the contact cards); a number = inside that step card (H2 order, 1-based). */
export type PlacedDiagram = { at: 'lead' | number; diagram: GuideDiagram };

const c = (zh: string, en: string): DiagramCopy => ({ zh, en });

export const GUIDE_DIAGRAMS: Readonly<Record<string, readonly PlacedDiagram[]>> = {
  'bay-area-chinese-senior-services-referral-guide': [
    { at: 'lead', diagram: { kind: 'flow', title: c('第一次打电话：先说清三件事，再问机构', 'First call: say three things, then ask'), steps: [
      { title: c('住在哪个县', 'Which county'), text: c('各县有自己的老龄机构 AAA', 'Each county has its own AAA') },
      { title: c('用什么语言', 'Which language'), text: c('普通话、粤语或口译', 'Mandarin, Cantonese or an interpreter') },
      { title: c('要哪种帮助', 'What help'), text: c('活动、餐食、探访或白天照护', 'Activities, meals, visits or day care') },
      { title: c('再问机构能做什么', 'Then ask what they can do'), text: c('服务区域、条件、费用和候补', 'Area, eligibility, cost and waitlist') },
    ] } },
    { at: 2, diagram: { kind: 'map', title: c('各县 AAA 电话', 'County AAA phone lines'), source: 1, footer: c('全州信息线 800-510-2020 · 图中位置示意，不按比例', 'Statewide line 800-510-2020 · positions are rough, not to scale'), tiles: [
      { area: 'sonoma', title: c('索诺玛', 'Sonoma'), number: '707-565-4636', tel: '+17075654636' },
      { area: 'napa', title: c('纳帕／索拉诺', 'Napa/Solano'), number: '707-784-8960', tel: '+17077848960' },
      { area: 'marin', title: c('马林', 'Marin'), number: '415-473-4636', tel: '+14154734636' },
      { area: 'contra', title: c('康特拉科斯塔', 'Contra Costa'), number: '925-229-8434', tel: '+19252298434' },
      { area: 'sf', title: c('旧金山', 'San Francisco'), number: '415-355-3555', tel: '+14153553555' },
      { area: 'alameda', title: c('阿拉米达', 'Alameda'), number: '510-577-1900', tel: '+15105771900' },
      { area: 'smateo', title: c('圣马特奥', 'San Mateo'), number: '844-868-0938', tel: '+18448680938' },
      { area: 'sclara', title: c('圣克拉拉', 'Santa Clara'), number: '408-350-3200', tel: '+14083503200' },
    ] } },
    { at: 4, diagram: { kind: 'compare', title: c('安老自助处的三种餐食', 'Three meal programs at Self-Help for the Elderly'), source: 3, columns: [
      { title: c('到中心吃饭', 'Meals at a center'), text: c('能出门的长者', 'For seniors who can get out') },
      { title: c('送餐上门', 'Home-delivered meals'), text: c('难离家的长者', 'For seniors who cannot leave home easily') },
      { title: c('CHAMPSS 餐厅计划', 'CHAMPSS restaurant program'), text: c('第三种餐食项目', 'The third meal program') },
    ], footer: c('都先问：地址在不在覆盖区、怎样登记、要不要候补', 'Ask each: is the address covered, how to sign up, is there a waitlist') } },
  ],
  'bay-area-medicare-hicap-medi-cal-guide': [
    { at: 'lead', diagram: { kind: 'compare', title: c('两张不同的卡，分开申请', 'Two different cards, two applications'), columns: [
      { title: c('Medicare', 'Medicare'), text: c('联邦医保，通常从 65 岁开始', 'Federal health insurance, usually from 65') },
      { title: c('Medi-Cal', 'Medi-Cal'), text: c('加州的 Medicaid，看收入和资产，免费或低成本', 'California’s Medicaid: by income and assets, free or low cost') },
    ], footer: c('符合条件的人可以两样都有', 'People who qualify can have both') } },
    { at: 1, diagram: { kind: 'flow', title: c('HICAP 免费咨询三步', 'Free HICAP counseling in three steps'), source: 1, steps: [
      { title: c('打电话预约', 'Call to book'), number: '1-800-434-0222', tel: '+18004340222', text: c('或按居住县找办公室', 'or find your county office') },
      { title: c('说明要中文', 'Ask for Chinese'), text: c('或要求口译；家属可以一起来', 'or an interpreter; family can come') },
      { title: c('带上资料', 'Bring your papers'), text: c('保险卡、报名或续保信、医生名单、药名和剂量', 'Insurance cards, enrollment letters, your doctors, drug names and doses') },
    ] } },
    { at: 2, diagram: { kind: 'timeline', title: c('首次报名期：共 7 个月', 'Initial enrollment: 7 months in all'), source: 2, scale: { count: 7, highlight: 4 }, total: c('错过又没有其他符合条件的保险：Part B 通常每晚一年保费多 10%', 'Missed with no other qualifying cover: Part B usually costs 10% more for each year late'), marks: [
      { title: c('生日月前 3 个月', '3 months before'), text: c('报名期开始', 'Window opens') },
      { title: c('65 岁生日月', 'Your 65th birthday month'), text: c('7 个月里的第 4 个月', 'Month 4 of the 7') },
      { title: c('生日月后 3 个月', '3 months after'), text: c('报名期结束', 'Window closes') },
    ] } },
  ],
  'bay-area-dental-care-insurance-low-cost-guide': [
    { at: 'lead', diagram: { kind: 'compare', title: c('看牙要问的是牙科保障', 'For dental care, ask about dental cover'), source: 1, columns: [
      { title: c('Medicare（多数情况）', 'Medicare (in most cases)'), text: c('不付洗牙、补牙、拔牙、假牙和种植牙', 'Does not pay for cleanings, fillings, extractions, dentures or implants') },
      { title: c('牙科计划或 Medicare Advantage', 'A dental plan or Medicare Advantage'), text: c('按具体项目问保障、自付额和年度上限', 'Ask item by item: cover, deductible and yearly maximum') },
    ] } },
    { at: 2, diagram: { kind: 'flow', title: c('有 Medi-Cal，这样找牙医', 'With Medi-Cal, find a dentist this way'), source: 2, steps: [
      { title: c('查 DHCS 牙医目录', 'Search the DHCS dentist directory'), text: c('按县查，只看接收新病人，可筛普通话、粤语', 'By county, new patients only, Mandarin or Cantonese filter') },
      { title: c('打电话问诊所', 'Call the office'), text: c('问清接不接新病人', 'Ask if they take new patients') },
      { title: c('还是找不到', 'Still none?'), number: '1-800-322-6384', tel: '+18003226384', text: c('牙科服务中心，周一到周五 8–17 点，可要口译', 'Medi-Cal Dental, Mon–Fri 8 am–5 pm, interpreters available') },
    ] } },
    { at: 3, diagram: { kind: 'compare', title: c('两条低费路径，规则不同', 'Two low-cost routes with different rules'), columns: [
      { title: c('NEMS 东北医疗中心', 'NEMS'), text: c('按收入分级减费，最多收全价；减费资格每年重新登记', 'Sliding fee by income, never above full price; renew every year') },
      { title: c('UCSF 学生诊所', 'UCSF student clinic'), text: c('接收 Denti-Cal，费用较低，耗时更长、常要多次预约', 'Takes Denti-Cal; lower cost, longer visits, often several appointments') },
    ] } },
  ],
  'bay-area-social-security-retirement-preparation-guide': [
    { at: 'lead', diagram: { kind: 'compare', title: c('三样分开问', 'Three things, asked separately'), columns: [
      { title: c('社安退休金', 'Social Security retirement'), text: c('看你缴社安税的工作记录', 'Based on your work record of Social Security taxes') },
      { title: c('SSI', 'SSI'), text: c('收入和资源有限，年满 65 岁或残障／失明', 'Limited income and resources; 65 or older, disabled or blind') },
      { title: c('401(k)／IRA', '401(k) / IRA'), text: c('另外的退休账户，另有规则', 'Separate retirement accounts with their own rules') },
    ] } },
    { at: 2, diagram: { kind: 'flow', title: c('40 个工作积分怎么来', 'How the 40 work credits add up'), source: 1, steps: [
      { title: c('每 $1,890 收入记 1 个', '1 credit per $1,890 earned'), text: c('2026 年的标准', 'The 2026 amount') },
      { title: c('每年最多 4 个', 'At most 4 a year'), text: c('全年 $7,560 拿满 4 个', '$7,560 in a year earns all 4') },
      { title: c('满 40 个可按本人记录领', '40 credits to claim on your own record'), text: c('积分只决定能不能领，不决定领多少', 'Credits decide whether, not how much') },
    ] } },
    { at: 3, diagram: { kind: 'timeline', title: c('什么时候开始领', 'When to start'), total: c('1960 年及以后出生的人适用', 'For people born in 1960 or later'), marks: [
      { title: c('62 岁', 'Age 62'), text: c('最早可领，每月金额降低', 'Earliest; smaller monthly amount') },
      { title: c('67 岁', 'Age 67'), text: c('完全退休年龄', 'Full retirement age') },
      { title: c('70 岁', 'Age 70'), text: c('延后增额到此为止', 'Delay credits stop here') },
    ] } },
  ],
  'bay-area-naturalization-official-path-guide': [
    { at: 1, diagram: { kind: 'compare', title: c('入籍年限：先看自己走哪条路', 'Years as a green-card holder: which path'), source: 1, columns: [
      { title: c('一般申请人', 'Most applicants'), text: c('永久居民满 5 年', '5 years as a permanent resident') },
      { title: c('美国公民的配偶', 'Spouse of a US citizen'), text: c('满 3 年，另看婚姻和共同生活等条件', '3 years, plus marriage and living-together rules') },
    ], footer: c('都要年满 18 岁；连续居住、实际在美天数和品行逐项看', 'Both: age 18 or older; continuous residence, days in the US and good moral character') } },
    { at: 3, diagram: { kind: 'compare', title: c('考哪一版，看 N-400 递交日期', 'Which civics test depends on your N-400 filing date'), columns: [
      { title: c('2025 版', '2025 test'), text: c('2025 年 10 月 20 日或以后递交：128 题中问 20 题，答对 12 题通过', 'Filed on or after Oct 20, 2025: 20 of 128 questions, pass with 12') },
      { title: c('2008 版', '2008 test'), text: c('在此之前递交：100 题中最多问 10 题，答对 6 题通过', 'Filed earlier: up to 10 of 100 questions, pass with 6') },
    ] } },
  ],
  'bay-area-free-tax-help-vita-calfile-guide': [
    { at: 'lead', diagram: { kind: 'compare', title: c('两种免费报税帮助', 'Two kinds of free tax help'), source: 1, columns: [
      { title: c('VITA', 'VITA'), text: c('年收入约 $70,244 或以下、残障人士、英语不流利的纳税人', 'Income about $70,244 or less, people with disabilities, limited English speakers') },
      { title: c('TCE', 'TCE'), text: c('侧重 60 岁及以上长者的退休金和退休相关税务', 'Focused on people 60 and older: pensions and retirement tax questions') },
    ], footer: c('两项都免费，由 IRS 认证的志愿者帮你报税', 'Both are free, done by IRS-certified volunteers') } },
    { at: 2, diagram: { kind: 'compare', title: c('联邦税和加州税，分开报', 'Federal and California returns are filed separately'), source: 3, columns: [
      { title: c('联邦税', 'Federal return'), text: c('在 IRS 申报', 'Filed with the IRS') },
      { title: c('加州税', 'California return'), text: c('用 FTB 的 CalFile，完全免费；接受 2023、2024 和 2025 税务年度', 'FTB CalFile, completely free; tax years 2023, 2024 and 2025') },
    ] } },
  ],
  'california-tenant-deposit-rights-help-guide': [
    { at: 1, diagram: { kind: 'timeline', title: c('押金：搬出以后', 'Your deposit after you move out'), source: 3, total: c('多数房东：押金最多一个月房租（2024 年 7 月 1 日起）', 'Most landlords: a deposit of at most one month’s rent (from July 1, 2024)'), marks: [
      { title: c('搬出', 'Move out'), text: c('保存照片、钥匙交接日期和转寄地址', 'Keep photos, key hand-over date and a forwarding address') },
      { title: c('21 天内', 'Within 21 days'), text: c('退还全部押金，或余款加逐项扣款清单；超过 $125 附收据', 'Full deposit back, or the rest with an itemized list; receipts for items over $125') },
      { title: c('修完后 14 天内', '14 days after repairs'), text: c('21 天内没修完的，先给估价，再补收据', 'If repairs were not done in 21 days: an estimate first, receipts later') },
    ] } },
    { at: 3, diagram: { kind: 'compare', title: c('找对入口', 'The right place to go'), columns: [
      { title: c('受保护身份的歧视、报复', 'Discrimination or retaliation'), number: '800-884-1684', tel: '+18008841684', text: c('加州民权局 CRD', 'California Civil Rights Department') },
      { title: c('一般押金、维修、房租纠纷', 'Ordinary deposit, repair or rent disputes'), text: c('当地租务机构、法院自助中心或法律援助', 'Local rent office, court self-help center or legal aid') },
    ] } },
  ],
  'california-driver-license-id-preparation-guide': [
    { at: 1, diagram: { kind: 'compare', title: c('先决定要哪一种卡', 'First decide which card you need'), columns: [
      { title: c('ID', 'ID card'), text: c('只证明身份或年龄，开车要驾照', 'Proves identity or age only; driving needs a license') },
      { title: c('驾照', 'Driver license'), text: c('要开车，走驾照流程和考试', 'To drive: the license process and tests') },
      { title: c('REAL ID', 'REAL ID'), text: c('国内航班可用的卡种；不免驾照考试', 'Works for domestic flights; does not skip driving tests') },
    ] } },
    { at: 2, diagram: { kind: 'flow', title: c('按原有驾照选流程', 'Your route depends on the license you have'), source: 1, steps: [
      { title: c('没有任何驾照', 'No license anywhere'), text: c('学习许可 → 笔试 → 练车 → 路考', 'Instruction permit → knowledge test → practice → drive test') },
      { title: c('美国其他州驾照', 'Another US state'), text: c('换证：考视力和笔试', 'Transfer: vision and knowledge tests') },
      { title: c('外国驾照', 'Another country'), text: c('按外州流程申请，另加路考', 'Apply as from another state, plus a drive test') },
      { title: c('只办 ID', 'ID only'), text: c('核验身份、拍照，不考驾驶', 'Identity check and photo, no driving test') },
    ] } },
    { at: 4, diagram: { kind: 'timeline', title: c('新居民的两个期限', 'Two deadlines for new residents'), marks: [
      { title: c('成为加州居民', 'You become a resident'), text: c('在加州定居，不是到达当天自动起算', 'Settling in California, not the day you arrive') },
      { title: c('10 天', '10 days'), text: c('最多再用外州驾照开 10 天', 'Drive on your out-of-state license for at most 10 more days') },
      { title: c('20 天', '20 days'), text: c('外州自用车办加州登记', 'Register your out-of-state car in California') },
    ] } },
    { at: 5, diagram: { kind: 'compare', title: c('住址文件要几份', 'How many proofs of address'), columns: [
      { title: c('REAL ID', 'REAL ID'), text: c('1 份身份文件 + 2 份不同的住址文件', '1 identity document + 2 different proofs of address') },
      { title: c('普通驾照', 'Standard license'), text: c('1 份合格的住址文件', '1 acceptable proof of address') },
    ] } },
  ],
};
