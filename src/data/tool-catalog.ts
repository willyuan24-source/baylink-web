export const LIFE_TOOLS = [
  { id: 'communication', title: 'AI 沟通助手', short: '一句话，表达得更清楚', description: '联系房东、预约维修、约好面交。把你的意思整理成中文、英文或双语消息。', tag: 'AI 帮忙', icon: 'sparkles' },
  { id: 'units', title: '日常单位换算', short: '华氏、英里，不用心算', description: '温度、距离、面积、重量与美制容量，输入一个数字，马上换算。', tag: '即算即用', icon: 'ruler' },
  { id: 'split', title: '共享账单分摊', short: '一起生活，把账算清', description: '房租、水电、聚餐或合购物品，平均分或按权重分到每一美分。', tag: '即算即用', icon: 'users' },
  { id: 'budget', title: '租房费用计算', short: '每月开销，入住现金', description: '把月租、水电网、停车和搬家费放在一起，区分月支出与押金占用。', tag: '即算即用', icon: 'calculator' },
  { id: 'moving', title: '搬家待办清单', short: '重要的小事，逐个完成', description: '从搬家前到安顿好新住处，勾选进度，也能加入自己的待办。', tag: '本机保存', icon: 'checklist' },
] as const;

export type LifeToolId = typeof LIFE_TOOLS[number]['id'];
export const resolveLifeTool = (value: string | null): LifeToolId => LIFE_TOOLS.find(tool => tool.id === value)?.id || 'communication';
export const TOOLS_METADATA = {
  title: '湾区生活工具箱 · AI 沟通、单位换算与分账｜BAYLINK',
  description: '免费使用 BAYLINK 生活工具箱：AI 中英文沟通助手、日常单位换算、共享账单分摊、租房费用计算与搬家待办清单。',
  path: '/tools',
};
