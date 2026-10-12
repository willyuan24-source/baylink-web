import type { GuideEditorial } from './types';

// Facts from the article (California State Parks, City of Half Moon Bay and National Weather Service pages in its sources,
// checked 2026-09-08). The 周末出游 topic pillar: one clear entrance, an out-and-back trail, sea safety.
export const halfMoonBayEditorial: GuideEditorial = {
  slug: 'half-moon-bay-coastal-half-day-guide',
  cover: {
    question: { zh: '想去海边走半天，不想赶？', en: 'Half a day by the sea, no rushing?' },
    title: { zh: '从 Francis Beach 出发，走累了就回头', en: 'Start at Francis Beach and turn back when you like' },
    answer: { zh: '入口：95 Kelly Avenue', en: 'Entrance: 95 Kelly Avenue' },
    line: { zh: '铺装步道 · 原路返回 · 先看海况', en: 'Paved trail · out and back · check the sea first' },
  },
  keyFacts: [
    { label: { zh: '入口', en: 'Entrance' }, value: { zh: 'Francis Beach 主入口 95 Kelly Avenue', en: 'Francis Beach main entrance, 95 Kelly Avenue' }, source: 1 },
    { label: { zh: '路线', en: 'Route' }, value: { zh: '沿 Coastside Trail 往 Venice Beach 方向，原路返回', en: 'North on the Coastside Trail toward Venice Beach, back the same way' } },
    { label: { zh: '带狗', en: 'Dogs' }, value: { zh: '沙滩禁止；步道和野餐区可牵绳，绳长不超过 6 英尺', en: 'Not on the beach; leashed (6 feet or less) on the trail and picnic areas' }, source: 1 },
    { label: { zh: '海况', en: 'Sea safety' }, value: { zh: '平静后也可能突然来大浪；不背对海，远离漂木', en: 'Big waves can follow calm spells; never turn your back on the sea, keep off logs' }, source: 3 },
  ],
  slides: [
    { kind: 'point', kicker: { zh: '路线', en: 'Route' }, title: { zh: 'Francis Beach 短程往返', en: 'A short out-and-back from Francis Beach' },
      body: { zh: '从日间入口出发，沿 Coastside Trail 向北、Venice Beach 方向走，按体力决定折返点，再原路回 Francis Beach。提前回头也算完成。', en: 'From the day-use entrance, walk north on the Coastside Trail toward Venice Beach, turn back when you choose and return to Francis Beach. Turning back early still counts.' } },
    { kind: 'safety', kicker: { zh: '下沙滩前', en: 'Before the sand' }, title: { zh: '重新看一眼海', en: 'Look at the sea again' },
      items: [
        { zh: '查当天的海浪与潮汐提示', en: "Check the day's surf and tide alerts" },
        { zh: '不背对海洋，留出后退空间', en: 'Never turn your back on the ocean; leave room to step back' },
        { zh: '远离浪边漂木', en: 'Keep away from logs at the waterline' },
        { zh: '有海滩危险警示，就留在岸上步道', en: 'Beach hazard warning? Stay on the trail' },
      ], source: 3 },
    { kind: 'compare', kicker: { zh: '带狗、带推车', en: 'Dogs and strollers' }, title: { zh: '各有一道确认', en: 'One check each' },
      items: [
        { zh: '狗：沙滩禁止；步道和指定野餐区可牵绳', en: 'Dogs: not on the beach; leashed on the trail and picnic areas' },
        { zh: '推车：铺装路好走，沙地另说；沙滩轮椅先问入口站', en: 'Strollers: easy on pavement, not on sand; ask the entrance station about beach wheelchairs' },
      ], source: 1 },
    { kind: 'checklist', kicker: { zh: '小清单', en: 'Small list' }, title: { zh: '半天带这些', en: 'For half a day' },
      items: [
        { zh: '防风外层、水、好收拾的食物和垃圾袋', en: 'A windproof layer, water, tidy food and a trash bag' },
        { zh: '把返程时间告诉同行者', en: 'Tell your group when you will head back' },
        { zh: '不生火，不带走贝壳和漂木', en: 'No fires; leave shells and driftwood' },
      ] },
  ],
  steps: [
    { zh: '导航输入 Francis Beach 主入口 95 Kelly Avenue，出发前看州立公园页的开放和停车说明。', en: 'Navigate to the Francis Beach entrance, 95 Kelly Avenue, and check the State Parks page for openings and parking.' },
    { zh: '沿 Coastside Trail 往 Venice Beach 方向走，按体力折返。', en: 'Walk the Coastside Trail toward Venice Beach and turn back when you like.' },
    { zh: '下沙滩前查海浪警示，不背对海，远离漂木。', en: 'Before the sand, check surf warnings, face the sea and keep off logs.' },
  ],
};
