/** Editorial priorities, not inferred personal attributes. Readers choose their own situation. */
export const READER_PATHS = [
  {
    id: 'visitor', label: '来湾区玩', title: '把有限的几天，安排得顺一点',
    intro: '先决定住处与交通，再选一条能完成的路线；把吃饭、存包和返程一起安排。',
    online: '网上先确认：预约是否成功、出发与返程班次、同行人的饮食和行动需求。',
    offline: '出门带好：离线订单、取包截止时间、厕所备选、同行集合点。',
    paths: [
      { slug: 'sf-first-72-hours-car-free-october-2026', label: '三天怎么玩', text: '按街区走，留出吃饭、排队和休息的时间。' },
      { slug: 'sf-first-visit-tickets-waterfront-october-2026', label: '哪些需要提前订', text: '分清景点门票、船票、通票与免费公共区域。' },
      { slug: 'bay-area-visitor-coast-redwoods-return-plan-2026', label: '远郊去得了，也回得来', text: '红木林、Point Reyes、半月湾，一天选一个方向。' },
      { slug: 'sf-visitor-luggage-restrooms-lost-property-2026', label: '存包、厕所与失物', text: '退房后怎么走，丢了东西该联系谁。' },
      { slug: 'sf-visitor-meals-markets-dietary-booking-2026', label: '吃得合适，账单看得懂', text: '订位、饮食需求、食物过敏与费用核对。' },
      { slug: 'sf-family-rain-fog-car-free-october-2026', label: '天气和体力的备选', text: '给孩子、推车和想少走路的同行人留余量。' },
    ],
  },
  {
    id: 'new-resident', label: '刚搬来湾区', title: '把第一件事办成，再安排下一件',
    intro: '从能入住、能联系、能出行开始，把材料、办理入口和完成标准放在同一张清单。',
    online: '网上先确认：实际服务区域、预约入口、所需材料，以及办理后的确认方式。',
    offline: '现场要留好：申请编号、收据、下一步联系人；材料不齐先问可用替代流程。',
    paths: [
      { slug: 'bay-area-first-7-30-days-action-plan-october-2026', label: '前 7 天与 30 天', text: '按先后依赖安排入住、账单、证件和交通。' },
      { slug: 'bay-area-cross-bay-commute-home-base-october-2026', label: '住处与通勤一起选', text: '试走实际工作日路线，也检查晚归和最后一公里。' },
      { slug: 'bay-area-first-doctor-insurance-network-guide', label: '第一次找医生', text: '核对具体保险网络、新患者名额和转诊流程。' },
      { slug: 'bay-area-k12-midyear-enrollment-guide', label: '孩子中途转学', text: '找对学区、交接记录、核对入学确认与首日安排。' },
      { slug: 'bay-area-phone-bank-first-bill-guide', label: '手机、银行和首张账单', text: '先打通联系与付款，再核对费用和自动续费。' },
      { slug: 'bay-area-311-211-local-help-guide', label: '遇到问题去哪里求助', text: '分清市政报修、资源转介与紧急求助入口。' },
    ],
  },
  {
    id: 'resident', label: '已经住了很久', title: '把熟悉的生活，再理顺一点',
    intro: '从反复发生的支出和闲置物品开始，也给自己找一个能持续参与的社区。',
    online: '网上先确认：全年实际成本、福利续期条件、课程报名状态与工具借用资格。',
    offline: '生活里做一步：带账单核对、去一次固定活动、借用后按时归还，再安排复盘。',
    paths: [
      { slug: 'bay-area-household-bills-annual-review-2026', label: '一年一次账单复核', text: '水电、宽带和手机，全成本比较并检查减免资格。' },
      { slug: 'bay-area-build-recurring-community-routine-2026', label: '找到能持续参与的社区', text: '图书馆、公园志愿与社区课，从第一次走到固定参加。' },
      { slug: 'bay-area-borrow-tools-repair-before-buying-2026', label: '先借、先修，再决定买', text: '核对工具馆资格和库存，准备维修活动的故障清单。' },
      { slug: 'sf-free-culture-eligibility-october-2026', label: '把居民文化福利用起来', text: '免费日、图书证和同行人数，按自己的资格选择。' },
      { slug: 'bay-area-bulky-items-ewaste-hhw-guide', label: '整理闲置与特殊废弃物', text: '预约大件、电子废物和危险废物的正确处理渠道。' },
      { slug: 'bay-area-alerts-outages-first-day-checklist', label: '更新家里的应急准备', text: '检查本地警报、停电入口和家人联络方案。' },
    ],
  },
] as const;
