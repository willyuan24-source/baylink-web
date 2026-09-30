import { PLANNER_EVENTS, PLANNER_PLACES } from '../data/planner-catalog';
import { simplifySearch } from '../i18n/locale';
import { eventOccursOn } from './event-calendar';
import { parsePlanEditCommand } from './planner-edit-command';
import { plannerNoticeText } from './planner-copy';
import { clockMinutes, resolveStopTiming, resolveTimeEvidence } from './planner-hours';
import { clockLabel, knownAdmissionUsd, placeMatchesFilters, planBudget, planDetailsError, settingForStop, stopKey } from './planner-itinerary';
import { distanceKm, todayInBay, validDay, type PlanDetails, type PlannerEvent, type PlannerPlace, type Stop } from './planner';
import type { OutingCatalog } from './planner-outings';

export type EditablePlan = { title: string; date: string; stops: Stop[]; details: PlanDetails };
export type PlanEditInput = { current: EditablePlan; message: string; lockedStops?: Stop[]; asOf?: string };
export type PlanEditResult = { status: 'proposal'; nextPlan: EditablePlan; changes: string[]; warnings: string[]; issues: string[]; canApply: boolean }
  | { status: 'unsupported'; reason: string };
const normalized = (value: string) => simplifySearch(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const priceOf = knownAdmissionUsd;
const precisePoint = (fact: PlannerEvent | PlannerPlace) => fact.location?.precision === 'venue' && Number.isFinite(fact.location.lat) && Number.isFinite(fact.location.lng) && Math.abs(fact.location.lat) <= 90 && Math.abs(fact.location.lng) <= 180;
const unavailable = (fact: PlannerEvent | PlannerPlace, date: string) => {
  const place = fact as PlannerPlace & { status?: string; cancelled?: boolean; suspended?: boolean };
  return place.openingStatus === 'announced' || !!place.openedOn && place.openedOn > date || place.cancelled || place.suspended || ['closed', 'cancelled', 'canceled', 'suspended'].includes(place.status || '');
};

/** A proposal is an isolated copy. The caller must explicitly apply it, and must not apply a conflicting proposal. */
export function proposePlanEdit({ current, message, lockedStops = [], asOf = todayInBay() }: PlanEditInput, injected?: OutingCatalog): PlanEditResult {
  const english = !/[\u3400-\u9fff]/.test(message);
  const text = (zh: string, en: string) => english ? en : zh;
  const unsupported = (zh: string, en: string): PlanEditResult => ({ status: 'unsupported', reason: text(zh, en) });
  if (!current || !validDay(current.date) || !validDay(asOf) || !Array.isArray(current.stops) || !current.stops.length || current.stops.length > 6 || !current.details || !Array.isArray(current.details.stopSettings)) return unsupported('先打开一份有有效日期和站点的计划。', 'Open a plan with a valid date and stops first.');
  if (planDetailsError(current.details)) return unsupported('请先修正计划中的时间、人数或费用输入，再提出修改。', 'Correct the plan’s time, party size or cost inputs before requesting an edit.');
  const command = parsePlanEditCommand(message, asOf);
  if (!command) return unsupported('这句话未能完整识别。请一次提出一个明确修改，例如“晚一小时”“删除第2站”或“第二站换成餐厅”。', 'The whole request could not be understood. Ask for one clear change, such as “1 hour later”, “remove stop 2” or “replace stop 2 with a restaurant”.');
  const catalog = injected || { events: PLANNER_EVENTS, places: PLANNER_PLACES };
  const factFor = (stop: Stop) => stop?.kind === 'event' ? catalog.events.find(fact => fact.id === stop.id) : stop?.kind === 'place' ? catalog.places.find(fact => fact.id === stop.id) : undefined;
  if (current.stops.some(stop => !factFor(stop)) || new Set(current.stops.map(stopKey)).size !== current.stops.length) return unsupported('计划包含已无法识别或重复的站点，请先在编辑器中确认。', 'The plan contains unrecognized or duplicate stops; review them in the editor first.');
  const locked = new Set(lockedStops.map(stopKey));
  const nextPlan = structuredClone(current);
  const changes: string[] = [];
  const extraWarnings: string[] = [];
  const validate = (plan: EditablePlan) => {
    const issues: string[] = [], warnings: string[] = [];
    const timings: Record<string, { arrival: number; start: number; end: number }> = {};
    const error = planDetailsError(plan.details);
    if (error) return { issues: [text(error, 'The edited start/end times or allowances are invalid for a same-day plan.')], warnings, timings };
    if (plan.date < asOf) issues.push(text('修改后的日期已经过去。', 'The edited date is in the past.'));
    let cursor = clockMinutes(plan.details.startTime);
    const ages = plan.details.constraints?.childAges?.length ? plan.details.constraints.childAges : plan.details.constraints?.childAge != null ? [plan.details.constraints.childAge] : [];
    plan.stops.forEach((stop, index) => {
      const fact = factFor(stop)!;
      const setting = settingForStop(plan.details, stop, index);
      const evidence = resolveTimeEvidence(fact.planning?.schedule, plan.date, asOf);
      const arrival = cursor + (setting.breakBeforeMinutes || 0) + setting.travelMinutes;
      const timing = resolveStopTiming(evidence, arrival, setting.durationMinutes, setting.fixedStartTime);
      timings[stopKey(stop)] = { arrival, start: timing.start, end: timing.end };
      issues.push(...timing.conflicts.map(item => `${fact.title}: ${english ? item.en : item.zh}`));
      warnings.push(...timing.notices.map(item => `${fact.title}: ${english ? item.en : item.zh}`));
      if (evidence.note) warnings.push(`${fact.title}: ${plannerNoticeText(evidence.note, english)}`);
      if (stop.kind === 'event' && !eventOccursOn(fact as PlannerEvent, plan.date)) issues.push(text(`${fact.title}：新日期没有已收录活动。`, `${fact.title}: no recorded event occurs on the new date.`));
      if (unavailable(fact, plan.date)) issues.push(text(`${fact.title}：所选日期尚未营业或已停办。`, `${fact.title}: not open or available on the selected date.`));
      if (ages.some(age => fact.planning?.minAge != null && age < fact.planning.minAge || fact.planning?.maxAge != null && age > fact.planning.maxAge)) issues.push(text(`${fact.title}：不符合已提供的儿童年龄限制。`, `${fact.title}: does not meet the supplied children’s age limits.`));
      if (fact.planning?.reservation === 'required') warnings.push(text(`${fact.title}：需预约或购票，尚未确认余位。`, `${fact.title}: a reservation or ticket is required; availability is unconfirmed.`));
      if (fact.planning?.programTimeUnconfirmed) warnings.push(text(`${fact.title}：主节目场次尚未确认，场馆开放不代表演出时间。`, `${fact.title}: program times are unconfirmed; venue hours are not show times.`));
      const amount = priceOf(fact);
      if (amount == null) warnings.push(text(`${fact.title}：费用未知，不按免费或零元计算。`, `${fact.title}: cost is unknown and is not treated as free or zero.`));
      if (plan.details.constraints?.freeOnly && amount !== 0) issues.push(text(`${fact.title}：没有符合仅免费条件的已知零元入场费。`, `${fact.title}: no known zero admission price meets the free-only condition.`));
      cursor = Math.max(arrival, timing.start) + setting.durationMinutes;
    });
    if (cursor > clockMinutes(plan.details.finishBy)) issues.push(text(`计划超过结束时间 ${cursor - clockMinutes(plan.details.finishBy)} 分钟。`, `The plan exceeds the finish time by ${cursor - clockMinutes(plan.details.finishBy)} minutes.`));
    if (cursor >= 1440) issues.push(text('计划跨到第二天，目前仅支持当天行程。', 'The plan crosses midnight; only same-day outings are supported.'));
    const budget = planBudget(plan.stops, plan.details, factFor);
    if (budget.overBy > 0) issues.push(text(`已知费用与预留合计 $${budget.subtotal.toFixed(2)}，超过整趟预算。`, `Known costs and allowances total $${budget.subtotal.toFixed(2)}, exceeding the trip budget.`));
    if (budget.admissionOverBy > 0) issues.push(text('已知门票合计超过原有门票预算条件。', 'Known admission prices exceed the original admission budget condition.'));
    if (budget.unknown.length) warnings.push(text('还有费用未知，不能确认整趟符合预算；餐饮、交通与手续费仍需核实。', 'Some costs remain unknown, so the whole outing cannot be confirmed within budget. Recheck meals, transport and fees.'));
    warnings.push(text('交通仍是原有预留，未查询实际路线；修改不会自动预订或购买。', 'Travel times remain your existing allowances, not checked routes. This edit does not book or purchase anything.'));
    return { issues: [...new Set(issues)], warnings: [...new Set(warnings)], timings };
  };
  const refuseLocked = () => unsupported('这个修改会改变锁定站。请先解锁，或只修改其他站点。', 'This change would affect a locked stop. Unlock it first or change another stop.');
  const originalTimings = locked.size ? validate(current).timings : {};
  const changesLockedTiming = (plan: EditablePlan) => {
    if (!locked.size) return false;
    const next = validate(plan).timings;
    return [...locked].some(key => originalTimings[key] && (!next[key] || ['arrival', 'start', 'end'].some(field => originalTimings[key][field as 'arrival'] !== next[key][field as 'arrival'])));
  };

  if (command.kind === 'shift') {
    const clocks = [clockMinutes(nextPlan.details.startTime) + command.minutes, clockMinutes(nextPlan.details.finishBy) + command.minutes];
    if (clocks.some(value => value < 0 || value >= 1440)) return unsupported('整体移动会跨到另一日；请明确修改日期与当天时间。', 'Shifting the whole plan would cross midnight; specify a date and same-day times instead.');
    for (const setting of nextPlan.details.stopSettings) {
      if (!setting.fixedStartTime) continue;
      const recorded = factFor(setting)?.planning?.schedule;
      const evidence = resolveTimeEvidence(recorded, nextPlan.date, asOf);
      if (evidence.status === 'confirmed' && evidence.kind === 'sessions' || recorded?.sessions?.some(session => session.date === nextPlan.date && session.start === setting.fixedStartTime)) {
        extraWarnings.push(text('官方固定场次保持原时刻，没有随整体移动而顺延。', 'Official sessions keep their published times; they have not shifted with the plan.'));
        continue;
      }
      if (locked.has(stopKey(setting))) return refuseLocked();
      const shifted = clockMinutes(setting.fixedStartTime) + command.minutes;
      if (shifted < 0 || shifted >= 1440) return unsupported('某站固定时间会跨日，未应用修改。', 'A stop’s fixed time would cross midnight; no edit was applied.');
      setting.fixedStartTime = clockLabel(shifted);
    }
    nextPlan.details.startTime = clockLabel(clocks[0]); nextPlan.details.finishBy = clockLabel(clocks[1]);
    changes.push(text(`整趟${command.minutes > 0 ? '延后' : '提前'} ${Math.abs(command.minutes)} 分钟；开始 ${nextPlan.details.startTime}，结束 ${nextPlan.details.finishBy}。`, `Shift the whole outing ${Math.abs(command.minutes)} minutes ${command.minutes > 0 ? 'later' : 'earlier'}: start ${nextPlan.details.startTime}, finish ${nextPlan.details.finishBy}.`));
  } else if (command.kind === 'time') {
    nextPlan.details[command.field] = command.value;
    changes.push(text(`${command.field === 'startTime' ? '开始' : '结束'}时间改为 ${command.value}；其他时间设置保留。`, `${command.field === 'startTime' ? 'Start' : 'Finish'} time changes to ${command.value}; other timing settings are kept.`));
  } else if (command.kind === 'date') {
    if (locked.size) return refuseLocked();
    nextPlan.date = command.value;
    if (nextPlan.details.constraints) nextPlan.details.constraints.date = command.value;
    changes.push(text(`日期改为 ${command.value}，重新检查每站时间。`, `Change the date to ${command.value} and recheck each stop’s hours.`));
  } else if (command.kind === 'remove') {
    let removed: Stop[];
    if (command.museums) removed = nextPlan.stops.filter(stop => {
      const fact = factFor(stop)!;
      return (stop.kind === 'event' || (fact as PlannerPlace).category === 'attraction' || !(fact as PlannerPlace).category) && /博物馆|美术馆|\bmuseum\b|exploratorium/i.test(normalized(`${fact.title} ${stop.kind === 'event' ? (fact as PlannerEvent).venue : ''}`));
    });
    else if (command.index != null) removed = nextPlan.stops[command.index] ? [nextPlan.stops[command.index]] : [];
    else {
      const name = normalized(command.name || '');
      removed = name.length >= 2 ? nextPlan.stops.filter(stop => normalized(factFor(stop)!.title) === name) : [];
      if (!removed.length && name.length >= 3) removed = nextPlan.stops.filter(stop => normalized(factFor(stop)!.title).includes(name));
      if (removed.length > 1) return unsupported('这个名称对应多个站点，请指定第几站。', 'That name matches several stops; specify the stop number.');
    }
    if (!removed.length) return unsupported('没有找到要删除的站点，请使用准确名称或站点序号。', 'No matching stop was found. Use its exact name or stop number.');
    if (removed.some(stop => locked.has(stopKey(stop)))) return refuseLocked();
    if (removed.length === nextPlan.stops.length) return unsupported('不能删除全部站点；请至少保留一站。', 'Keep at least one stop; this would remove the whole plan.');
    const removeKeys = new Set(removed.map(stopKey));
    nextPlan.stops = nextPlan.stops.filter(stop => !removeKeys.has(stopKey(stop)));
    nextPlan.details.stopSettings = nextPlan.details.stopSettings.filter(stop => !removeKeys.has(stopKey(stop)));
    changes.push(text(`删除：${removed.map(stop => factFor(stop)!.title).join('、')}。其他站点与预留费用保留。`, `Remove: ${removed.map(stop => factFor(stop)!.title).join(', ')}. Keep the other stops and cost allowances.`));
  } else {
    const previous = nextPlan.stops[command.index];
    if (!previous) return unsupported('这个站点序号不存在。', 'That stop number does not exist.');
    if (locked.has(stopKey(previous))) return refuseLocked();
    const original = factFor(previous)!;
    const originalPrice = priceOf(original);
    if (command.cheaper && originalPrice == null) return unsupported('原站费用未知，无法可靠判断哪个更便宜；请指定换餐厅或咖啡店。', 'The original price is unknown, so a cheaper alternative cannot be verified. Specify a restaurant or café replacement instead.');
    if (command.cheaper && ['restaurant', 'cafe'].includes((original as PlannerPlace).category || '')) return unsupported('已知入场费不代表实际餐饮消费，不能据此宣称哪家餐厅更便宜。', 'Admission prices do not measure meal spending, so they cannot establish which restaurant or café is cheaper.');
    const category = command.category || (previous.kind === 'place' ? (original as PlannerPlace).category || 'attraction' : undefined);
    if (!category) return unsupported('活动类型不同不能仅比较门票替换，请明确要换成餐厅或咖啡店。', 'Different events cannot be substituted solely by ticket price; specify a restaurant or café instead.');
    if (command.cheaper && ['restaurant', 'cafe'].includes(category)) return unsupported('没有已核实的实际餐费可比较，不能把入场费较低当作吃饭更便宜。', 'Actual meal prices are not verified; lower admission cannot establish a cheaper meal.');
    if (!precisePoint(original)) return unsupported('原站缺少精确位置，无法可靠挑选附近替代地点。', 'The original stop lacks a precise location, so nearby replacements cannot be checked.');
    const neighbors = [nextPlan.stops[command.index - 1], nextPlan.stops[command.index + 1]].filter((stop): stop is Stop => !!stop).map(stop => factFor(stop)!);
    const maxKm = nextPlan.details.travelMode === 'walk' ? 2 : 5;
    const filters = { ...nextPlan.details.constraints, city: undefined, partySize: nextPlan.details.partySize };
    const candidates = catalog.places.filter(place => !nextPlan.stops.some(stop => stop.kind === 'place' && stop.id === place.id) && !unavailable(place, nextPlan.date)
      && (place.category || 'attraction') === category && precisePoint(place) && normalized(place.city) === normalized(original.city)
      && !/alcatraz|angel[- ]island|必须.{0,3}渡轮|requires? (?:a )?ferry/i.test(`${place.id} ${place.summary}`)
      && distanceKm(original.location!, place.location!) <= maxKm
      && neighbors.every(neighbor => precisePoint(neighbor) && normalized(neighbor.city) === normalized(place.city) && distanceKm(neighbor.location!, place.location!) <= maxKm)
      && !(category === 'attraction' && neighbors.some(neighbor => distanceKm(neighbor.location!, place.location!) <= 0.03 && ('startDate' in neighbor || !(neighbor as PlannerPlace).category || (neighbor as PlannerPlace).category === 'attraction')))
      && placeMatchesFilters(place, filters)
      && (!command.cheaper || priceOf(place) != null && priceOf(place)! < originalPrice!)
      && resolveTimeEvidence(place.planning?.schedule, nextPlan.date, asOf).status === 'confirmed');
    candidates.sort((a, b) => command.cheaper ? priceOf(a)! - priceOf(b)! || a.id.localeCompare(b.id) : distanceKm(original.location!, a.location!) - distanceKm(original.location!, b.location!) || a.id.localeCompare(b.id));
    let replacement: PlannerPlace | undefined;
    for (const candidate of candidates) {
      const attempt = structuredClone(nextPlan);
      attempt.stops[command.index] = { kind: 'place', id: candidate.id };
      const setting = settingForStop(nextPlan.details, previous, command.index);
      attempt.details.stopSettings = nextPlan.details.stopSettings.filter(stop => stopKey(stop) !== stopKey(previous));
      attempt.details.stopSettings.push({ ...setting, kind: 'place', id: candidate.id });
      if (validate(attempt).issues.length || changesLockedTiming(attempt)) continue;
      nextPlan.stops = attempt.stops; nextPlan.details.stopSettings = attempt.details.stopSettings; replacement = candidate; break;
    }
    if (!replacement) return unsupported('没有找到同时满足原条件、已核实营业时段及当前时间安排的替代地点；未替换任何站。', 'No replacement meets the original conditions, recorded hours and current schedule together. No stop was replaced.');
    changes.push(text(`第 ${command.index + 1} 站：${original.title} → ${replacement.title}；其他站点与预留费用保留。`, `Stop ${command.index + 1}: ${original.title} → ${replacement.title}. Keep the other stops and cost allowances.`));
    extraWarnings.push(text('更换地点后原交通时间仍是预留，请自行核对实际路程。', 'After changing the stop, the original travel time remains an allowance; check the actual journey.'));
    if (command.cheaper) extraWarnings.push(text('更便宜仅比较已知入场起价，不包含餐饮、交通与手续费。', 'Cheaper compares known starting admission prices only, excluding meals, transport and fees.'));
  }
  if (changesLockedTiming(nextPlan)) return refuseLocked();
  const { issues, warnings } = validate(nextPlan);
  return { status: 'proposal', nextPlan, changes, warnings: [...new Set([...extraWarnings, ...warnings])], issues, canApply: issues.length === 0 };
}
