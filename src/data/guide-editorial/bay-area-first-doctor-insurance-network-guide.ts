import type { GuideEditorial } from './types';

// Facts from the article (official entry points checked 2026-10-02: DMHC, CMS, UCSF Health, SCVMC, Covered California, HRSA).
// The 医疗保险 topic pillar for newcomers: know your plan, book with three clinics, keep both sides' confirmations.
export const firstDoctorEditorial: GuideEditorial = {
  slug: 'bay-area-first-doctor-insurance-network-guide',
  cover: {
    question: { zh: '刚搬来，第一次找医生？', en: 'New here and need a first doctor?' },
    title: { zh: '先认准自己的保险计划，再约医生', en: 'Know your exact plan, then book' },
    answer: { zh: '急症打 911；非急诊先查网络', en: 'Emergency: 911; otherwise check your network' },
    line: { zh: '保险网络 · 新病人 · 转诊 · 账单', en: 'Network · new patients · referrals · bills' },
  },
  keyFacts: [
    { label: { zh: '紧急情况', en: 'Emergencies' }, value: { zh: '拨 911；拿不准时打保险卡上的医疗咨询电话', en: 'Call 911; if unsure, call the nurse line on your insurance card' } },
    { label: { zh: '先问保险方', en: 'Ask your plan first' }, value: { zh: '用哪个网络、要不要先选 PCP 或 medical group', en: 'Which network, and whether you must pick a PCP or medical group' } },
    { label: { zh: '预约时限', en: 'Wait-time standards' }, value: { zh: 'DMHC：非急诊基层 10 个工作日，专科 15 个工作日', en: 'DMHC: 10 business days for non-urgent primary care, 15 for specialists' }, source: 2 },
    { label: { zh: '解决不了', en: 'Still stuck' }, value: { zh: '先向计划申诉；DMHC Help Center 1-888-466-2219', en: 'File a grievance with the plan; DMHC Help Center 1-888-466-2219' }, source: 3 },
    { label: { zh: '还没保险', en: 'No coverage yet' }, value: { zh: 'Covered California 找免费申请协助；HRSA 查社区 Health Center', en: 'Free enrollment help through Covered California; community health centers via HRSA' }, source: 7 },
  ],
  contacts: [
    { name: { zh: 'DMHC Help Center', en: 'DMHC Help Center' }, number: '1-888-466-2219', tel: '+18884662219',
      note: { zh: '先走计划申诉；网络、授权或账单问题解决不了时再联系。', en: 'Go through the plan grievance first; call when network, authorization or billing problems stay unsolved.' }, source: 3 },
    { name: { zh: 'Santa Clara Valley Medical Center 预约与咨询', en: 'Santa Clara Valley Medical Center appointments' }, number: '888-334-1000', tel: '+18883341000',
      note: { zh: '南湾示例；账单和财务协助另有号码。', en: 'A South Bay example; billing and financial help have their own numbers.' }, source: 6 },
  ],
  slides: [
    { kind: 'checklist', kicker: { zh: '第一步', en: 'Step 1' }, title: { zh: '把自己的计划认准', en: 'Know your exact plan' },
      items: [
        { zh: '保险卡正反面、会员号、计划完整名称、生效日期', en: 'Both sides of the card, member number, full plan name, start date' },
        { zh: '卡上有没有指定 PCP 或 medical group', en: 'Whether the card names a PCP or medical group' },
        { zh: '成人还是儿科、语言、能去的城市和时段', en: 'Adult or pediatric, language, reachable cities and times' },
      ] },
    { kind: 'point', kicker: { zh: '第二步', en: 'Step 2' }, title: { zh: '从目录筛三家，逐家打电话', en: 'Shortlist three clinics and call each' },
      items: [
        { zh: '在不在你的网络', en: 'In your network?' },
        { zh: '收不收新病人', en: 'Taking new patients?' },
        { zh: '最早实际能约哪天', en: 'Earliest real appointment?' },
      ] },
    { kind: 'compare', kicker: { zh: '预约标准', en: 'Wait-time standards' }, title: { zh: 'DMHC 公布的时限', en: "DMHC's standards" },
      items: [
        { zh: '非急诊基层医生：10 个工作日', en: 'Non-urgent primary care: 10 business days' },
        { zh: '非急诊专科：15 个工作日', en: 'Non-urgent specialist: 15 business days' },
      ], body: { zh: '这是计划的标准，不是某位医生的空位承诺，也不是可以安全等待的诊疗判断。', en: "These are plan standards, not a promise of a slot with one doctor, and not medical advice that waiting is safe." }, source: 2 },
    { kind: 'point', kicker: { zh: '费用', en: 'Costs' }, title: { zh: 'EOB 不是账单', en: 'An EOB is not a bill' },
      body: { zh: '收到 EOB 时核对姓名、日期、项目和保险处理结果，再和诊所账单对应；有差异就问账单部门。', en: "Check the name, date, services and the plan's decision on the EOB, then match it to the clinic's bill; ask billing about any difference." }, source: 4 },
  ],
  steps: [
    { zh: '准备保险卡、会员号和计划全名，先问保险方用哪个网络、要不要先选 PCP。', en: 'Have the card, member number and full plan name; ask the plan which network applies and whether to pick a PCP.' },
    { zh: '从保险目录筛三家，逐家问网络、新病人和最早可约日期。', en: 'Shortlist three clinics from the directory and ask each about network, new patients and the earliest date.' },
    { zh: '预约和保险两边都要确认；转诊和授权分别追踪。', en: 'Confirm with both the clinic and the plan; track referrals and authorizations separately.' },
  ],
};
