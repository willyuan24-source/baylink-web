import { PLANNER_EVENTS, PLANNER_PLACES } from '../data/planner-catalog';
import { eventOccursOn } from './event-calendar';
import { buildItinerary, clockLabel, placeMatchesFilters, timeEvidence } from './planner-itinerary';
import { resolveTimeEvidence } from './planner-hours';
import { distanceKm, todayInBay, validDay, type PlanDetails, type PlanFilters, type PlannerEvent, type PlannerPlace, type Stop, type StopSetting, type Suggestion } from './planner';

export type CompleteOuting = { id: string; title: string; summary: string; date: string; stops: Stop[]; details: PlanDetails; notices: string[]; style: 'half-day' | 'full-day' };
export type OutingInput = { suggestion: Suggestion; filters: PlanFilters; message?: string; asOf?: string };
/** Optional catalog injection keeps scheduling tests independent of live editorial changes. */
export type OutingCatalog = { events: PlannerEvent[]; places: PlannerPlace[] };
type Entry = { stop: Stop; fact: PlannerEvent | PlannerPlace; duration: number };
type AnchorTime = { start?: number; duration: number; notice?: string };
type Scheduled = { entries: Entry[]; details: PlanDetails; duration: number; wait: number; km: number; notices: string[] };
const minute = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
const admission = (row: PlannerEvent | PlannerPlace) => typeof row.planning?.admissionUsd === 'number' && Number.isFinite(row.planning.admissionUsd) && row.planning.admissionUsd >= 0 ? row.planning.admissionUsd : row.cost === 'free' ? 0 : null;
const cityKey = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const isMeal = (entry: Entry) => entry.stop.kind === 'place' && (entry.fact as PlannerPlace).category === 'restaurant';
const sameAttraction = (place: PlannerPlace, other: PlannerEvent | PlannerPlace) => (place.category || 'attraction') === 'attraction' && ('startDate' in other || !(other as PlannerPlace).category || (other as PlannerPlace).category === 'attraction') && validPoint(place) && validPoint(other) && distanceKm(place.location!, other.location!) <= 0.03;
const transportBuffer = (filters: PlanFilters) => filters.travelMode === 'walk' || filters.travelMode === 'drive' ? 30 : 45;
const agesFor = (filters: PlanFilters) => filters.childAges?.length ? filters.childAges : filters.childAge != null ? [filters.childAge] : [];
const validPoint = (row: PlannerEvent | PlannerPlace) => row.location?.precision === 'venue' && Number.isFinite(row.location.lat) && Number.isFinite(row.location.lng) && Math.abs(row.location.lat) <= 90 && Math.abs(row.location.lng) <= 180;
const excludedStatus = (row: PlannerEvent | PlannerPlace) => {
  const value = row as PlannerPlace & { status?: string; cancelled?: boolean; suspended?: boolean };
  return value.openingStatus === 'announced' || value.cancelled || value.suspended || ['closed', 'cancelled', 'canceled', 'suspended'].includes(value.status || '');
};
const placeDuration = (place: PlannerPlace, style: CompleteOuting['style']) => place.category === 'restaurant' ? 60 : place.category === 'cafe' || place.category === 'shop' ? (style === 'half-day' ? 30 : 45) : (style === 'half-day' ? 60 : 90);

