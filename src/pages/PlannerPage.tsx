import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MapPin, Sparkles, Plus, X, Share2, ArrowUp, ChevronRight, SlidersHorizontal, Square, Printer, WifiOff } from 'lucide-react';
import { useApp } from '../app/context';
import { api } from '../lib/api';
import { useLocale, translateText } from '../i18n/locale';
import { ATTRACTION_REGIONS } from '../data/attractions';
import { PLANNER_EVENTS, PLANNER_PLACES } from '../data/planner-catalog';
import { favoriteKey, cleanStops, errorText, MAX_PLAN_STOPS, parseSharedPlan, sharePlanUrl, stopPath, stopTitle, todayInBay, type PlanDetails, type PlanFilters, type Recommendations, type SavedPlan, type Stop } from '../lib/planner';
import { usePlannerLibrary } from '../lib/planner-library';
import { saveKey } from '../lib/saves';
import { PlannerMap } from '../components/PlannerMap';
import { PlannerAccountNotice } from '../components/PlannerAccountNotice';
import { setPageMetadata } from '../lib/seo';
import { PLAN_METADATA } from '../lib/planner';
import { recordProductEvent } from '../lib/product-events';
import { eventOccursOn } from '../lib/event-calendar';
import { canonicalEventId } from '../lib/event-id';
import { EventScreenshotImport } from '../components/EventScreenshotImport';
import { PlannerSchedule } from '../components/PlannerSchedule';
import { PlannerOutingOptions, PlannerPlaceOutingOptions } from '../components/PlannerOutingOptions';
import { PlannerPlanEdit } from '../components/PlannerPlanEdit';
import { PlannerPlanOverview } from '../components/PlannerPlanOverview';
import { createOutingPlanHandoff } from '../lib/outing-plan-handoff';
import { bayBayAdmissionOverride, readBayBayPlanDraft, readBayBayRequirementsDraft } from '../lib/baybay-plan-handoff';
import { BayBayImportedRequirements } from '../components/BayBayImportedRequirements';
import { PlannerWebSearch } from '../components/PlannerWebSearch';
import { PlannerPlaceRecommendations } from '../components/PlannerPlaceRecommendations';
import type { CompleteOuting } from '../lib/planner-outings';
import { defaultPlanDetails, normalizePlanDetails, nearbyPlaces, placeMatchesFilters, factsForStop, planDetailsError } from '../lib/planner-itinerary';
import { createCoverPage, resolveCovers } from '../lib/cover';
import { PlannerDayPlans } from '../components/PlannerDayPlans';
import { PlannerCatalogCard, type PlannerCatalogItem } from '../components/PlannerCatalogCard';
import { PlannerImageCredits, PlannerOptionCover } from '../components/PlannerStopCover';
import { stopCoverImage, stopCoverItem } from '../lib/plan-stop-cover';
import { Button, IconButton } from '../components/ui/Button';
import { ChipRow, FilterChip } from '../components/ui/Chip';
import { PageContainer, PageHeader } from '../components/ui/HeroCard';
import '../styles/plan-page.css';

/** Whether the browser says it is online; the page keeps working from this device's data when it is not (RC-25). */
function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export default function PlannerPage() {
  const app = useApp();
  // Drafts, inferred preferences and in-flight searches belong to one account.
  return <PlannerWorkspace key={app?.user?.id || 'guest'} />;
}

