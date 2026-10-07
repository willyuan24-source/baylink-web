import { ATTRACTIONS, ATTRACTION_THEMES } from '../data/attractions';
import { LIFE_TOOLS } from '../data/tool-catalog';
import { MONTHLY_EVENTS } from '../data/monthly-edition';
import { currentFreebies } from '../data/october-offers';
import { currentOpenings } from '../data/local-discoveries';
import type { FreebieOffer } from '../components/FreebieBoard';
import { normalizeGuideQuery } from './guide-search';
import { getBayAreaToday, getEventStatus } from './monthly';
import { validCalendarDay } from './event-calendar';
import { offerMatchesDateRange } from './offer-calendar';
import { translateText, type Locale } from '../i18n/locale';
import { PLANNER_EVENTS } from '../data/planner-catalog';
import { discoveryText, normalizeDiscoveryTopic, parseDiscoveryQuery } from './discovery-query';
import { recognizeNamedEvent } from './named-event-search';

const eventFacts = new Map(PLANNER_EVENTS.map(event => [event.id, event.planning]));

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

const isCurrentOffer = (offer: FreebieOffer, today: string): boolean => {
  if (offer.availability !== 'dated') return true;
  const start = offer.startDate || offer.endDate;
  const end = offer.endDate || offer.startDate;
  return !!start && !!end && validCalendarDay(start) && validCalendarDay(end) && start <= end && end >= today;
};