/** Build a draft from one published event, not a fabricated tour or a routed map result. */
export function buildOutingOptions({ suggestion, filters, message = '', asOf = todayInBay() }: OutingInput, injected?: OutingCatalog): CompleteOuting[] {
  // Negative preferences not represented by PlanFilters cannot safely be
  // re-applied to newly added stops. Keep the already filtered event instead.
  const remainingPreferences = message.replace(/(?:不(?:想|要)?|没|沒|不用)\s*(?:开车|開車)|\b(?:no driving|without (?:a |my |our )?car|don['’]t drive|do not drive|not driving|not more than|no more than)\b|不超过|不超過|不多于|不多於/gi, ' ');
  if (/不要|不想|不去|不带|不帶|不用|排除|避开|避開|避免|\b(?:avoid|no|without|not|exclude|don['’]t|do not)\b/i.test(remainingPreferences)) return [];
  const source = injected || { events: PLANNER_EVENTS, places: PLANNER_PLACES };
  const event = source.events.find(row => row.id === suggestion.eventId);
  const date = suggestion.date;
  if (!event || !validDay(date) || !validDay(asOf) || date < asOf || (filters.date && date !== filters.date) || !eventOccursOn(event, date) || excludedStatus(event) || !validPoint(event)) return [];
  if (event.planning?.programTimeUnconfirmed) return [];
  if (filters.city && cityKey(filters.city) !== cityKey(event.city)) return [];
  if (filters.region && filters.region !== 'all' && event.region !== filters.region) return [];
  if (filters.setting && filters.setting !== 'any' && event.planning?.setting !== filters.setting) return [];
  const ages = agesFor(filters);
  if (ages.some(age => (event.planning?.minAge != null && age < event.planning.minAge) || (event.planning?.maxAge != null && age > event.planning.maxAge))) return [];
  if (filters.freeOnly && admission(event) !== 0) return [];
  const partySize = filters.partySize || Math.max(1, ages.length);
  const personCap = filters.budget == null ? null : filters.budgetScope === 'total' ? (filters.partySize ? filters.budget / filters.partySize : null) : filters.budget;
  if (personCap != null && admission(event) != null && admission(event)! > personCap) return [];
  const evidenceFor = (entry: Entry) => injected ? resolveTimeEvidence(entry.fact.planning?.schedule, date, asOf) : timeEvidence(entry.stop, date, asOf);
  const anchor: Entry = { stop: { kind: 'event', id: event.id }, fact: event, duration: 90 };
  const evidence = evidenceFor(anchor);
  if (['closed', 'out-of-range', 'invalid'].includes(evidence.status)) return [];
  const baseNotices = [
    '这是可编辑的出游草稿。相邻站点只按同城和直线距离筛选，交通时间均为预留缓冲，不是已核实的路线或实际耗时。',
    '餐饮、交通与其他费用尚未填写，草稿中的 0 只是待填数值，不表示这些消费免费。',
    ...suggestion.unknowns,
    ...evidence.notices.map(item => item.zh),
    ...(evidence.note ? [evidence.note] : []),
  ];
  if (!filters.partySize) baseNotices.push(`未提供同行总人数，草稿暂按 ${partySize} 人显示，请选择方案后确认人数与儿童票规则。`);
  if (filters.budget != null && filters.budgetScope !== 'total') baseNotices.push(`每人 $${filters.budget} 仅作为入场金额上限；未据此设置整趟总预算，餐饮与交通需要另填。`);
  if (ages.length) baseNotices.push('已检查每位儿童的已公布年龄限制；各地点的亲子适宜性、成人陪同和儿童票规则仍需确认。');
  if (filters.budgetScope === 'total' && filters.budget != null && !filters.partySize) baseNotices.push('总预算缺少已确认人数，不能核实整组门票总额；暂不添加需要付费入场的地点。');
  if (admission(event) === null || suggestion.budgetStatus === 'unknown') baseNotices.push('主活动门票或预算仍待核实；这是一份待确认的备选，不能视为整趟符合预算。');
  const anchorTimes: AnchorTime[] = evidence.status === 'confirmed' && evidence.kind === 'sessions'
    ? evidence.sessions.slice(0, 3).flatMap(session => {
      const start = minute(session.start); const duration = session.end ? minute(session.end) - start : 90;
      return duration >= 5 && duration <= 720 && start + duration < 1440 ? [{ start, duration, ...(!session.end ? { notice: '官方只公布主活动开始时间，暂留 90 分钟；结束时间需要向主办方确认。' } : {}) }] : [];
    })
    : evidence.status === 'confirmed' && evidence.kind === 'hours'
      ? evidence.windows.flatMap(window => {
        const first = Math.max(minute(window.open), 10 * 60);
        const duration = Math.min(90, minute(window.close) - first);
        const last = Math.min(minute(window.close) - duration, window.lastEntry ? minute(window.lastEntry) : 1440, window.lastOrder ? minute(window.lastOrder) : 1440);
        if (duration < 5 || first > last) return [];
        const starts = Array.from({ length: Math.floor((last - first) / 30) + 1 }, (_, index) => first + index * 30);
        if (!starts.includes(last)) starts.push(last);
        return starts.map(start => ({ start, duration, notice: '主活动开始时间选在已收录开放窗口内，是可调整的访问安排，不代表某场节目的官方开演时间。' }));
      })
      : [{ duration: 90, notice: '主活动尚无可用的官方时段，开始与停留时间是草稿安排，请核实具体场次后使用。' }];
  if (!anchorTimes.length) return [];

  const candidates = source.places.filter(place => !excludedStatus(place) && validPoint(place) && cityKey(place.city) === cityKey(event.city)
    && !sameAttraction(place, event)
    && (!place.openedOn || place.openedOn <= date)
    && !/alcatraz|angel[- ]island|必须.{0,3}(?:渡轮|渡輪)|requires? (?:a )?ferry/i.test(`${place.id} ${place.summary}`)
    && placeMatchesFilters(place, { ...filters, city: undefined })
    && !(filters.budget != null && admission(place) === null)
    && !(filters.budgetScope === 'total' && filters.budget != null && !filters.partySize && admission(place) !== 0)
    && !((filters.freeOnly || filters.budget === 0) && place.category === 'restaurant')
    && evidenceFor({ stop: { kind: 'place', id: place.id }, fact: place, duration: 60 }).status === 'confirmed');
  // Keep a few genuine choices per category, rather than letting the nearest
  // three shops crowd all restaurants and attractions out of the route.
  const pool = [...new Map(['restaurant', 'attraction', 'cafe', 'shop'].flatMap(category => candidates.filter(place => (place.category || 'attraction') === category)
    .map(place => ({ place, km: distanceKm(event.location!, place.location!) }))
    .filter(item => item.km <= (filters.travelMode === 'walk' ? 2 : 5)).sort((a, b) => a.km - b.km).slice(0, 3)
    .map(item => [item.place.id, item.place] as const))).values()];
  if (!pool.length) return [];

  const budgetFits = (entries: Entry[]) => {
    const known = entries.reduce((sum, entry) => sum + (admission(entry.fact) ?? 0), 0);
    return personCap == null || known <= personCap + 0.0000001;
  };
  const connected = (entries: Entry[]) => entries.every((entry, index) => !index || (cityKey(entry.fact.city) === cityKey(entries[index - 1].fact.city)
    && validPoint(entry.fact) && validPoint(entries[index - 1].fact)
    && distanceKm(entries[index - 1].fact.location!, entry.fact.location!) <= (filters.travelMode === 'walk' ? 2 : 5)));

  const schedule = (entries: Entry[], style: CompleteOuting['style'], anchorTime: AnchorTime): Scheduled | null => {
    if (!budgetFits(entries) || !connected(entries)) return null;
    const hasRestaurant = entries.some(isMeal);
    const anchorIndex = entries.findIndex(entry => entry.stop.kind === 'event');
    const buffer = transportBuffer(filters);
    const plannedMinutes = entries.reduce((sum, entry) => sum + entry.duration, 0) + Math.max(0, entries.length - 1) * buffer;
    const mealIndex = !hasRestaurant && plannedMinutes >= 240 ? Math.min(1, entries.length - 1) : -1;
    const beforeAnchor = entries.slice(0, anchorIndex).reduce((sum, entry) => sum + entry.duration + buffer, 0) + (mealIndex >= 0 && mealIndex <= anchorIndex ? 45 : 0);
    const idealStart = anchorTime.start == null ? (style === 'half-day' ? 10 * 60 : 9 * 60) : anchorTime.start - beforeAnchor;
    const startChoices = anchorTime.start == null ? [idealStart] : [idealStart, idealStart - 30, idealStart - 60, idealStart - 90];
    const results: Scheduled[] = [];
    for (const start of startChoices) {
      if (start < 8 * 60 || start >= 23 * 60) continue;
      let cursor = start; let wait = 0; let failed = false;
      const settings: StopSetting[] = []; const notices = [...baseNotices];
      if (anchorTime.notice) notices.push(anchorTime.notice);
      if (hasRestaurant) notices.push('餐厅停留按已收录营业时段安排，但餐桌、预约、菜单和实际餐费未核实；请补充餐饮预算。');
      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index]; const facts = evidenceFor(entry);
        const breakBeforeMinutes = index === mealIndex ? 45 : 0;
        const breakLabel = cursor >= 11 * 60 && cursor <= 14 * 60 || cursor >= 16 * 60 && cursor <= 20 * 60 ? 'meal' as const : 'rest' as const;
        const travelMinutes = index ? buffer : 0;
        const arrival = cursor + breakBeforeMinutes + travelMinutes;
        let visit = arrival; let fixedStartTime: string | undefined;
        if (entry.stop.kind === 'event' && anchorTime.start != null) {
          if (arrival > anchorTime.start || anchorTime.start - arrival > 90) { failed = true; break; }
          visit = anchorTime.start; fixedStartTime = clockLabel(visit);
        } else if (facts.status === 'confirmed' && facts.kind === 'hours') {
          const window = facts.windows.find(value => {
            const proposed = Math.max(arrival, minute(value.open));
            return proposed + entry.duration <= minute(value.close) && (!value.lastEntry || proposed <= minute(value.lastEntry)) && (!value.lastOrder || proposed <= minute(value.lastOrder));
          });
          if (!window) { failed = true; break; }
          visit = Math.max(arrival, minute(window.open));
          if (visit - arrival > 60) { failed = true; break; }
        } else if (entry.stop.kind === 'place') { failed = true; break; }
        if (isMeal(entry) && !(visit >= 11 * 60 && visit <= 14 * 60 || visit >= 16 * 60 && visit <= 20 * 60)) { failed = true; break; }
        wait += visit - arrival; cursor = visit + entry.duration;
        settings.push({ ...entry.stop, durationMinutes: entry.duration, travelMinutes, ...(fixedStartTime ? { fixedStartTime } : {}), ...(breakBeforeMinutes ? { breakBeforeMinutes, breakLabel } : {}) });
        if (entry.stop.kind === 'place') {
          notices.push(...facts.notices.map(item => item.zh));
          if (facts.note) notices.push(`${entry.fact.title}：${facts.note}`);
          if (admission(entry.fact) === null) notices.push(`${entry.fact.title}：入场金额待确认。`);
        }
      }
      let duration = cursor - start;
      if (failed || cursor >= 1440 || duration > (style === 'half-day' ? 240 : 600)) continue;
      if (!hasRestaurant) notices.push(mealIndex < 0
        ? '没有找到符合条件的餐厅；这段行程较短，未固定用餐或休息时段，用餐地点、时间与费用仍待选择。'
        : settings.some(item => item.breakLabel === 'meal')
          ? '没有找到同时满足地点、营业时间及预算条件的餐厅；已预留 45 分钟用餐，地点与餐费待选。'
          : '没有找到符合条件的餐厅；已预留 45 分钟休息，用餐地点、时间与费用仍待选择。');
      const details: PlanDetails = {
        startTime: clockLabel(start), finishBy: clockLabel(cursor), partySize,
        totalBudgetUsd: filters.budget != null && filters.budgetScope === 'total' ? filters.budget : null,
        extraCostUsd: 0, costBreakdown: { foodUsd: 0, transportUsd: 0, otherUsd: 0 },
        travelMode: ['drive', 'transit', 'walk'].includes(filters.travelMode || '') ? filters.travelMode as PlanDetails['travelMode'] : 'any',
        constraints: { ...filters, ...(filters.childAges ? { childAges: [...filters.childAges] } : {}) }, stopSettings: settings,
      };
      if (!injected) {
        const itinerary = buildItinerary(entries.map(entry => entry.stop), details, date, asOf);
        if (itinerary.issues.length || itinerary.end >= 1440 || itinerary.duration > (style === 'half-day' ? 240 : 600)) continue;
        details.finishBy = clockLabel(itinerary.end);
        duration = itinerary.duration;
      }
      const km = entries.slice(1).reduce((sum, entry, index) => sum + distanceKm(entries[index].fact.location!, entry.fact.location!), 0);
      results.push({ entries, details, duration, wait, km, notices: [...new Set(notices)] });
    }
    return results.sort((a, b) => a.wait - b.wait || a.duration - b.duration)[0] || null;
  };

  const result: CompleteOuting[] = [];
  for (const style of ['half-day', 'full-day'] as const) {
    let best: Scheduled | null = null;
    for (const anchorTime of anchorTimes) {
      let entries: Entry[] = [{ ...anchor, duration: anchorTime.start != null ? anchorTime.duration : style === 'half-day' ? 90 : 120 }];
      let current = schedule(entries, style, anchorTime);
      const remaining = [...pool].sort((a, b) => {
        const priority = (place: PlannerPlace) => place.category === 'restaurant' ? 0 : (place.category || 'attraction') === 'attraction' ? 1 : place.category === 'cafe' ? 2 : 3;
        return priority(a) - priority(b) || Number(suggestion.placeIds.includes(b.id)) - Number(suggestion.placeIds.includes(a.id)) || distanceKm(event.location!, a.location!) - distanceKm(event.location!, b.location!);
      });
      // A lunch stop that cannot follow an early anchor may become feasible
      // after a museum visit. Retry remaining candidates after each insertion.
      for (let pass = 0; pass < 4 && entries.length < (style === 'half-day' ? 3 : 5); pass++) {
        let added = false;
        for (const place of remaining) {
          if (entries.length >= (style === 'half-day' ? 3 : 5)) break;
          if (entries.some(entry => entry.stop.id === place.id || sameAttraction(place, entry.fact)) || place.category === 'restaurant' && entries.some(isMeal)) continue;
          const entry: Entry = { stop: { kind: 'place', id: place.id }, fact: place, duration: placeDuration(place, style) };
          const choices = Array.from({ length: entries.length + 1 }, (_, position) => schedule([...entries.slice(0, position), entry, ...entries.slice(position)], style, anchorTime)).filter((value): value is Scheduled => !!value);
          const chosen = choices.sort((a, b) => a.wait - b.wait || a.km - b.km || a.duration - b.duration)[0];
          if (chosen) { current = chosen; entries = chosen.entries; added = true; }
        }
        if (!added) break;
      }
      if (!current || current.entries.length < 2 || (style === 'full-day' && (current.entries.length < 3 || current.duration < 300))) continue;
      if (!best || current.entries.length > best.entries.length || (current.entries.length === best.entries.length && current.wait < best.wait)) best = current;
    }
    if (!best) continue;
    const stops = best.entries.map(entry => ({ ...entry.stop }));
    if (result.some(option => option.stops.map(stop => `${stop.kind}:${stop.id}`).sort().join('|') === stops.map(stop => `${stop.kind}:${stop.id}`).sort().join('|'))) continue;
    const label = style === 'half-day' ? '半日' : '一日';
    result.push({ id: `${suggestion.id}-${style}`, title: `${event.city} ${label}出游`, summary: `以「${event.title}」为主活动，搭配 ${stops.length - 1} 个同城地点；${best.details.startTime}–${best.details.finishBy} 为可调整的草稿时段。`, date, stops, details: best.details, notices: best.notices, style });
  }
  return result;
}
