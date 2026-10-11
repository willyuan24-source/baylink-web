import type { GuideEditorial } from './types';

// Facts from the article (re-checked 2026-10-04): California DMV pages and Vehicle Code 12505 in its sources.
export const driverLicenseEditorial: GuideEditorial = {
  slug: 'california-driver-license-id-preparation-guide',
  cover: {
    question: { zh: '刚到加州，驾照怎么办？', en: 'New to California? Sorting out a license?' },
    title: { zh: '先分清申请类型，再整理材料', en: 'Pick the right application, then the documents' },
    answer: { zh: '驾照、ID、REAL ID 是三件事', en: 'License, ID and REAL ID are different' },
    line: { zh: '首次 · 外州 · 外国驾照 · 只办 ID', en: 'First-time · out-of-state · foreign license · ID only' },
  },
  keyFacts: [
    { label: { zh: '先选类型', en: 'Choose the card' }, value: { zh: 'ID 能证明身份但不能用来开车；REAL ID 不免除驾照考试', en: 'An ID proves identity but not driving; REAL ID does not replace license tests' }, source: 2 },
    { label: { zh: '外国驾照', en: 'Foreign license' }, value: { zh: '要通过驾驶考试，不能默认直接换证', en: 'You must pass a driving test; it is not a simple swap' }, source: 1 },
    { label: { zh: '新居民开车', en: 'Driving as a new resident' }, value: { zh: '建立加州居住地后，依原豁免最多再驾驶 10 天', en: 'Up to 10 more days of driving under the old exemption after you become a resident' }, source: 6 },
    { label: { zh: '外州车辆', en: 'Out-of-state car' }, value: { zh: '成为居民或把车带入加州后 20 天内登记', en: 'Register within 20 days of becoming a resident or bringing the car in' }, source: 7 },
    { label: { zh: '住址材料', en: 'Proof of address' }, value: { zh: '普通驾照至少一份；REAL ID 需要两份', en: 'At least one for a standard license; two for REAL ID' }, source: 9 },
  ],
  slides: [
    { kind: 'compare', kicker: { zh: '按原有驾照分流', en: 'By the license you have' }, title: { zh: '四种情况，四条路', en: 'Four situations, four routes' },
      items: [
        { zh: '从未持有驾照：先办成人学习许可', en: "Never licensed: start with an adult learner's permit" },
        { zh: '美国其他州驾照：外州章节，视力与知识考试', en: 'Another U.S. state: the out-of-state section, vision and knowledge tests' },
        { zh: '外国驾照：要通过驾驶考试', en: 'Foreign license: a driving test is required' },
        { zh: '只办 ID：不需要驾驶考试', en: 'ID only: no driving test' },
      ], source: 1 },
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
    { zh: 'ID 证明身份但不能开车；REAL ID 不免除驾照考试。先决定要哪一种。', en: 'An ID proves identity but is not a license; REAL ID does not skip the tests. Decide which you need.' },
    { zh: '按原有驾照选章节：外国驾照要路考，外州驾照也有视力与知识考试。', en: 'Choose by the license you hold: a foreign license needs a driving test; an out-of-state one still has vision and knowledge tests.' },
    { zh: 'REAL ID 需要两份住址打印文件，姓名与申请表一致。', en: 'REAL ID needs two printed proofs of address with your name as on the application.' },
    { zh: 'AB 60 是单独的驾照路径，不等于 REAL ID；身份问题交给 DMV 判断。', en: 'AB 60 is a separate license path, not REAL ID; let DMV decide identity questions.' },
    { zh: '预约前核对业务入口、材料清单和考试准备。', en: 'Before the appointment, check the service, the document list and test preparation.' },
    { zh: '把不确定项写成两三个具体问题，结束后保存收据和补件说明。', en: 'Turn doubts into two or three specific questions; keep receipts and any follow-up notes.' },
  ],
};