function PlannerWorkspace() {
  const app = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const requirementsDraftId = params.get('baybayBrief');
  const requirementsOwnerId = app?.user?.id || undefined;
  const requirementsDraft = readBayBayRequirementsDraft(requirementsDraftId, requirementsOwnerId);
  // Locale/query cleanup cannot reload or erase edits to a successfully imported private draft.
  const queryMessage = requirementsDraftId !== null ? requirementsDraft?.message || '' : params.get('q')?.trim().slice(0, 800) || '';
  const planSearch = useMemo(() => {
    const incoming = new URLSearchParams(location.search), plan = new URLSearchParams();
    for (const key of ['date', 'stops', 'places', 'edit', 'baybayDraft']) if (incoming.has(key)) plan.set(key, incoming.get(key)!);
    return plan.toString();
  }, [location.search]);
  const shared = useMemo(() => parseSharedPlan(planSearch), [planSearch]);
  const importedDraft = useMemo(() => readBayBayPlanDraft(new URLSearchParams(planSearch).get('baybayDraft'), app?.user?.id), [planSearch, app?.user?.id]);
  const locale = useLocale();
  useEffect(() => { setPageMetadata(PLAN_METADATA); }, [locale]);
  const library = usePlannerLibrary(app?.user?.id);
  const online = useOnline();
  const today = todayInBay();
  // One cover page for the saved days, the list and the suggestions: the same photo never shows twice on the page.
  const coverPage = useMemo(() => createCoverPage(), []);
  const [message, setMessage] = useState(queryMessage);
  const [date, setDate] = useState(shared.date);
  const [searchDate, setSearchDate] = useState<string>();
  const requestedDate = searchDate ?? date;
  const [region, setRegion] = useState('all');
  const [budget, setBudget] = useState('');
  const [age, setAge] = useState('');
  const [setting, setSetting] = useState('any');
  const [travel, setTravel] = useState('any');
  const [catalogCategory, setCatalogCategory] = useState('all');
  const [catalogLimit, setCatalogLimit] = useState(12);
  useEffect(() => { setCatalogLimit(12); }, [catalogCategory, region, budget, age, setting, travel, requestedDate]);
  const [results, setResults] = useState<Recommendations | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [stops, setStops] = useState<Stop[]>(shared.stops);
  const [title, setTitle] = useState(() => translateText('我的湾区出游', locale));
  const [editing, setEditing] = useState<SavedPlan>();
  const [selected, setSelected] = useState('');
  const [details, setDetails] = useState<PlanDetails>(defaultPlanDetails);
  const [undo, setUndo] = useState<{ stops: Stop[]; date: string; searchDate?: string; title: string; details: PlanDetails; editing?: SavedPlan; filters: PlanFilters; region: string; budget: string; age: string; setting: string; travel: string }>();
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [persistedFilters, setPersistedFilters] = useState<PlanFilters>({});
  const excludedEvents = useRef<string[]>([]);
  const excludedPlaces = useRef<string[]>([]);
  const request = useRef<AbortController>();
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const editLoaded = useRef('');
  const prefsLoaded = useRef(false);
  const autoStarted = useRef(new Set<string>());
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (results) resultsHeading.current?.scrollIntoView?.({ block: 'start', behavior: 'auto' }); }, [results]);
  useEffect(() => { request.current?.abort(); setRequesting(false); setResults(null); setError(''); setMessage(queryMessage); }, [queryMessage]);
  useEffect(() => {
    setEditing(undefined); setSearchDate(undefined); setStops(importedDraft?.stops || shared.stops); setDate(importedDraft?.date || shared.date);
    setTitle(importedDraft?.title || translateText('我的湾区出游')); setDetails(importedDraft?.details || defaultPlanDetails()); setPersistedFilters(importedDraft?.details.constraints || {});
    setUndo(undefined); setReplaceIndex(null); editLoaded.current = ''; prefsLoaded.current = !!importedDraft;
    if (importedDraft) { const filters = importedDraft.details.constraints || {}; setRegion(filters.region || 'all'); setBudget(''); setAge(String(filters.childAge ?? '')); setSetting(filters.setting || 'any'); setTravel(importedDraft.details.travelMode); }
  }, [app?.user?.id, planSearch, importedDraft, shared]);
  useEffect(() => {
    if (new URLSearchParams(planSearch).has('edit')) return;
    const next = importedDraft || parseSharedPlan(planSearch); setStops(next.stops); setDate(next.date); setEditing(undefined); editLoaded.current = '';
  }, [planSearch, importedDraft]);
  useEffect(() => {
    if (!library.ready) return;
    if (!prefsLoaded.current) { prefsLoaded.current = true; setRegion(queryMessage ? 'all' : library.data.preferences.regions[0] || 'all'); setTravel(queryMessage ? 'any' : library.data.preferences.travelMode || 'any'); if (!queryMessage) { setBudget(String(library.data.preferences.admissionBudgetUsd ?? '')); setSetting(library.data.preferences.setting || 'any'); } }
    const id = new URLSearchParams(planSearch).get('edit') || editing?.id;
    if (id) {
      const plan = library.data.plans.find(plan => plan.id === id);
      if (plan && editLoaded.current !== `${id}:${plan.version}`) { editLoaded.current = `${id}:${plan.version}`; setEditing(plan); setStops(cleanStops(plan.stops)); setDate(plan.date); setTitle(plan.title); const savedDetails = normalizePlanDetails(plan.details, cleanStops(plan.stops)); setDetails(savedDetails); const filters = savedDetails.constraints; setPersistedFilters(filters || {}); if (filters) { setRegion(filters.region || 'all'); setBudget(filters.budgetScope === 'total' ? '' : String(filters.budget ?? '')); setAge(String(filters.childAge ?? '')); setSetting(filters.setting || 'any'); setTravel(filters.travelMode || savedDetails.travelMode); } }
    }
  }, [library.ready, library.data, planSearch, editing?.id, queryMessage]);

  const effectiveFilters = useMemo<PlanFilters>(() => results?.filters || { ...persistedFilters, date: requestedDate || undefined, region, ...(budget !== '' ? { budget: Number(budget) } : {}), ...(age !== '' ? { childAge: Number(age) } : {}), setting, travelMode: travel }, [results, requestedDate, region, budget, age, setting, travel, persistedFilters]);
  const admissionOverride = bayBayAdmissionOverride(importedDraft, date, stops, details, effectiveFilters);
  const filteredPlaces = useMemo(() => PLANNER_PLACES.filter(place => placeMatchesFilters(place, effectiveFilters)), [effectiveFilters]);
  const visiblePlaces = useMemo(() => filteredPlaces.filter(place => catalogCategory === 'all' || (place.category || 'attraction') === catalogCategory), [filteredPlaces, catalogCategory]);
  const events = useMemo(() => results?.suggestions.map(s => PLANNER_EVENTS.find(event => event.id === canonicalEventId(s.eventId))).filter(event => !!event) || PLANNER_EVENTS.filter(event => event.endDate >= todayInBay() && (event.occurrenceDates === undefined || event.occurrenceDates.some(day => day >= todayInBay())) && (region === 'all' || event.region === region) && (!requestedDate || eventOccursOn(event, requestedDate))).slice(0, 8), [results, region, requestedDate]);
  const points = useMemo(() => [...events.map(event => ({ key: `event:${event.id}`, title: event.title, location: event.location })), ...filteredPlaces.map(place => ({ key: `place:${place.id}`, title: place.title, location: place.location }))].filter((point): point is { key: string; title: string; location: NonNullable<typeof point.location> } => !!point.location), [events, filteredPlaces]);
  const anchor = points.find(point => point.key === selected) || points.find(point => stops.some(stop => favoriteKey(stop) === point.key));
  const anchorRecord = anchor ? factsForStop({ kind: anchor.key.startsWith('event:') ? 'event' : 'place', id: anchor.key.split(':')[1] }) : undefined;
  const nearby = anchorRecord ? nearbyPlaces(anchorRecord, filteredPlaces, effectiveFilters) : [];
  const choose = (key: string) => { setCatalogLimit(10000); setSelected(key); document.getElementById(`catalog-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
  const remember = () => setUndo({ stops, date, searchDate, title, details, editing, filters: persistedFilters, region, budget, age, setting, travel });
  const restoreUndo = () => {
    if (!undo) return;
    request.current?.abort(); request.current = undefined; setRequesting(false); setResults(null);
    setStops(undo.stops); setDate(undo.date); setTitle(undo.title); setDetails(undo.details); setEditing(undo.editing);
    setSearchDate(undo.searchDate);
    const filters = undo.details.constraints || undo.filters;
    setPersistedFilters(filters); setRegion(filters.region || undo.region);
    setBudget(filters.budgetScope === 'total' ? '' : filters.budget != null ? String(filters.budget) : undo.budget);
    setAge(filters.childAge != null ? String(filters.childAge) : undo.age);
    setSetting(filters.setting || undo.setting); setTravel(filters.travelMode || undo.travel);
    setUndo(undefined); setReplaceIndex(null); setStatus('');
  };
  const applyOuting = (outing: CompleteOuting) => {
    remember(); setReplaceIndex(null); setEditing(undefined);
    request.current?.abort(); request.current = undefined; setRequesting(false); setSearchDate(undefined);
    recordProductEvent('planner_outing_adopted');
    const filters = outing.details.constraints || results?.filters || {};
    setStops(cleanStops(outing.stops)); setDate(outing.date); setTitle(outing.title);
    setDetails(normalizePlanDetails(outing.details, outing.stops));
    setRegion(filters.region || 'all'); setBudget(filters.budgetScope === 'total' ? '' : String(filters.budget ?? ''));
    setAge(String(filters.childAge ?? '')); setSetting(filters.setting || 'any'); setTravel(filters.travelMode || outing.details.travelMode);
    setPersistedFilters(filters); setSelected(`${outing.stops[0].kind}:${outing.stops[0].id}`);
    setStatus(locale === 'en' ? 'Your outing is ready to edit. Check reservations and fill in meal and transport allowances.' : '完整方案已放入行程。请确认预约，并补充餐饮与交通预算。');
    document.getElementById('outing-plan')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
  const beginPlan = (nextStops: Stop[], nextDate: string, name: string, filters: PlanFilters) => {
    remember(); setReplaceIndex(null); setEditing(undefined);
    request.current?.abort(); request.current = undefined; setRequesting(false); setSearchDate(undefined);
    setStops(cleanStops(nextStops)); setDate(nextDate); setTitle(translateText(name, locale));
    setRegion(filters.region || 'all'); setBudget(filters.budgetScope === 'total' ? '' : String(filters.budget ?? ''));
    setAge(String(filters.childAge ?? '')); setSetting(filters.setting || 'any'); setTravel(filters.travelMode || 'any');
    const constraints = { ...filters, date: nextDate };
    setPersistedFilters(constraints);
    setDetails({ ...defaultPlanDetails(), partySize: filters.partySize || 1, travelMode: ['drive', 'transit', 'walk'].includes(filters.travelMode || '') ? filters.travelMode as PlanDetails['travelMode'] : 'any', constraints });
    setSelected(`${nextStops[0].kind}:${nextStops[0].id}`);
    setStatus(locale === 'en' ? 'Your starting point is set. Review the visit time, then add another stop or choose a complete outing.' : '已设为行程起点。请安排到访时间，再加一站或选择完整方案。');
    document.getElementById('outing-plan')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
  const applyPlanEdit = (next: { title: string; date: string; stops: Stop[]; details: PlanDetails }) => {
    remember(); request.current?.abort(); request.current = undefined; setRequesting(false); setResults(null); setReplaceIndex(null);
    setStops(next.stops); setDate(next.date); setTitle(next.title); setDetails(next.details);
    setSearchDate(undefined);
    const constraints = { ...(next.details.constraints || persistedFilters), date: next.date };
    setPersistedFilters(constraints); setTravel(next.details.travelMode);
    setStatus(locale === 'en' ? 'Changes applied to this draft. Save when you are ready.' : '修改已应用到草稿，可撤销。确认后请保存计划。');
    recordProductEvent('planner_edit_applied');
  };
  const changePlanDetails = (value: PlanDetails) => {
    setUndo(undefined);
    if (value.partySize !== details.partySize || value.travelMode !== details.travelMode) {
      request.current?.abort(); request.current = undefined; setRequesting(false); setResults(null);
      const constraints = { ...(details.constraints || effectiveFilters), partySize: value.partySize, travelMode: value.travelMode };
      setDetails({ ...value, constraints }); setPersistedFilters(constraints); setTravel(value.travelMode);
    } else setDetails(value);
  };
  const add = (stop: Stop) => { setStatus(''); if (stops.some(s => favoriteKey(s) === favoriteKey(stop))) return; if (replaceIndex != null) { const event = stop.kind === 'event' && PLANNER_EVENTS.find(item => item.id === canonicalEventId(stop.id)); if (event && date && !eventOccursOn(event, date)) { setStatus('这场活动不在计划日期内，请选择同一天的活动。'); return; } remember(); const removed = stops[replaceIndex]; setStops(stops.map((item, index) => index === replaceIndex ? stop : item)); setDetails(current => ({ ...current, stopSettings: current.stopSettings.filter(item => favoriteKey(item) !== favoriteKey(removed)) })); setReplaceIndex(null); setStatus('已替换这一站，其余地点与日期保留。'); } else { if (stops.length >= MAX_PLAN_STOPS) { setStatus('一份计划最多六站，先移除一站再添加。'); return; } remember(); setStops([...stops, stop]); } setSelected(favoriteKey(stop)); };
  const recommend = useCallback(async (replace = false, handoff?: { message: string; filters: PlanFilters }) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setRequesting(true); setError('');
    try {
      const excluded = replace ? [...new Set([...excludedEvents.current, ...(results?.suggestions.map(s => s.eventId) || [])])].slice(-200) : [];
      const excludedPlaceIds = replace ? [...new Set([...excludedPlaces.current, ...(results?.placeSuggestions?.map(s => s.placeId) || [])])].slice(-100) : [];
      const result: Recommendations = await api.request('/planner/recommend', { method: 'POST', signal: controller.signal, body: JSON.stringify({ message: handoff?.message ?? message, locale, filters: handoff?.filters ?? { ...persistedFilters, date: requestedDate || undefined, ...(region !== 'all' ? { region } : {}), ...(budget !== '' ? { budget: Number(budget), budgetScope: 'person' } : {}), ...(age !== '' ? { childAge: Number(age) } : {}), ...(setting !== 'any' ? { setting } : {}), ...(travel !== 'any' ? { travelMode: travel } : {}) }, excludeEventIds: excluded, excludePlaceIds: excludedPlaceIds }) });
      if (request.current === controller && !controller.signal.aborted) { excludedEvents.current = excluded; excludedPlaces.current = excludedPlaceIds; setResults(result); recordProductEvent('planner_recommendation'); }
    } catch (e) { if (request.current === controller && !controller.signal.aborted) setError(errorText(e)); }
    finally { if (request.current === controller) setRequesting(false); }
  }, [message, locale, requestedDate, region, budget, age, setting, travel, results, persistedFilters]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const key = `${location.key}:${queryMessage}`;
    if (params.has('baybayBrief') || params.get('auto') !== '1' || queryMessage.length < 2 || autoStarted.current.has(key)) return;
    let cancelled = false;
    // Defer past StrictMode's setup/cleanup replay so it cannot start a second paid request.
    void Promise.resolve().then(() => {
      if (cancelled || autoStarted.current.has(key)) return;
      autoStarted.current.add(key);
      params.delete('auto');
      navigate({ pathname: location.pathname, search: params.toString(), hash: location.hash }, { replace: true });
      void recommend(false, { message: queryMessage, filters: shared.date ? { date: shared.date } : {} });
    });
    return () => { cancelled = true; };
  }, [location.search, location.key, location.pathname, location.hash, queryMessage, shared.date, recommend, navigate]);
  const stopRequest = () => { request.current?.abort(); request.current = undefined; setRequesting(false); setError('已停止挑选。你的条件还在，可以修改后重试。'); };
  const appliedFilters = results ? [results.filters.date, results.filters.city, results.filters.region && results.filters.region !== 'all' ? ATTRACTION_REGIONS.find(item => item.id === results.filters.region)?.label : undefined,
    results.filters.budget != null ? `${translateText(results.filters.budgetScope === 'total' ? '同行门票总预算' : '每人门票预算', locale)} $${results.filters.budget}` : undefined,
    results.filters.childAges?.length ? `${translateText('孩子年龄', locale)} ${results.filters.childAges.join('、')}` : results.filters.childAge != null ? `${translateText('孩子年龄', locale)} ${results.filters.childAge}` : undefined,
    results.filters.setting === 'indoor' ? '室内' : results.filters.setting === 'outdoor' ? '户外' : undefined,
    results.filters.travelMode === 'walk' ? '步行' : results.filters.travelMode === 'transit' ? '公共交通' : results.filters.travelMode === 'drive' ? '开车' : undefined,
    results.filters.partySize ? `${results.filters.partySize} ${locale === 'en' ? 'people' : '人同行'}` : undefined,
    results.filters.freeOnly ? (locale === 'en' ? 'Confirmed free admission' : '仅已确认免费') : undefined,
  ].filter(Boolean) : [];
  const save = async () => {
    if (!library.ready || library.busy) return;
    setStatus('');
    if (!stops.length) { setStatus('先选择至少一站。'); return; }
    if (!date) { setStatus('请先选择出游日期。'); return; }
    if (date < todayInBay()) { setStatus('请选择今天或未来日期。'); return; }
    const badDate = stops.some(stop => { const event = stop.kind === 'event' && PLANNER_EVENTS.find(e => e.id === canonicalEventId(stop.id)); return event && !eventOccursOn(event, date); });
    if (badDate) { setStatus('计划日期与所选活动不一致，请调整日期或移除活动。'); return; }
    const detailsError = planDetailsError(details); if (detailsError) { setStatus(detailsError); return; }
    const saved = await library.savePlan({ title: title.trim() || translateText('我的湾区出游', locale), date, stops, details: { ...normalizePlanDetails(details, stops), ...(details.constraints ? { constraints: { ...details.constraints, date } } : {}) } }, editing);
    if (saved) { setUndo(undefined); setEditing(saved); setStatus(app?.user ? '已保存到账号。' : '已保存到这个浏览器。'); }
  };
  const share = async () => {
    try { await navigator.clipboard.writeText(sharePlanUrl({ date, stops }, window.location.origin)); recordProductEvent('plan_shared'); setStatus('公开地点与日期链接已复制；不包含账号或私人标题。'); } catch { setStatus('复制失败，请使用下方分享链接。'); }
  };
  // One save key: an open new shop listed here as a place is the same ♡ as the shop on the openings board.
  const favorite = (kind: 'event' | 'place', id: string) => library.data.favorites.some(item => saveKey(item.kind, item.id) === saveKey(kind, id));
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const placeKind = (category?: string) => category === 'restaurant' ? t('餐饮', 'Dining') : category === 'cafe' ? t('咖啡与小食', 'Coffee') : category === 'shop' ? t('商店', 'Shop') : t('常设景点', 'Attraction');
  const catalogTotal = visiblePlaces.length + (catalogCategory === 'all' ? events.length : 0);
  const catalogItems = useMemo<PlannerCatalogItem[]>(() => [
    ...events.filter(() => catalogCategory === 'all').map(event => ({ kind: 'event' as const, id: event.id, title: event.title, city: event.city, summary: event.summary, kicker: translateText(event.dateLabel, locale), detail: translateText(event.costLabel, locale), point: event.location, official: event.officialUrl })),
    ...visiblePlaces.map(place => ({ kind: 'place' as const, id: place.id, title: place.title, city: place.city, summary: place.summary, kicker: placeKind(place.category), detail: place.planning?.schedule ? t('已收录官方时段', 'Official hours recorded') : t('营业时间待确认', 'Opening hours unconfirmed'), point: place.location, official: place.officialUrl })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- placeKind and t only read locale
  ].slice(0, catalogLimit), [events, visiblePlaces, catalogCategory, catalogLimit, locale]);
  const catalogCovers = useMemo(() => resolveCovers(catalogItems.map(stopCoverItem), { images: stopCoverImage, today, page: coverPage }), [catalogItems, today, coverPage]);
  // The draft's save state, shown on screen 1 (FC3-01): a stop that arrived by link or from the list is not saved yet.
  const draftState = !stops.length ? 'none' as const : !editing ? 'unsaved' as const
    : editing.date === date && editing.title === title && JSON.stringify(cleanStops(editing.stops)) === JSON.stringify(stops) ? 'saved' as const : 'changed' as const;
  // 问 BayBay opens the site's one BayBay panel (the same panel as every page) with a draft the reader can edit first.
  const askBayBay = () => app?.openBayBay?.(stops.length
    ? t(`帮我看看${date ? ` ${date} ` : ''}这份行程：${stops.map(stop => stopTitle(stop)).join('、')}。还可以怎么排？`, `Please look at my plan${date ? ` for ${date}` : ''}: ${stops.map(stop => translateText(stopTitle(stop), 'en')).join(', ')}. How could I arrange it better?`)
    : t('帮我排一天湾区出游：', 'Help me plan a day out in the Bay Area: '), { mode: 'draft' });
  return <PageContainer size="wide" className="planner-page"><fieldset className="planner-interaction-scope" disabled={library.busy}>
    <PageHeader title={t('行程', 'Plans')}
      lede={t('把想去的活动和地点排进一天：时间、门票和路线一起看，存好后发给家人。', 'Put the events and places you want into one day, with times, tickets and routes in view. Save it and send it to family.')}
      actions={<><Button variant="primary" icon={<Sparkles size={18} aria-hidden="true" />} onClick={askBayBay}>{t('问 BayBay 排一天', 'Ask BayBay to plan a day')}</Button><Button variant="text" to="/my-week">{t('我的这周', 'My Week')}</Button></>} />
    {!online && <p className="planner-offline" role="status"><WifiOff size={18} aria-hidden="true" />{t('你现在离线：已保存的行程和本机草稿仍可查看；挑选方案和地图要联网后才能用。', 'You are offline. Saved plans and this device’s draft are still here; suggestions and the map need a connection.')}</p>}
    <PlannerPlanOverview stops={stops} date={date} details={details} admissionOverride={admissionOverride} state={draftState} saving={library.busy} canSave={library.ready && !library.busy} onSave={() => void save()} status={status} />
    <PlannerDayPlans library={library} today={today} coverPage={coverPage} editingId={editing?.id} />
    <form className="planner-form" aria-labelledby="planner-form-title" onChange={() => { request.current?.abort(); setRequesting(false); setResults(null); }} onSubmit={e => { e.preventDefault(); void recommend(); }}>
      <h2 id="planner-form-title">{t('按条件挑选', 'Find options by your conditions')}</h2>
      {Object.keys(persistedFilters).length > 0 && <p className="planner-note">{locale === 'en' ? 'Saved conditions are included: ' : '沿用这份计划的条件：'}{[persistedFilters.city, persistedFilters.partySize ? String(persistedFilters.partySize) + (locale === 'en' ? ' people' : '人') : '', persistedFilters.childAges?.length ? (locale === 'en' ? 'Child ages ' : '孩子年龄 ') + persistedFilters.childAges.join('、') : '', persistedFilters.budget != null ? (persistedFilters.budgetScope === 'total' ? (locale === 'en' ? 'Group admission budget ' : '门票总预算 ') : (locale === 'en' ? 'Per-person admission budget ' : '每人门票预算 ')) + '$' + persistedFilters.budget : '', persistedFilters.freeOnly ? (locale === 'en' ? 'Free only' : '仅免费') : ''].filter(Boolean).join(' · ')} <button type="button" onClick={() => { request.current?.abort(); request.current = undefined; setRequesting(false); setPersistedFilters({}); setSearchDate(''); setRegion('all'); setBudget(''); setAge(''); setSetting('any'); setTravel('any'); setResults(null); }}>{locale === 'en' ? 'Clear saved conditions' : '清除沿用条件'}</button></p>}{queryMessage && <p className="planner-handoff-note"><Sparkles size={15} />已经带上你说的条件。修改后，点“帮我挑选方案”重新选择。</p>}
      {requirementsDraftId !== null && !requirementsDraft && <p className="planner-handoff-note" role="status" translate="no">{locale === 'en' ? 'Your requirement draft is unavailable. Please enter your requirements again.' : translateText('需求草稿暂不可读取，请重新输入条件。', locale)}</p>}
      <label className="planner-question">这次想怎么过？<textarea maxLength={800} value={message} onChange={e => { setMessage(e.target.value); setPersistedFilters({}); }} placeholder={translateText('例如：周六在东湾带孩子玩，门票每人不超过 30 美元', locale)} /></label>
      <ChipRow label={t('试着这样问', 'Try asking')} className="planner-examples">{['明天在旧金山找家餐厅，再去附近逛逛', '这个周末东湾有哪些新店？', '后天东湾，带5岁和12岁的孩子，不开车'].map(example => <FilterChip selected={false} key={example} onClick={() => { request.current?.abort(); setRequesting(false); setResults(null); setMessage(example); setSearchDate(''); setRegion('all'); setBudget(''); setAge(''); setSetting('any'); setTravel('any'); setPersistedFilters({}); }}>{example}</FilterChip>)}</ChipRow>
      <details className="planner-refinements"><summary><SlidersHorizontal size={16} aria-hidden="true" />日期、地区与预算（可选）<ChevronRight size={16} aria-hidden="true" /></summary><div className="planner-filters"><label>出游日期<input type="date" min={todayInBay()} value={requestedDate} onChange={e => { setSearchDate(e.target.value); }} /></label><label>地区<select value={region} onChange={e => { setRegion(e.target.value); setPersistedFilters(current => ({ ...current, region: e.target.value, city: undefined })); }}>{ATTRACTION_REGIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></label><label>每人门票预算 $<input type="number" min="0" max="10000" step="0.01" value={budget} onChange={e => { setBudget(e.target.value); setPersistedFilters(current => ({ ...current, budget: undefined, budgetScope: 'person', freeOnly: undefined })); }} placeholder={translateText('不限', locale)} /></label><label>同行孩子年龄<input type="number" min="0" max="17" value={age} onChange={e => { setAge(e.target.value); setPersistedFilters(current => ({ ...current, childAge: undefined, childAges: undefined })); }} placeholder={translateText('不填写', locale)} /></label><label>场地<select value={setting} onChange={e => { setSetting(e.target.value); setPersistedFilters(current => ({ ...current, setting: e.target.value })); }}><option value="any">室内外皆可</option><option value="indoor">只看已确认室内</option><option value="outdoor">只看已确认户外</option><option value="mixed">已确认室内外结合</option></select></label><label>出行方式<select value={travel} onChange={e => { setTravel(e.target.value); setPersistedFilters(current => ({ ...current, travelMode: e.target.value })); }}><option value="any">暂未决定</option><option value="drive">开车</option><option value="transit">公共交通</option><option value="walk">步行</option></select></label></div></details>
      <div className="planner-form-actions"><Button type="submit" variant="secondary" disabled={requesting} icon={<Sparkles size={18} aria-hidden="true" />}>{requesting ? '正在挑选…' : '帮我挑选方案'}</Button>{requesting && <Button variant="text" onClick={stopRequest} icon={<Square size={14} aria-hidden="true" />}>停止</Button>}<span>门票预算不含餐饮、停车与交通。</span></div>
    </form>
    {error && <p className="planner-error" role="alert">{error}</p>}
    {results && <section className="planner-results"><div className="planner-section-head"><div><h2 ref={resultsHeading}>有依据的出游建议</h2><p>{results.responseMode === 'ai' ? 'AI 根据已收录活动与地点整理，可查看每条建议的资料来源。' : '根据已收录活动、地点与筛选条件匹配。'}</p></div><Button variant="text" disabled={requesting} onClick={() => void recommend(true)}>换一批</Button></div>
      {appliedFilters.length > 0 && <div className="planner-applied-filters" aria-label={translateText('已使用的条件', locale)}><span>已使用的条件</span>{appliedFilters.map((filter, index) => <strong key={index}>{filter}</strong>)}</div>}
      {results.notices.length > 0 && <details className="planner-result-notes"><summary>{translateText('筛选说明与出行提示', locale)} ({results.notices.length})</summary>{results.notices.map((notice, index) => <p className="planner-note" key={index}>{notice}</p>)}</details>}
      {!results.suggestions.length && !results.placeSuggestions?.length && <p className="planner-note">没有完全符合条件的活动或地点。可以调整条件，或点击下方站外搜索，查看更多来源。</p>}
      <div className="planner-options">{results.suggestions.map((suggestion, index) => { const event = PLANNER_EVENTS.find(e => e.id === canonicalEventId(suggestion.eventId)); if (!event) return null; return <article className="planner-option" key={suggestion.id}><PlannerOptionCover stop={{ kind: 'event', id: event.id }} today={today} page={coverPage} /><span className="planner-number">{index + 1}</span>{suggestion.budgetStatus === 'unknown' && <span className="planner-unverified-price">{locale === 'en' ? 'Price unverified · alternative' : '费用待核实 · 备选'}</span>}<h3><Link to={`/events/${event.id}`}>{event.title}</Link></h3><p className="planner-meta">{event.dateLabel} · {event.city}</p><p>{suggestion.reasons?.length ? suggestion.reasons.join(' ') : suggestion.reason}</p><strong className="planner-cost">{event.costLabel}</strong><ul>{suggestion.unknowns.map((unknown, i) => <li key={i}>{unknown}</li>)}</ul><a onClick={() => recordProductEvent('official_source_click')} href={event.officialUrl} target="_blank" rel="noreferrer">查看主办方最新信息 ↗</a><small>资料核查：{event.verifiedAt}</small><PlannerOutingOptions suggestion={suggestion} filters={results.filters} message={message} onChoose={applyOuting} /><button className="planner-primary" onClick={() => beginPlan([{ kind: 'event', id: event.id }, ...suggestion.placeIds.map(id => ({ kind: 'place' as const, id }))], suggestion.date, event.title, results.filters)}>用这个方案开始</button></article>; })}</div>
      <PlannerPlaceRecommendations suggestions={results.placeSuggestions || []} filters={results.filters} message={message} onChoose={applyOuting} onStart={beginPlan} today={today} coverPage={coverPage} />
    </section>}
    <PlannerWebSearch ownerId={app?.user?.id} sessionKey={app?.user?.token} onLogin={() => app?.setShowLogin(true)} query={message} date={effectiveFilters.date || requestedDate} region={effectiveFilters.region || region} city={effectiveFilters.city} locale={locale} />
    <EventScreenshotImport userId={app?.user?.id} />
    <div className="planner-workspace"><section id="planner-discoveries" aria-labelledby="planner-discoveries-title">
      <div className="planner-section-head"><h2 id="planner-discoveries-title">{t('挑地点和活动', 'Choose places and events')}</h2><span><MapPin size={16} aria-hidden="true" /> {points.length}</span></div>
      <details className="planner-map-disclosure"><summary><MapPin size={18} aria-hidden="true" />{locale === 'en' ? 'Open the map to compare locations' : '展开地图，对比地点位置'}</summary><PlannerMap points={points} selected={selected} onSelect={choose} /></details>
      {nearby.length > 0 && <section className="planner-nearby"><h3>附近再加一站</h3><p>仅比较同城准确地点。直线距离不代表步行路线或路程时间；请确认交通、开放时间与入场条件。</p>{nearby.map(({ place, km }) => <button key={place.id} onClick={() => add({ kind: 'place', id: place.id })}>{place.title}<span>{km.toFixed(1)} km <Plus size={16} aria-hidden="true" /></span></button>)}</section>}
      <p className="planner-small-note">{locale === 'en' ? 'Places follow your area, city, setting and known admission conditions. Unknown prices are not treated as free. Check each stop’s opening source; area pins are excluded from nearby distances.' : '地点列表沿用地区、城市、场地与已知门票条件；未知消费金额不按免费处理。营业时间按每站来源核对，区域参考点不用于附近距离。'}</p>
      <ChipRow label={locale === 'en' ? 'Place categories' : '地点类型'} className="planner-catalog-tabs">{[['all', '全部地点', 'All places'], ['attraction', '景点', 'Attractions'], ['restaurant', '餐饮', 'Dining'], ['cafe', '咖啡与小食', 'Coffee'], ['shop', '商店', 'Shops']].map(([value, zh, en]) => <FilterChip key={value} selected={catalogCategory === value} onClick={() => setCatalogCategory(value)}>{locale === 'en' ? en : zh}</FilterChip>)}</ChipRow>
      {catalogCategory !== 'all' && !visiblePlaces.length && <p className="planner-note">{locale === 'en' ? 'No places of this type match the current conditions.' : '当前条件下还没有这类地点，可调整地区、场地或门票条件。'}</p>}
      <div className="planner-catalog">{catalogItems.map((item, index) => { const key = `${item.kind}:${item.id}`; return <PlannerCatalogCard key={key} item={item} cover={catalogCovers[index]} today={today} date={date} pin={points.findIndex(point => point.key === key)} selected={selected === key}
        favorite={favorite(item.kind, item.id)} favoriteReady={library.ready} busy={library.busy} replacing={replaceIndex != null}
        onToggleFavorite={() => void library.toggleFavorite({ kind: item.kind, id: item.id })} onAdd={() => add({ kind: item.kind, id: item.id })}
        onStart={item.kind === 'place' ? () => beginPlan([{ kind: 'place', id: item.id }], requestedDate || todayInBay(), item.title, effectiveFilters) : undefined}>
        {item.kind === 'place' && selected === key && <PlannerPlaceOutingOptions placeId={item.id} date={requestedDate || todayInBay()} filters={effectiveFilters} onChoose={applyOuting} />}
      </PlannerCatalogCard>; })}</div>
      {catalogLimit < catalogTotal && <Button variant="secondary" block className="planner-catalog-more" onClick={() => setCatalogLimit(value => value + 12)}>{locale === 'en' ? 'Show more places' : '继续看更多地点'}<ChevronRight size={16} aria-hidden="true" /></Button>}
    </section><aside id="outing-plan" className={`planner-editor${stops.length ? ' has-stops' : ' is-empty'}`} aria-labelledby="outing-plan-title"><h2 id="outing-plan-title">排好这一天</h2><p>{translateText(stops.length ? '最多六站，时间和预算一起安排。' : '先选地点，再安排时间与预算。', locale)}</p>{undo && <Button variant="text" className="planner-undo" onClick={restoreUndo}>撤销上次调整</Button>}
      <BayBayImportedRequirements draft={importedDraft} requested={new URLSearchParams(planSearch).has('baybayDraft')} />
      {!stops.length && <div className="planner-empty"><p>{t('从活动或地点列表选好第一站，再填写时间、人数和预算。', 'Choose a place or event to start your day.')}</p><Button variant="tonal" href="#planner-discoveries" icon={<MapPin size={18} aria-hidden="true" />}>{t('先挑一个地点', 'Browse places and events')}</Button></div>}
      {stops.length > 0 && <>{replaceIndex != null && <p className="planner-note" role="status">正在替换第 {replaceIndex + 1} 站，请从地点列表选择。<button onClick={() => setReplaceIndex(null)}>取消替换</button></p>}<label>计划名称<input maxLength={80} value={title} onChange={e => { setUndo(undefined); setTitle(e.target.value); }} /></label><label>日期<input type="date" value={date} onChange={e => { setUndo(undefined); setSearchDate(undefined); setDate(e.target.value); }} /></label>
      <ol className="planner-stops" aria-label={translateText('所选地点', locale)}>{stops.map((stop, index) => <li key={`${stop.kind}:${stop.id}`}><span>{index + 1}</span><Link to={stopPath(stop)}>{stopTitle(stop)}</Link><div>{index > 0 && <IconButton label={translateText('上移一站', locale)} onClick={() => { remember(); setReplaceIndex(null); setStops(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; }); }}><ArrowUp size={18} aria-hidden="true" /></IconButton>}<Button variant="text" aria-label={translateText('替换此站', locale)} onClick={() => { setReplaceIndex(index); setStatus('从地点列表选择要换入的地点。'); }}>换</Button><IconButton label={translateText('移除此站', locale)} onClick={() => { remember(); setReplaceIndex(null); setStops(stops.filter((_, i) => i !== index)); setDetails(current => ({ ...current, stopSettings: current.stopSettings.filter(item => favoriteKey(item) !== favoriteKey(stop)) })); }}><X size={18} aria-hidden="true" /></IconButton></div></li>)}</ol>
      <PlannerPlanEdit key={`${app?.user?.id || 'guest'}:${editing?.id || 'draft'}:${planSearch}`} current={{ title, date, stops, details }} onApply={applyPlanEdit} />
      <PlannerSchedule ownerId={app?.user?.id} sessionKey={app?.user?.token} onLogin={() => app?.setShowLogin(true)} stops={stops} date={date} title={title} details={details} admissionOverride={admissionOverride} onChange={changePlanDetails} onStatus={setStatus} />
      <Button variant="primary" block disabled={!library.ready || library.busy || !stops.length} onClick={() => void save()}>{library.busy ? '保存中…' : editing ? '更新这份计划' : '保存这份计划'}</Button>
      <Button variant="secondary" block className="planner-compose-outing" disabled={!stops.length || !date} icon={<Plus size={18} aria-hidden="true" />} onClick={() => { if (!app?.user?.id) { app?.setShowLogin(true); return; } const state = createOutingPlanHandoff({ ownerId: app.user.id, title, date, stops, details }); if (state) navigate('/together?draft=plan', { state }); else setStatus(locale === 'en' ? 'Check your date and selected places before creating an outing.' : '请先核对日期与所选地点，再发起小队。'); }}>{locale === 'en' ? 'Find company for this plan' : '带着这份计划，发起小队'}</Button></>}
      <PlannerAccountNotice library={library} signedIn={!!app?.user} login={() => app?.setShowLogin(true)} />
      {stops.length > 0 && <div className="planner-share-actions"><Button variant="secondary" icon={<Share2 size={18} aria-hidden="true" />} onClick={() => void share()}>分享地点与日期</Button><Button variant="text" icon={<Printer size={18} aria-hidden="true" />} onClick={() => window.print()}>{t('打印这一天', 'Print this day')}</Button><a className="planner-public-link" onClick={() => recordProductEvent('plan_shared')} href={sharePlanUrl({ date, stops })}>打开公开分享链接 ↗</a></div>}
      {status && <p className="planner-note" role="status">{status}</p>}
      <p className="planner-note">景点顺序由你决定。出发前确认门票、开放时间及导航路线。</p>
    </aside></div>
    <PlannerImageCredits today={today} page={coverPage} stops={[
      ...library.data.plans.filter(plan => plan.date >= today).flatMap(plan => plan.stops),
      ...(results?.suggestions.map(suggestion => ({ kind: 'event' as const, id: canonicalEventId(suggestion.eventId) })) || []),
      ...(results?.placeSuggestions?.map(suggestion => ({ kind: 'place' as const, id: suggestion.placeId })) || []),
      ...catalogItems,
    ]} />
  </fieldset></PageContainer>;
}
