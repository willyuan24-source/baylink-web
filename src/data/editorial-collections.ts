/** Shared editorial links: safe for the homepage without importing full guide content. */
export const editorialCollections = [
  {
    id: 'settle-in', title: '安顿新生活',
    intro: '从抵达湾区的第一段路，到开通水电网、办理证件与建立日常。',
    guides: [
      { slug: 'bay-area-utilities-address-change-guide', label: '搬家后，水电网和地址怎么安排？' },
      { slug: 'california-driver-license-id-preparation-guide', label: '驾照与 ID，先准备对材料' },
      { slug: 'bay-area-airport-arrival-guide', label: '机场落地，怎么回家？' },
      { slug: 'bay-area-library-starter-guide', label: '从一张图书馆卡开始' },
      { slug: 'bay-area-newcomer-first-month-checklist', label: '新来湾区的第一个月' },
    ],
  },
  {
    id: 'ask-for-help', title: '找人帮忙，先讲清楚',
    intro: '把范围、时间与交付讲明白，让清洁、维修和翻译更好沟通。',
    guides: [
      { slug: 'bay-area-cleaning-quote-checklist', label: '找清洁，先讲清报价范围' },
      { slug: 'bay-area-repair-request-guide', label: '找维修，怎样描述问题？' },
      { slug: 'bay-area-translation-service-guide', label: '找翻译，先确认交付要求' },
    ],
  },
  {
    id: 'weekend-nearby', title: '周末走近湾区',
    intro: '从东湾街区到北湾一日出行，留一点时间重新认识附近。',
    guides: [
      { slug: 'east-bay-first-weekend-guide', label: '东湾的第一个周末' },
      { slug: 'north-bay-car-free-day-guide', label: '不自驾，去北湾走一天' },
      { slug: 'san-francisco-guide', label: '走近旧金山的日常' },
    ],
  },
];
