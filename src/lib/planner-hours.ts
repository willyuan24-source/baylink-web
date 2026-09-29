import type { PlanningSchedule, TimeWindow } from './planner';
import { getBayAreaToday } from './monthly';
import { validCalendarDay } from './event-calendar';

export const TIME_EVIDENCE_MAX_AGE_DAYS = 45;
export type TimeNotice = { code: string; zh: string; en: string };
export type TimeEvidence = {
  status: 'confirmed' | 'closed' | 'unknown' | 'stale' | 'out-of-range' | 'invalid';
  kind: 'hours' | 'sessions' | 'unknown';
  windows: TimeWindow[];
  sessions: NonNullable<PlanningSchedule['sessions']>;
  sourceUrl?: string;
  verifiedAt?: string;
  note?: string;
  notices: TimeNotice[];
};
export const timeNotice = (code: string, zh: string, en: string): TimeNotice => ({ code, zh, en });
export const clockMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const validTime = (value: unknown, allowMidnight = false): value is string => typeof value === 'string' && (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) || allowMidnight && value === '24:00');
const safeSource = (value: unknown): value is string => {
  try { return typeof value === 'string' && ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
};
const validWindow = (value: TimeWindow) => !!value && validTime(value.open) && validTime(value.close, true) && clockMinutes(value.open) < clockMinutes(value.close) &&
  [value.lastEntry, value.lastOrder].every(limit => limit === undefined || validTime(limit) && clockMinutes(limit) >= clockMinutes(value.open) && clockMinutes(limit) <= clockMinutes(value.close));

/** Only structured, dated source evidence can constrain a stop; editorial prose is never parsed as hours. */
export function resolveTimeEvidence(schedule: PlanningSchedule | undefined, date: string, asOf = getBayAreaToday()): TimeEvidence {
  const evidence: TimeEvidence = { status: 'unknown', kind: 'unknown', windows: [], sessions: [], notices: [] };
  if (!schedule) {
    evidence.notices.push(timeNotice('hours-unknown', '官方营业时间或场次尚未收录，请出发前确认。', 'Official hours or sessions are not recorded; check before visiting.'));
    return evidence;
  }
  if (safeSource(schedule.sourceUrl)) evidence.sourceUrl = schedule.sourceUrl;
  evidence.verifiedAt = schedule.verifiedAt;
  evidence.note = schedule.note;
  const invalid = (zh: string, en: string) => { evidence.status = 'invalid'; evidence.notices.push(timeNotice('hours-invalid', zh, en)); return evidence; };
  if (!validCalendarDay(date) || !validCalendarDay(asOf)) return invalid('先选择有效日期，再核对官方时间。', 'Choose a valid date to check official times.');
  if (!safeSource(schedule.sourceUrl) || !validCalendarDay(schedule.verifiedAt) || schedule.verifiedAt > asOf ||
    (schedule.validFrom !== undefined && !validCalendarDay(schedule.validFrom)) || (schedule.validThrough !== undefined && !validCalendarDay(schedule.validThrough)) ||
    (schedule.validFrom && schedule.validThrough && schedule.validFrom > schedule.validThrough)) {
    return invalid('时间资料缺少有效来源或核对日期，目前不能确认营业。', 'The time record lacks valid source or verification information; opening is unconfirmed.');
  }
  if (schedule.validFrom && date < schedule.validFrom || schedule.validThrough && date > schedule.validThrough) {
    evidence.status = 'out-of-range';
    evidence.notices.push(timeNotice('hours-out-of-range', '所选日期不在这份时间规则的有效范围内，需重新确认。', 'This date is outside the rule’s published validity period; recheck the hours.'));
    return evidence;
  }
  const age = (Date.parse(`${asOf}T12:00:00Z`) - Date.parse(`${schedule.verifiedAt}T12:00:00Z`)) / 86400000;
  if (age > TIME_EVIDENCE_MAX_AGE_DAYS) {
    evidence.status = 'stale';
    evidence.notices.push(timeNotice('hours-stale', `时间资料已超过 ${TIME_EVIDENCE_MAX_AGE_DAYS} 天未核对，不用于保证营业或自动安排场次。`, `These hours have not been checked in over ${TIME_EVIDENCE_MAX_AGE_DAYS} days and are not used to guarantee opening or schedule a session.`));
    return evidence;
  }
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const dated = schedule.dates && Object.prototype.hasOwnProperty.call(schedule.dates, date);
  const windows = dated ? schedule.dates![date] : schedule.weekly?.[weekday];
  if (windows !== undefined) {
    if (!Array.isArray(windows) || !windows.every(validWindow)) return invalid('官方时段格式存在问题，暂不据此安排；请查看来源。', 'The published time record is inconsistent; check the source before scheduling.');
    evidence.windows = [...windows].sort((a, b) => a.open.localeCompare(b.open));
    evidence.kind = 'hours';
  }
  if (schedule.sessions !== undefined) {
    if (!Array.isArray(schedule.sessions) || !schedule.sessions.every(session => session && validCalendarDay(session.date) && validTime(session.start) && (session.end === undefined || validTime(session.end, true) && clockMinutes(session.end) > clockMinutes(session.start)))) {
      return invalid('官方场次格式存在问题，暂不据此安排；请查看来源。', 'The session record is inconsistent; check its source before scheduling.');
    }
    evidence.sessions = schedule.sessions.filter(session => session.date === date).map(session => ({ ...session })).sort((a, b) => a.start.localeCompare(b.start));
    if (evidence.sessions.length) evidence.kind = 'sessions';
  }
  if (dated && evidence.windows.length === 0 && evidence.sessions.length) return invalid('同日闭馆与场次资料互相冲突，请核实官方公告。', 'The closure and session records conflict on this date; check the official announcement.');
  if (evidence.sessions.length || evidence.windows.length) evidence.status = 'confirmed';
  else if (windows !== undefined) {
    evidence.status = 'closed';
    evidence.notices.push(timeNotice('closed-day', '官方规则列明所选日期不开放。', 'The published rule marks this date as closed.'));
  } else evidence.notices.push(timeNotice('hours-day-unknown', '没有所选日期的明确营业时间或场次，不能保证开放。', 'No explicit hours or sessions are recorded for this date; opening is unconfirmed.'));
  return evidence;
}

export function timeEvidenceLabel(evidence: TimeEvidence, english = false): string {
  const labels = {
    unknown: ['官方时间待确认', 'Official times unconfirmed'], stale: ['时间资料需重新核对', 'Time record needs rechecking'],
    'out-of-range': ['时间规则不适用于此日期', 'Time rule does not cover this date'], invalid: ['时间资料需核实', 'Time evidence needs checking'],
    closed: ['官方规则：当天不开放', 'Published rule: closed that day'], confirmed: ['已收录官方时间', 'Official times recorded'],
  };
  if (evidence.status !== 'confirmed') return labels[evidence.status][english ? 1 : 0];
  if (evidence.kind === 'sessions') return `${english ? 'Official sessions' : '官方固定场次'}：${evidence.sessions.map(session => `${session.start}${session.end ? `–${session.end}` : english ? ' (end unknown)' : '（结束未确认）'}`).join(' / ')}`;
  return `${english ? 'Official hours' : '官方营业时间'}：${evidence.windows.map(window => `${window.open}–${window.close}${window.lastEntry ? ` (${english ? 'last entry' : '最晚入场'} ${window.lastEntry})` : ''}${window.lastOrder ? ` (${english ? 'last order' : '最后点单'} ${window.lastOrder})` : ''}`).join(' / ')}`;
}

export function resolveStopTiming(evidence: TimeEvidence, arrival: number, duration: number, fixedStartTime?: string) {
  const conflicts: TimeNotice[] = [];
  const notices = [...evidence.notices];
  const userFixed = fixedStartTime ? clockMinutes(fixedStartTime) : undefined;
  let start = Math.max(arrival, userFixed ?? arrival);
  let late = userFixed !== undefined && arrival > userFixed;
  let lateByMinutes = userFixed !== undefined ? Math.max(0, arrival - userFixed) : 0;
  if (late) conflicts.push(timeNotice('user-start-missed', `按当前预留时间，晚于你设置的开始时间 ${fixedStartTime}。`, `The current buffers arrive after your chosen start time, ${fixedStartTime}.`));
  if (evidence.status === 'closed') conflicts.push(timeNotice('closed-day', '所选日期按官方规则不开放，请更换日期或去处。', 'The published rule marks this date as closed; change the date or stop.'));
  if (evidence.status === 'confirmed') {
    const selected = evidence.sessions.length === 1 ? evidence.sessions[0] : evidence.sessions.find(session => session.start === fixedStartTime);
    if (evidence.sessions.length > 1 && !selected) {
      if (fixedStartTime) conflicts.push(timeNotice('session-mismatch', '你设置的开始时间不对应任何已收录官方场次。', 'Your chosen start time does not match a recorded official session.'));
      else if (arrival > Math.max(...evidence.sessions.map(session => clockMinutes(session.start)))) conflicts.push(timeNotice('all-sessions-missed', '预计到达已晚于当天最后一场官方开场时间。', 'Arrival is after the final official session starts that day.'));
      else conflicts.push(timeNotice('session-unselected', '当天有多个官方场次，请选择其中一场后再导出日历。', 'Several official sessions are available; choose one before exporting the calendar.'));
    }
    if (selected) {
      start = clockMinutes(selected.start);
      if (fixedStartTime && fixedStartTime !== selected.start) conflicts.push(timeNotice('session-mismatch', `你设置的开始时间与官方 ${selected.start} 场次不一致；未移动官方场次。`, `Your start time differs from the official ${selected.start} session; that session has not been moved.`));
      if (arrival > start) {
        late = true;
        lateByMinutes = Math.max(lateByMinutes, arrival - start);
        conflicts.push(timeNotice('session-missed', `预计到达晚于官方 ${selected.start} 开场；不能把场次顺延。`, `Arrival is after the official ${selected.start} start; the session cannot be shifted.`));
      }
      if (!selected.end) notices.push(timeNotice('session-end-unknown', '官方结束时间未确认，离开时间仍按你的停留预留计算。', 'The official end time is unconfirmed; departure uses your stay allowance.'));
      else if (start + duration > clockMinutes(selected.end)) conflicts.push(timeNotice('session-overrun', `停留超出官方场次结束 ${selected.end}，请调整。`, `Your stay extends beyond the official session end, ${selected.end}; adjust the duration.`));
      else if (start + duration < clockMinutes(selected.end)) notices.push(timeNotice('session-leave-early', `计划在官方 ${selected.end} 结束前离开；请确认可提前离场。`, `You plan to leave before the official ${selected.end} end; confirm that early departure is possible.`));
    }
    if (evidence.windows.length) {
      const canWait = !selected && userFixed === undefined;
      const fittingWindow = canWait ? evidence.windows.find(item => {
        const entry = Math.max(start, clockMinutes(item.open));
        return entry + duration <= clockMinutes(item.close) && [item.lastEntry, item.lastOrder].every(limit => !limit || entry <= clockMinutes(limit));
      }) : undefined;
      const window = fittingWindow || evidence.windows.find(item => clockMinutes(item.close) > start);
      if (!window) conflicts.push(timeNotice('after-closing', '到达或开始时间已晚于当天开放时段。', 'Arrival or start time is after the day’s opening hours.'));
      else {
        const open = clockMinutes(window.open);
        if (start < open) {
          if (selected || userFixed !== undefined) conflicts.push(timeNotice('before-opening-fixed', `指定开始时间早于官方 ${window.open} 开门，未擅自更改。`, `The fixed start is before official opening at ${window.open}; it has not been moved.`));
          else { start = open; notices.push(timeNotice('wait-for-opening', `提前到达，自动预留等候至 ${window.open} 开门。`, `Early arrival includes a wait until opening at ${window.open}.`)); }
        }
        if (window.lastEntry && start > clockMinutes(window.lastEntry)) conflicts.push(timeNotice('last-entry-missed', `开始时间晚于官方最晚入场 ${window.lastEntry}。`, `The visit starts after last entry at ${window.lastEntry}.`));
        if (window.lastOrder && start > clockMinutes(window.lastOrder)) conflicts.push(timeNotice('last-order-missed', `开始时间晚于官方最后点单 ${window.lastOrder}。`, `The visit starts after the last order time at ${window.lastOrder}.`));
        if (start + duration > clockMinutes(window.close)) conflicts.push(timeNotice('closing-overrun', `停留超出官方 ${window.close} 关门时间。`, `The visit extends beyond official closing at ${window.close}.`));
      }
    }
  }
  return { start, end: start + duration, wait: Math.max(0, start - arrival), late, lateByMinutes, conflicts, notices };
}
