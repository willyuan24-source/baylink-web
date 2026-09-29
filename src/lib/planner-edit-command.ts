import { simplifySearch } from '../i18n/locale';
import { validDay } from './planner';

export type EditCommand =
  | { kind: 'shift'; minutes: number }
  | { kind: 'time'; field: 'startTime' | 'finishBy'; value: string }
  | { kind: 'date'; value: string }
  | { kind: 'remove'; index?: number; name?: string; museums?: true }
  | { kind: 'replace'; index: number; category?: 'restaurant' | 'cafe'; cheaper: boolean };

const numbers: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 半: 0.5, first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5, a: 1, an: 1 };
const number = (value: string) => numbers[value] ?? (/^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN);
const ordinal = (value: string) => number(value.replace(/^(\d+)(?:st|nd|rd|th)$/, '$1')) - 1;
const clock = (value: string): string | undefined => {
  let match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (match && +match[1] < 24 && +match[2] < 60) return `${match[1].padStart(2, '0')}:${match[2]}`;
  match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (match && +match[1] >= 1 && +match[1] <= 12 && +(match[2] || 0) < 60) return `${String(+match[1] % 12 + (match[3] === 'pm' ? 12 : 0)).padStart(2, '0')}:${(match[2] || '00').padStart(2, '0')}`;
  match = value.match(/^(上午|下午|晚上|中午)(\d{1,2}|[一二两三四五六七八九十])点(?:(半)|(\d{1,2})分?)?$/);
  if (match) {
    let hour = number(match[2]); const minute = match[3] ? 30 : +(match[4] || 0);
    if (hour < 1 || hour > 12 || minute > 59) return;
    if (match[1] === '上午') hour %= 12;
    else if (hour < 12) hour += 12;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
};
const dateValue = (text: string, asOf: string): string | undefined => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return validDay(text) ? text : undefined;
  const relative: Record<string, number> = { 今天: 0, 明天: 1, 后天: 2, today: 0, tomorrow: 1, 'the day after tomorrow': 2 };
  if (text in relative) {
    const day = new Date(`${asOf}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + relative[text]); return day.toISOString().slice(0, 10);
  }
  const match = text.match(/^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?$/) || text.match(/^(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    const value = `${match[1] || asOf.slice(0, 4)}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    return validDay(value) ? value : undefined;
  }
};

/** Whole-message grammars deliberately reject extra clauses instead of applying a recognized fragment. */
export function parsePlanEditCommand(message: string, asOf: string): EditCommand | undefined {
  if (!validDay(asOf) || message.length > 300) return;
  const text = simplifySearch(message).toLowerCase().trim().replace(/^(?:请(?:帮我)?|帮我|please\s+)/, '').replace(/[。.!！]$/, '').trim();
  let match = text.match(/^(?:(?:把)?(?:整个|整趟|全部)?(?:计划|行程)(?:都)?)?(提前|延后|推迟|晚|早)\s*(\d+(?:\.\d+)?|[一二两三四五六七八九十半])\s*(分钟|小时)(?:出发|开始)?$/);
  if (match) {
    const minutes = number(match[2]) * (match[3] === '小时' ? 60 : 1) * (/提前|早/.test(match[1]) ? -1 : 1);
    return Number.isInteger(minutes) && Math.abs(minutes) > 0 && Math.abs(minutes) <= 720 ? { kind: 'shift', minutes } : undefined;
  }
  match = text.match(/^(?:(?:move|shift|delay|start|leave)\s+(?:(?:the\s+)?(?:whole\s+)?(?:plan|outing|trip)\s+)?(?:by\s+)?)?(\d+(?:\.\d+)?|one|two|three|half|a|an)\s*(minutes?|mins?|hours?|hrs?)\s+(earlier|later)$/);
  if (match) {
    const minutes = number(match[1]) * (/^(?:hour|hr)/.test(match[2]) ? 60 : 1) * (match[3] === 'earlier' ? -1 : 1);
    return Number.isInteger(minutes) && Math.abs(minutes) > 0 && Math.abs(minutes) <= 720 ? { kind: 'shift', minutes } : undefined;
  }
  match = text.match(/^(?:把)?(开始|出发|结束)(?:时间)?(?:改为|改成|改到|设为|设置为|在)?\s*(.+)$/)
    || text.match(/^(start|leave|finish|end)(?: time)? (?:at|by|to) (.+)$/)
    || text.match(/^(?:change|set) (?:the )?(start|finish|end)(?: time)? to (.+)$/);
  if (match) {
    const value = clock(match[2].trim());
    return value ? { kind: 'time', field: /^(?:结束|finish|end)$/.test(match[1]) ? 'finishBy' : 'startTime', value } : undefined;
  }
  match = text.match(/^(?:从)?(.+?)(开始|出发|结束)$/);
  if (match) {
    const value = clock(match[1].trim());
    if (value) return { kind: 'time', field: match[2] === '结束' ? 'finishBy' : 'startTime', value };
  }
  match = text.match(/^(?:(?:把)?(?:日期|行程日期))?(?:改到|改成|改为|换到)\s*(.+)$/)
    || text.match(/^(?:change|move|set) (?:the )?(?:date|outing date|trip date) to (.+)$/);
  if (match) { const value = dateValue(match[1], asOf); return value ? { kind: 'date', value } : undefined; }
  if (/^(?:不要(?:去)?博物馆|(?:去掉|删掉|移除)(?:所有)?博物馆|(?:remove|skip|avoid) (?:all |the )?museums?|no museums?)$/.test(text)) return { kind: 'remove', museums: true };
  match = text.match(/^(?:删除|删掉|去掉|移除|取消)(?:第)?\s*(\d+|[一二三四五六])\s*站$/)
    || text.match(/^(?:remove|delete|drop) (?:the )?stop (\d+)$/)
    || text.match(/^(?:remove|delete|drop) (?:the )?(first|second|third|fourth|fifth|sixth|\d+(?:st|nd|rd|th)) stop$/);
  if (match) return { kind: 'remove', index: ordinal(match[1]) };
  match = text.match(/^(?:删除|删掉|去掉|移除|取消)\s*(.+)$/) || text.match(/^(?:remove|delete|drop) (.+)$/);
  if (match) return { kind: 'remove', name: match[1].trim().replace(/^[「“"]|[」”"]$/g, '') };
  match = text.match(/^(?:把)?第?\s*(\d+|[一二三四五六])\s*站(?:换成|换一家|换个|改成)(更便宜的?|便宜一点的?)?(餐厅|咖啡店|咖啡馆)?$/)
    || text.match(/^换第?\s*(\d+|[一二三四五六])\s*站(?:为|成)?(更便宜的?|便宜一点的?)?(餐厅|咖啡店|咖啡馆)$/);
  if (match && (match[2] || match[3])) return { kind: 'replace', index: ordinal(match[1]), category: match[3] ? match[3] === '餐厅' ? 'restaurant' : 'cafe' : undefined, cheaper: !!match[2] };
  match = text.match(/^第?\s*(\d+|[一二三四五六])\s*站(?:换成)?更便宜(?:的|一点)?$/);
  if (match) return { kind: 'replace', index: ordinal(match[1]), cheaper: true };
  match = text.match(/^(?:replace|swap|change) (?:the )?(?:stop (\d+)|(first|second|third|fourth|fifth|sixth|\d+(?:st|nd|rd|th)) stop) (?:with|for|to) (?:a |another )?(cheaper )?(restaurant|cafe|coffee shop)$/);
  if (match) return { kind: 'replace', index: ordinal(match[1] || match[2]), category: match[4] === 'restaurant' ? 'restaurant' : 'cafe', cheaper: !!match[3] };
  match = text.match(/^make (?:the )?(?:stop (\d+)|(first|second|third|fourth|fifth|sixth|\d+(?:st|nd|rd|th)) stop) cheaper$/);
  if (match) return { kind: 'replace', index: ordinal(match[1] || match[2]), cheaper: true };
}
