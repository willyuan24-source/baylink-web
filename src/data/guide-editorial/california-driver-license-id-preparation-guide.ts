import type { GuideEditorial } from './types';

// Facts from the article. CNT-GUIDES read the DMV license, fee ($46), learner's-permit (80%, 4:30 p.m.), handbook, Chinese
// practice-test and senior-driver pages (appointment, other-language test + signs test) on 2026-10-12. Vehicle Code 12505: 2026-10-04.
export const driverLicenseEditorial: GuideEditorial = {
  slug: 'california-driver-license-id-preparation-guide',
  cover: {
    question: { zh: '刚到加州，驾照怎么办？', en: 'New to California? Sorting out a license?' },
    title: { zh: '先分清申请类型，再整理材料', en: 'Pick the right application, then the documents' },
    answer: { zh: '驾照、ID、REAL ID 是三件事', en: 'License, ID and REAL ID are different' },
    line: { zh: '首次 · 外州 · 外国驾照 · 只办 ID', en: 'First-time · out-of-state · foreign license · ID only' },
  },
  keyFacts: [
    { label: { zh: '先选类型', en: 'Choose the card' }, value: { zh: 'ID 不能用来开车；REAL ID 不免驾照考试', en: 'An ID is not a license; REAL ID does not skip the tests' }, source: 2 },
    { label: { zh: '首次申请费', en: 'First license fee' }, value: { zh: 'C 类驾照 $46，申请 12 个月内有效', en: 'Class C $46; the application is valid 12 months' }, source: 14 },
    { label: { zh: '笔试', en: 'Knowledge test' }, value: { zh: '要预约；答对 80% 通过，每科最多考 3 次', en: 'By appointment; 80% passes, up to 3 tries per test' }, source: 15 },
    { label: { zh: '中文准备', en: 'Study in Chinese' }, value: { zh: '中文驾驶手册和中文 C 类练习题；外语笔试加考交通标志', en: 'Chinese handbook and Chinese Class C practice tests; a test in another language adds a signs test' }, source: 16 },
    { label: { zh: '新居民', en: 'New residents' }, value: { zh: '外州驾照最多再开 10 天；外州车辆 20 天内登记', en: 'Out-of-state license for at most 10 more days; register the car within 20 days' }, source: 6 },
  ],
  slides: [
    { kind: 'compare', kicker: { zh: '按原有驾照分流', en: 'By the license you have' }, title: { zh: '四种情况，四条路', en: 'Four situations, four routes' },
      items: [
        { zh: '从未持有驾照：先办学习许可，再约路考', en: "Never licensed: an instruction permit first, then the drive test" },
        { zh: '美国其他州驾照：外州换证，考视力和笔试', en: 'Another U.S. state: transfer, with vision and knowledge tests' },
        { zh: '外国驾照：同样申请，另加路考', en: 'Foreign license: the same application plus a drive test' },
        { zh: '只办 ID：不需要驾驶考试', en: 'ID only: no driving test' },
      ], source: 1 },
    { kind: 'checklist', kicker: { zh: '首次申请', en: 'First application' }, title: { zh: '费用、预约和笔试', en: 'Fee, appointment, knowledge test' },
      items: [
        { zh: '申请费 $46，12 个月内有效', en: 'Fee $46, valid 12 months' },
        { zh: '网上填表，再预约到 DMV', en: 'Start online, then book a DMV visit' },
        { zh: '笔试答对 80% 通过，每科最多 3 次', en: '80% passes, up to 3 tries per test' },
        { zh: '下午 4:30 以后不安排笔试', en: 'No knowledge tests after 4:30 p.m.' },
      ], source: 14 },
    { kind: 'point', kicker: { zh: '中文准备', en: 'Study in Chinese' }, title: { zh: '中文手册和练习题', en: 'Chinese handbook and practice tests' },
      body: { zh: 'DMV 有中文版驾驶手册和中文 C 类练习题。现场笔试有多种语言，用外语考要加考交通标志；预约时说明想用中文考。', en: 'DMV has the handbook and Class C practice tests in Chinese. In-person tests come in many languages, and a test in another language adds a traffic signs test; say you want Chinese when you book.' }, source: 17 },
    { kind: 'point', kicker: { zh: '期限', en: 'Deadlines' }, title: { zh: '三个期限分开算', en: 'Three separate clocks' },
      items: [
        { zh: '10 天：新居民依原豁免最多再驾驶', en: '10 days: driving under the old exemption as a new resident' },
        { zh: '20 天：外州车辆迁入登记', en: '20 days: registering an out-of-state car' },
        { zh: '10 天：已有加州记录的地址变更通知', en: '10 days: telling DMV about a new address on an existing record' },
      ], source: 6 },
    { kind: 'point', kicker: { zh: '住址材料', en: 'Proof of address' }, title: { zh: '要几份，看卡种', en: 'How many depends on the card' },
      items: [
        { zh: '普通驾照或 ID：至少一份合格住址文件', en: 'Standard license or ID: at least one accepted document' },
        { zh: 'REAL ID：两份不同的打印文件', en: 'REAL ID: two different printed documents' },
        { zh: '姓名不一致：准备衔接证明', en: 'Name differs: bring the linking document' },
      ], source: 9 },
    { kind: 'checklist', kicker: { zh: '预约前', en: 'Before your visit' }, title: { zh: '文件夹检查一遍', en: 'Check your folder' },
      items: [
        { zh: '业务入口选对：首次、换州、外国驾照、ID 或续补', en: 'The right service: first-time, out-of-state, foreign, ID or renewal' },
        { zh: '材料符合所选卡种清单', en: 'Documents match the checklist for your card' },
        { zh: '知识考试用 DMV 当前驾驶手册准备', en: "Study with DMV's current driver handbook" },
      ] },
  ],
  steps: [
    { zh: 'ID 证明身份但不能开车；REAL ID 不免驾照考试。先决定要哪一种。', en: 'An ID proves identity but is not a license; REAL ID does not skip the tests. Decide which you need.' },
    { zh: '按原有驾照选流程：外国驾照要路考，外州驾照也要考视力和笔试。', en: 'Choose by the license you hold: a foreign license needs a drive test; an out-of-state one still has vision and knowledge tests.' },
    { zh: '首次申请费 $46；预约到 DMV 考笔试，答对 80% 通过，每科最多 3 次；可先做中文练习题。', en: 'The first license costs $46; book a DMV visit for the knowledge test, 80% passes, up to 3 tries per test; practice in Chinese first.' },
    { zh: '新居民最多再用外州驾照开 10 天；外州车辆 20 天内办加州登记。', en: 'New residents may drive on an out-of-state license for at most 10 more days; register the car within 20 days.' },
    { zh: 'REAL ID 需要两份住址文件，姓名与申请表一致；普通驾照一份即可。', en: 'REAL ID needs two proofs of address with your name as on the application; a standard license needs one.' },
    { zh: '预约前核对业务类型、材料清单和考试准备。', en: 'Before the appointment, check the service, the document list and test preparation.' },
  ],
};
