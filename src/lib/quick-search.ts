import { ATTRACTIONS, ATTRACTION_THEMES } from '../data/attractions';
import { LIFE_TOOLS } from '../data/tool-catalog';
import { MONTHLY_EVENTS } from '../data/monthly-edition';
import { normalizeGuideQuery } from './guide-search';
import { getBayAreaToday } from './monthly';
import { translateText, type Locale } from '../i18n/locale';

const toolAliases: Record<string, string> = {
  communication: '英文 English message translate 翻译 房东 landlord repair',
  dining: 'tip tips restaurant dining 小费 餐厅 聚餐 AA 服务费',
  'unit-price': 'price grocery shopping 单价 超市 比价',
  loan: 'loan mortgage payment 房贷 月供 利息 首付',
  units: 'convert units temperature Fahrenheit Celsius miles 华氏 摄氏 英里 磅',
  split: 'split bill roommates AA 分账 账单 室友',
  budget: 'rent rental budget 租房 预算 押金',
  moving: 'moving checklist 搬家 清单 待办',
};

/** Local discovery keeps free-form queries private until the user chooses posts or AI. */
export function searchQuickDestinations(query: string, locale: Locale, today = getBayAreaToday()) {
  const tokens = [...new Set(normalizeGuideQuery(query).split(/\s+/).filter(Boolean))];
  const matches = (values: string[]) => {
    const text = normalizeGuideQuery(values.flatMap(value => [value, translateText(value, locale)]).join(' '));
    return tokens.length > 0 && tokens.every(token => text.includes(token));
  };
  return {
    tools: LIFE_TOOLS.filter(tool => matches([tool.title, tool.short, tool.description, toolAliases[tool.id] || ''])).slice(0, 3),
    events: MONTHLY_EVENTS.filter(event => event.endDate >= today && matches([
      event.title, event.city, event.venue, event.summary, event.costLabel, ...event.audience,
    ])).slice(0, 3),
    attractions: ATTRACTIONS.filter(place => matches([
      place.title, place.city, place.note, place.mapQuery,
      ...place.themes.map(theme => ATTRACTION_THEMES.find(item => item.id === theme)!.label),
    ])).slice(0, 3),
  };
}
