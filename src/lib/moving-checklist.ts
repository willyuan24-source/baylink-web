export const MOVING_CHECKLIST_GROUPS = [
  { id: 'before', title: '搬家前', items: [
    { id: 'review-agreement', label: '核对租约、搬出要求与费用责任，确认交接联系人' },
    { id: 'book-moving', label: '确认搬家车辆、搬运范围、报价与预约时段' },
    { id: 'building-access', label: '确认两端的电梯、装卸位置、门禁和停车安排' },
    { id: 'pack-label', label: '按房间打包并标注易碎物，备好常用物品包' },
    { id: 'utilities-plan', label: '安排旧住处水电网结束与新住处开通，确认账户责任' },
    { id: 'address-list', label: '列出需要更新地址的机构与订阅，逐项办理' },
  ] },
  { id: 'moving-day', title: '搬家当天', items: [
    { id: 'handover-record', label: '拍摄旧住处房况和相关表读数，保留交接记录' },
    { id: 'return-keys', label: '核对钥匙、门卡和遥控器数量，记录交还情况' },
    { id: 'count-items', label: '按清单核对箱件与家具，现场记录遗失或损坏' },
    { id: 'new-condition', label: '检查新住处房况与设备，拍照记录并反馈问题' },
    { id: 'first-night', label: '确认门锁、照明、热水和必要生活用品可以使用' },
  ] },
  { id: 'after', title: '入住后', items: [
    { id: 'service-check', label: '测试水电、网络与垃圾回收安排，核对账户信息' },
    { id: 'address-check', label: '确认邮件转寄和重要账户地址更新是否完成' },
    { id: 'first-bill', label: '核对首期账单的起止日期、计费项目和开通费用' },
    { id: 'save-records', label: '整理搬家收据、交接记录与未解决事项' },
  ] },
] as const;

export const MAX_CUSTOM_MOVING_TASKS = 20;
export const MAX_MOVING_TASK_LENGTH = 80;
const templateIds = new Set<string>(MOVING_CHECKLIST_GROUPS.flatMap(group => group.items.map(item => item.id)));
export type MovingChecklistState = { version: 1; completed: string[]; custom: { id: string; label: string; done: boolean }[] };
export type MovingChecklistRead = { state: MovingChecklistState; error: string | null };
type ChecklistStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const movingChecklistKey = (scope: string) => `baylink.moving-checklist.v1:${encodeURIComponent(scope || 'guest')}`;
export const emptyMovingChecklist = (): MovingChecklistState => ({ version: 1, completed: [], custom: [] });
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function validateMovingTask(value: string): { label: string; error: string | null } {
  const label = value.replace(/\s+/gu, ' ').trim();
  if (!label) return { label, error: '请先填写待办内容。' };
  if (label.length > MAX_MOVING_TASK_LENGTH) return { label, error: `每条待办最多 ${MAX_MOVING_TASK_LENGTH} 个字符。` };
  return { label, error: null };
}

export function parseMovingChecklist(raw: string | null): MovingChecklistRead {
  if (raw === null) return { state: emptyMovingChecklist(), error: null };
  const invalid = () => ({ state: emptyMovingChecklist(), error: '本机清单格式无法识别，原记录尚未修改。可重置清单后重新开始。' });
  try {
    if (raw.length > 20000) return invalid();
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1 || !Array.isArray(value.completed) || !Array.isArray(value.custom)
      || value.completed.length > templateIds.size || value.custom.length > MAX_CUSTOM_MOVING_TASKS
      || !value.completed.every(id => typeof id === 'string' && templateIds.has(id))
      || new Set(value.completed).size !== value.completed.length) return invalid();
    const ids = new Set<string>();
    for (const item of value.custom) {
      if (!record(item) || typeof item.id !== 'string' || !/^custom-[a-zA-Z0-9-]{1,100}$/.test(item.id)
        || ids.has(item.id) || typeof item.label !== 'string' || validateMovingTask(item.label).error
        || item.label !== validateMovingTask(item.label).label || typeof item.done !== 'boolean') return invalid();
      ids.add(item.id);
    }
    return { state: { version: 1, completed: [...value.completed], custom: value.custom.map(item => ({ id: item.id, label: item.label, done: item.done })) }, error: null };
  } catch { return invalid(); }
}

export function readMovingChecklist(scope: string, storage?: ChecklistStorage): MovingChecklistRead {
  try {
    if (!storage && typeof window === 'undefined') return { state: emptyMovingChecklist(), error: null };
    return parseMovingChecklist((storage ?? window.localStorage).getItem(movingChecklistKey(scope)));
  } catch { return { state: emptyMovingChecklist(), error: '浏览器未允许读取本机清单。请检查存储设置后重试，原记录尚未修改。' }; }
}

export function saveMovingChecklist(scope: string, state: MovingChecklistState, storage?: ChecklistStorage): string | null {
  try {
    const parsed = parseMovingChecklist(JSON.stringify(state));
    if (parsed.error) return '清单内容无法保存，请检查待办内容。';
    (storage ?? window.localStorage).setItem(movingChecklistKey(scope), JSON.stringify(parsed.state));
    return null;
  } catch { return '浏览器未能保存清单；本次修改仅保留在当前页面，关闭或刷新后可能丢失。'; }
}

export function movingChecklistProgress(state: MovingChecklistState) {
  return { completed: state.completed.length + state.custom.filter(item => item.done).length, total: templateIds.size + state.custom.length };
}

export function movingChecklistText(state: MovingChecklistState, translate = (text: string) => text) {
  const progress = movingChecklistProgress(state);
  const sections = MOVING_CHECKLIST_GROUPS.map(group => `${translate(group.title)}\n${group.items.map(item => `${state.completed.includes(item.id) ? '[x]' : '[ ]'} ${translate(item.label)}`).join('\n')}`);
  if (state.custom.length) sections.push(`${translate('自己补充')}\n${state.custom.map(item => `${item.done ? '[x]' : '[ ]'} ${item.label}`).join('\n')}`);
  return `${translate('搬家清单')}\n${translate(`已完成 ${progress.completed} / ${progress.total} 项`)}\n\n${sections.join('\n\n')}`;
}
