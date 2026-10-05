import { useEffect, useRef, useState } from 'react';
import { ChevronDown, MapPin, Route, LoaderCircle } from 'lucide-react';
import { useLocale, translateText } from '../i18n/locale';
import { api } from '../lib/api';
import { buildItinerary, clockLabel, factsForStop } from '../lib/planner-itinerary';
import { stopTitle, validDay, type PlanDetails, type Stop } from '../lib/planner';
import { isPlannerTravelEstimate, plannerLegMapUrl, type PlannerTravelEstimate } from '../lib/planner-travel';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
type Props = { stops: Stop[]; date: string; details: PlanDetails; ownerId?: string; sessionKey?: string; onLogin?: () => void };
export function PlannerTravelCheck(props: Props) {
  if (props.stops.length < 2) return null;
  return <TravelDisclosure {...props}/>;
}
function TravelDisclosure(props: Props) {
  const locale = useLocale(), [open, setOpen] = useState(false);
  return <details className="planner-travel-check" onToggle={event => setOpen(event.currentTarget.open)} translate="no"><summary className="planner-travel-actions"><Route size={17}/><strong>{locale === 'en' ? 'Will these stops fit? Check travel' : translateText('这几站来得及吗？核对交通', locale)}</strong><ChevronDown size={15} aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }}/></summary>{open && <TravelCheckContents key={JSON.stringify([props.ownerId || 'guest', props.sessionKey])} {...props}/>}</details>;
}
function TravelCheckContents({ stops, date, details, ownerId, onLogin }: Props) {
  const locale = useLocale(), t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const [available, setAvailable] = useState(false), hasLegs = stops.length >= 2;
  const [authRequired, setAuthRequired] = useState(!ownerId);
  useEffect(() => {
    setAvailable(false);
    if (!hasLegs || !ownerId) return;
    const controller = new AbortController();
    void api.request('/planner/travel-capabilities', { signal: controller.signal }).then((value: unknown) => {
      if (!controller.signal.aborted) {
        const blocked = record(value) && record(value.webAccess) && value.webAccess.allowed === false;
        setAuthRequired(blocked); setAvailable(!blocked && record(value) && value.available === true);
      }
    }).catch(error => { if (!controller.signal.aborted) { setAvailable(false); if (record(error) && error.status === 401) setAuthRequired(true); } });
    return () => controller.abort();
  }, [hasLegs, ownerId]);
  const timeline = buildItinerary(stops, details, date);
  return <section aria-label={t('逐段核对交通', 'Check travel between stops')}><p>{t('按每段出发时间核对路程。结果仅供这次查看，停车、进站和步行到入口需另外预留。', 'Check each leg at its planned departure time. Estimates are for this view; allow extra time for parking, station access and walking to entrances.')}</p>
    {authRequired && <p role="status">{t('登录后可查询站外路程估算；也可自行打开地图核对。当前计划不会改变。', 'Sign in to request external route estimates, or check Maps yourself. Your plan is unchanged.')} {onLogin && <button type="button" onClick={onLogin}>{t('登录 / 注册', 'Sign in / register')}</button>}</p>}
    {timeline.rows.slice(1).map((row, index) => { const from = stops[index], time = clockLabel(row.arrival - row.settings.travelMinutes); return <TravelLeg key={JSON.stringify([from, row.stop, date, time, details.travelMode, row.settings.travelMinutes, authRequired])} from={from} to={row.stop} date={date} time={time} mode={details.travelMode} allowance={row.settings.travelMinutes} available={available} onAuthRequired={() => { setAuthRequired(true); setAvailable(false); }} />; })}
  </section>;
}
function TravelLeg({ from, to, date, time, mode, allowance, available, onAuthRequired }: { from: Stop; to: Stop; date: string; time: string; mode: PlanDetails['travelMode']; allowance: number; available: boolean; onAuthRequired: () => void }) {
  const locale = useLocale(), t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const [result, setResult] = useState<PlannerTravelEstimate>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const accurate = [from, to].every(stop => factsForStop(stop)?.location?.precision === 'venue');
  const ready = accurate && validDay(date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) && mode !== 'any';
  const check = async () => {
    if (!available || !ready || request.current) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError(''); setResult(undefined);
    try {
      const value: unknown = await api.request('/planner/travel-estimate', { method: 'POST', signal: controller.signal, body: JSON.stringify({ from, to, date, time, travelMode: mode, locale }) });
      if (!isPlannerTravelEstimate(value, { from, to, date, time, mode })) throw Error('Invalid estimate');
      if (!controller.signal.aborted) setResult(value);
    } catch (error) { if (!controller.signal.aborted) { if (record(error) && error.status === 401) onAuthRequired(); else setError(t('这次未能取得站内路程估计。请打开地图核对日期、时间与班次，当前预留没有改变。', 'An in-app estimate is unavailable. Open Maps to check your date, time and service. Your allowance is unchanged.')); } }
    finally { if (!controller.signal.aborted) { request.current = null; setBusy(false); } }
  };
  return <article className="planner-travel-leg"><strong>{stopTitle(from)} <span aria-hidden="true">→</span> {stopTitle(to)}</strong><p>{t('出发', 'Depart')} {time} · {t('当前交通预留', 'Current allowance')} {allowance} {t('分钟', 'min')}</p>
    <div className="planner-travel-actions">{available && ready && <button type="button" disabled={busy} onClick={() => void check()}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Route size={14} />}{busy ? t('查询中…', 'Checking…') : t('核对这段路程', 'Check this leg')}</button>}<a href={plannerLegMapUrl(from, to, mode)} target="_blank" rel="noopener noreferrer"><MapPin size={14} />{t('打开地图核对', 'Check on Maps')} ↗</a></div>
    {available && !ready && <p>{t('选好有效日期、时间、交通方式与准确地点后，可查询路程。', 'Choose a valid date, time, travel mode and precise places to request an estimate.')}</p>}
    {error && <p role="status">{error}</p>}
    {result && <div className="planner-travel-estimate"><span className="google-maps-attribution" translate="no">Google Maps</span><p><strong>{result.durationMinutes} {t('分钟', 'min')}</strong> · {(result.distanceMeters / 1609.344).toFixed(1)} mi</p><p>{result.durationMinutes > allowance ? t(`路程估计比预留多 ${result.durationMinutes - allowance} 分钟，请调整后续安排。`, `The estimate exceeds your allowance by ${result.durationMinutes - allowance} minutes. Review later stops.`) : t('路程估计在预留内；仍需考虑停车、等候与临时变化。', 'The estimate fits your allowance; account for parking, waiting and changes.')}</p>{result.warnings.map((warning, index) => <p key={index}>{warning}</p>)}{mode === 'walk' && <p>{t('步行路线可能缺少人行道或步道信息，请以现场情况为准。', 'Walking routes may omit sidewalk or path information. Follow local conditions.')}</p>}</div>}
  </article>;
}