/** Local discovery keeps free-form queries private until the user chooses posts or AI. */
export function searchQuickDestinations(query: string, locale: Locale, today = getBayAreaToday()) {
  const namedEvent = recognizeNamedEvent(query.trim().slice(0, 300));
  const queryInfo = parseDiscoveryQuery(namedEvent.constraintText, today, [...MONTHLY_EVENTS.map(event => event.city), ...currentOpenings.map(shop => shop.city), ...ATTRACTIONS.map(place => place.city)]);
  queryInfo.original = query.trim();
  if (namedEvent.eventIds.length) {
    queryInfo.structured = true;
    if (queryInfo.intent === 'mixed') queryInfo.intent = 'events';
    if (namedEvent.blocked && !queryInfo.unsupported.includes('negative-preference')) queryInfo.unsupported.push('negative-preference');
  }
  const { tokens, intent, dateRange } = queryInfo;
  const active = !!query.trim() && !queryInfo.invalidDate && !queryInfo.unsupported.some(value => value === 'negative-preference' || value === 'multiple-dates');
  const normalize = (value: string) => normalizeGuideQuery(normalizeDiscoveryTopic(value));
  const matches = (values: string[]) => {
    const text = normalize(values.flatMap(value => [value, translateText(value, locale)]).join(' '));
    return active && (tokens.length > 0 || queryInfo.structured) && tokens.every(token => text.includes(normalize(token)));
  };
  const locationMatches = (region?: string, city?: string) =>
    (!queryInfo.regions.length || !!region && queryInfo.regions.includes(region as typeof queryInfo.regions[number])) &&
    (!queryInfo.cities.length || !!city && queryInfo.cities.some(value => city.split(/\s*(?:\/|、|;|；)\s*/).some(part => discoveryText(value) === discoveryText(part))));
  const budgetMatches = (cost: string, admission?: number | null) =>
    (!queryInfo.freeOnly || cost === 'free') && (queryInfo.maxAdmissionUsd === undefined ||
      cost === 'free' || admission !== undefined && admission !== null && admission <= queryInfo.maxAdmissionUsd);
  // Only explicit published evening language / start times count; no inferred venue hours.
  const eveningMatches = (dateLabel: string) => {
    const label = discoveryText(dateLabel);
    const firstTime = label.match(/(?:^|[^\d:])(\d{1,2}):[0-5]\d/);
    return !queryInfo.evening || /晚间|晚上|夜间|\b(?:evening|night)\b/.test(label) || !!firstTime && Number(firstTime[1]) >= 18 && Number(firstTime[1]) <= 23;
  };
  const eventMatches = (event: typeof MONTHLY_EVENTS[number]) => {
    const facts = eventFacts.get(event.id);
    const rangeStart = dateRange && (dateRange.start > today ? dateRange.start : today);
    return (!namedEvent.eventIds.length || namedEvent.eventIds.includes(event.id)) && getEventStatus(event, today) !== 'ended' && locationMatches(event.region, event.city) &&
      (!dateRange || rangeStart! <= dateRange.end && event.startDate <= dateRange.end && event.endDate >= rangeStart! &&
        (event.occurrenceDates === undefined || event.occurrenceDates.some(day => day >= rangeStart! && day <= dateRange.end && day >= event.startDate && day <= event.endDate))) &&
      (!queryInfo.eventKind || event.kind === queryInfo.eventKind) && budgetMatches(event.cost, facts?.admissionUsd) &&
      (!queryInfo.setting || facts?.setting === queryInfo.setting) && eveningMatches(event.dateLabel) &&
      (!queryInfo.family || (facts?.minAge ?? 0) < 18 && (event.category === 'family' || /亲子|儿童|孩子|家庭|小朋友|\bfamil(?:y|ies)\b|\bkids\b/.test(event.audience.join(' ')))) &&
      queryInfo.childAges.every(age => (facts?.minAge == null || age >= facts.minAge) && (facts?.maxAge == null || age <= facts.maxAge)) &&
      matches([event.title, event.venue, event.summary, ...event.audience]);
  };
  const offerMatches = (offer: FreebieOffer) => {
    // Offers do not have a canonical city field. Never use eligibility/address prose as geography.
    const city = queryInfo.cities.length ? parseDiscoveryQuery(`${offer.brand} ${offer.title}`, today, queryInfo.cities).cities : [];
    const cityMatch = !queryInfo.cities.length || queryInfo.cities.some(value => city.some(candidate => discoveryText(candidate) === discoveryText(value)));
    const explicitFree = (offer.kind === 'no-purchase' || offer.kind === 'reservation') && /免费|\bfree\b/.test(discoveryText(`${offer.title} ${offer.requirement}`));
    return isCurrentOffer(offer, today) && cityMatch && (!queryInfo.regions.length || !!offer.region && queryInfo.regions.includes(offer.region)) &&
      (!queryInfo.freeOnly && queryInfo.maxAdmissionUsd === undefined || explicitFree) &&
      !queryInfo.setting && !queryInfo.family && eveningMatches(offer.dateLabel) &&
      (!dateRange || offerMatchesDateRange(offer, dateRange.start > today ? dateRange.start : today, dateRange.end)) &&
      matches([offer.brand, offer.title, offer.requirement, offer.description]);
  };
  const requestedWeekendOnly = !!dateRange && new Date(`${dateRange.end}T12:00:00Z`).getTime() - new Date(`${dateRange.start}T12:00:00Z`).getTime() <= 86400000 &&
    [dateRange.start, dateRange.end].every(day => [0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay()));
  const openingMatches = (shop: typeof currentOpenings[number]) => locationMatches(shop.region, shop.city) &&
    (!queryInfo.openingStatus || shop.status === queryInfo.openingStatus) &&
    !queryInfo.freeOnly && queryInfo.maxAdmissionUsd === undefined && !queryInfo.setting && !queryInfo.family &&
    (!dateRange || !shop.openedOn || shop.openedOn <= dateRange.end) &&
    (!requestedWeekendOnly || !/周末(?:暂)?休|周末不营业|仅周一至周五/.test(`${shop.dateLabel} ${shop.editorTip}`)) &&
    (!dateRange || shop.status !== 'announced') && matches([shop.name, shop.category, shop.summary]);
  const attractionMatches = (place: typeof ATTRACTIONS[number]) => locationMatches(place.region, place.city) &&
    budgetMatches(place.cost) && !queryInfo.setting && !queryInfo.family && matches([
      place.title, place.note, place.mapQuery, ...place.themes.map(theme => ATTRACTION_THEMES.find(item => item.id === theme)!.label),
    ]);
  const offers = !namedEvent.eventIds.length && (intent === 'mixed' || intent === 'offers') ? currentFreebies.filter(offerMatches) : [];
  const openings = !namedEvent.eventIds.length && (intent === 'mixed' || intent === 'openings' || intent === 'places') ? currentOpenings.filter(openingMatches) : [];
  const attractions = !namedEvent.eventIds.length && (intent === 'mixed' || intent === 'attractions' || intent === 'places') ? ATTRACTIONS.filter(attractionMatches) : [];
  const events = intent === 'mixed' || intent === 'events' ? MONTHLY_EVENTS.filter(eventMatches) : [];
  if (queryInfo.structured) events.sort((a, b) => {
    const nextDay = (event: typeof MONTHLY_EVENTS[number]) => event.occurrenceDates?.filter(day => day >= today && (!dateRange || day >= dateRange.start && day <= dateRange.end)).sort()[0] || (event.startDate > today ? event.startDate : today);
    return nextDay(a).localeCompare(nextDay(b));
  });
  return {
    queryInfo,
    tools: !queryInfo.structured ? LIFE_TOOLS.filter(tool => matches([tool.title, tool.short, tool.description, toolAliases[tool.id] || ''])).slice(0, 3) : [],
    events: events.slice(0, 3),
    offers: offers.filter(offer => offer.verificationStatus !== 'needs-confirmation' && (!dateRange || offer.availability === 'dated')).slice(0, 3),
    openings: !dateRange && !queryInfo.evening ? openings.slice(0, 3) : [],
    attractions: !dateRange && !queryInfo.evening ? attractions.slice(0, 3) : [],
    // A permanent place or ongoing policy is not evidence of availability on a requested day.
    unverified: {
      offers: offers.filter(offer => offer.verificationStatus === 'needs-confirmation' || dateRange && offer.availability !== 'dated').slice(0, 3),
      openings: dateRange || queryInfo.evening ? openings.slice(0, 3) : [],
      attractions: dateRange || queryInfo.evening ? attractions.slice(0, 3) : [],
    },
  };
}
