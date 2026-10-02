import { Suspense, useMemo, useSyncExternalStore, type CSSProperties } from 'react';
import { ArrowLeft, CalendarDays, CalendarPlus, Heart, History, RefreshCw, Sparkles } from 'lucide-react';
import { game, useGame } from '../core/store';
import type { Bilingual, WeekOption } from '../core/types';
import { CITY_REGION_OPTIONS, REGION_LABELS, SENIORS_OPTION, categoryLabel, eventSpot, goToEvent, isSfArea, loadCatalog, regionLabel, todayInBay, useCatalog, type RankedEvent } from '../data/catalog';
import './event-go.css';
import '../realsf/realsf.css';
import { calendarUrl, planUrl, thisMonthUrl } from '../data/links';
import { NODES, WEEK_QUESTIONS } from '../data/script';
import { closePanel, openEvent, setWeekPref, showWeekResults, startWeek, weekBack } from '../game/flow';
import { useFlow } from '../game/flowStore';
import { useT } from '../i18n';
import { BaybayFace, LinkButton, Sheet } from './common';
import { useWindowKey } from './hooks';
import { lazyChunk } from '../game/lazyChunk';
import { importRetry } from '../game/importRetry';
import { getPrefs, subscribePrefs } from '../realsf/prefs';

/** W9-R3 (review R§5 #10): the next 7 days' free offers and events (city mode; its own chunk) */
const FreeWeekStrip = lazyChunk(() => importRetry(() => import('../realsf/FreeWeekStrip')));

/**
 * W9-R4 (review R§5 #12): the answers. City mode asks 带长辈 too and, for the third question, a part of San Francisco
 * (the game is the city: 东湾 / 北湾 had no 带我去) or the rest of the Bay; the district keeps the original lists.
 */
function weekOptions(key: 'companions' | 'vibe' | 'region', city: boolean): WeekOption[] {
  const base = WEEK_QUESTIONS[key] ?? [];
  if (!city) return base;
  if (key === 'companions') return [...base, { value: SENIORS_OPTION.value, label: SENIORS_OPTION.label }];
  if (key === 'region') return CITY_REGION_OPTIONS;
  return base;
}
import { catalogUpdatedLabel, joinPlace, shortDay, windowLabel } from './format';

const QUESTIONS: { key: 'companions' | 'vibe' | 'region'; q: Bilingual }[] = [
  { key: 'companions', q: { zh: '这次和谁一起？', en: 'Who’s coming along?' } },
  { key: 'vibe', q: { zh: '想要什么感觉？', en: 'What’s the vibe?' } },
  { key: 'region', q: { zh: '想在哪一带玩？', en: 'Which part of the Bay?' } },
];

/** "这周去哪": three quick questions, then real flyers from the live catalog. */
export function WeekPanel() {
  const { t } = useT();
  const step = useGame(s => s.week.step);
  const result = useFlow(s => s.weekResult);
  const stage = useFlow(s => s.weekStage);
  const status = useGame(s => s.catalogStatus);
  const showBoard = !!result && (stage === 'board' || stage === 'walking' || step >= 3);

  return (
    <Sheet
      eyebrow={<><Sparkles size={14} aria-hidden />{t('这周去哪', 'This week')}</>}
      title={showBoard ? t('这周的活动传单', 'This week’s flyers') : t('帮你挑这周去哪', 'Let’s pick your week')}
      onClose={closePanel}
      className="ob-week"
      wide={showBoard}
      snap={showBoard ? 70 : 70}
    >
      {status === 'error' && !result && step >= 3 ? <CatalogError /> : showBoard ? <Board /> : step >= 3 ? <Thinking /> : <Questions />}
    </Sheet>
  );
}

function CatalogError() {
  const { t, locale } = useT();
  return (
    <div className="ob-empty">
      <BaybayFace mood="thinking" size={64} />
      <p>{t('暂时读不到 BAYLINK 的活动数据。可能是网络问题，等一下再试试。', 'Can’t load BAYLINK’s events right now — probably the network. Try again in a moment.')}</p>
      <div className="ob-actions">
        <button type="button" className="ob-btn ob-btn-primary" onClick={() => { void loadCatalog().then(catalog => { if (catalog) void showWeekResults(); }); }}><RefreshCw size={17} aria-hidden /><span>{t('重试', 'Retry')}</span></button>
        <LinkButton href={thisMonthUrl(locale)} tone="soft">{t('去 BAYLINK 看本月活动', 'See this month on BAYLINK')}</LinkButton>
      </div>
    </div>
  );
}

function Thinking() {
  const { t } = useT();
  return (
    <div className="ob-empty is-thinking" role="status">
      <BaybayFace mood="thinking" size={64} />
      <p>{t('BAYBAY 正在翻这周的活动…', 'BAYBAY is flipping through this week’s events…')}</p>
      <span className="ob-dots" aria-hidden><i /><i /><i /></span>
    </div>
  );
}

function Questions() {
  const { t, locale } = useT();
  const catalog = useCatalog();
  const week = useGame(s => s.week);
  const step = Math.min(week.step, 2);
  const question = QUESTIONS[step];
  const city = useGame(s => s.worldMode === 'city');
  const options = useMemo<WeekOption[]>(() => weekOptions(question.key, city), [question.key, city]);
  // (W9-R4) last time's three answers (realsf/prefs.ts): one tap to use them again
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs, getPrefs);
  const last = city && step === 0 && prefs.companions && prefs.vibe && prefs.region
    ? (['companions', 'vibe', 'region'] as const).map(key => labelFor(key, prefs[key], city)) : null;
  const applyLast = () => { if (!prefs.companions || !prefs.vibe || !prefs.region) return; setWeekPref('companions', prefs.companions); setWeekPref('vibe', prefs.vibe); setWeekPref('region', prefs.region); };
  const chosen = week[question.key];
  const asked = NODES[`week.${question.key}`]?.text ?? question.q;
  const intro = step === 0 ? NODES['week.intro']?.text : undefined;

  useWindowKey(e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || game.get().dialogue.nodeId) return;
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (m) { const option = options[Number(m[1]) - 1]; if (option) { e.preventDefault(); setWeekPref(question.key, option.value); } }
    if (e.code === 'Backspace' && step > 0) { e.preventDefault(); weekBack(); }
  });

  return (
    <div className="ob-qa">
      <div className="ob-qa-head">
        <BaybayFace mood={step === 2 ? 'excited' : 'happy'} size={56} />
        <div className="ob-qa-bubble">
          <span className="ob-qa-step">{step + 1} / 3</span>
          {intro && <small className="ob-qa-intro">{t(intro)}</small>}
          <p key={question.key}>{t(asked)}</p>
        </div>
      </div>
      <div className="ob-qa-dots" aria-hidden>{QUESTIONS.map((q, i) => <i key={q.key} className={i < step ? 'done' : i === step ? 'now' : ''} />)}</div>
      <div className="ob-chips" role="group" aria-label={t(asked)} key={question.key}>
        {options.map((option, i) => (
          <button key={option.value} type="button" className={`ob-chip-btn ${chosen === option.value ? 'is-on' : ''}`} onClick={() => setWeekPref(question.key, option.value)} style={{ animationDelay: `${i * 40}ms` }}>
            <span className="ob-chip-key" aria-hidden>{i + 1}</span>{t(option.label)}
          </button>
        ))}
      </div>
      {last && last.every(Boolean) && (
        <button type="button" className="ob-btn ob-btn-soft ob-btn-sm ob-week-last" onClick={applyLast}>
          <History size={15} aria-hidden /><span>{t('用上次的：', 'Same as last time: ')}{last.map(l => t(l!)).join(' · ')}</span>
        </button>
      )}
      {city && step === 0 && <Suspense fallback={null}><FreeWeekStrip limit={2} /></Suspense>}
      <div className="ob-qa-foot">
        {step > 0 ? <button type="button" className="ob-btn ob-btn-ghost ob-btn-sm" onClick={weekBack}><ArrowLeft size={16} aria-hidden /><span>{t('上一步', 'Back')}</span></button> : <span />}
        <p className="ob-muted">{catalogUpdatedLabel(catalog?.checkedAt, locale)}</p>
      </div>
    </div>
  );
}

function labelFor(key: 'companions' | 'vibe' | 'region', value: string | null, city = false): Bilingual | null {
  if (!value) return null;
  return weekOptions(key, city).find(option => option.value === value)?.label ?? WEEK_QUESTIONS[key]?.find(option => option.value === value)?.label ?? (key === 'region' ? regionLabel(value) : null);
}

function Board() {
  const { t, locale } = useT();
  const catalog = useCatalog();
  const result = useFlow(s => s.weekResult)!;
  const week = useGame(s => s.week);
  const wishlist = useGame(s => s.wishlist);
  const saved = wishlist.filter(item => item.kind === 'event').map(item => ({ kind: 'event' as const, id: item.id }));
  const city = useGame(s => s.worldMode === 'city');
  const prefs = (['companions', 'vibe', 'region'] as const).map(key => labelFor(key, week[key], city)).filter((label): label is Bilingual => !!label);
  // the BAYLINK calendar's region filter: a part of San Francisco is San Francisco; the rest of the Bay is no filter
  const calRegion = week.region && week.region !== 'any' && week.region !== 'bay' ? (isSfArea(week.region) ? 'sf' : week.region) : undefined;

  return (
    <div className="ob-board-wrap">
      <div className="ob-prefs">
        {prefs.map((label, i) => <span key={i} className="ob-chip">{t(label)}</span>)}
        <button type="button" className="ob-btn ob-btn-ghost ob-btn-sm" onClick={startWeek}><RefreshCw size={15} aria-hidden /><span>{t('换个条件', 'Change answers')}</span></button>
      </div>
      {result.note && result.events.length > 0 && (
        <p className="ob-honest" role="note">
          <BaybayFace mood="thinking" size={32} />
          <span>{result.strictCount === 0
            ? t('老实说，完全符合的这几天没有。', 'Honestly, nothing matched everything. ')
            : t(`完全符合的只有 ${result.strictCount} 个。`, `Only ${result.strictCount} matched exactly. `)}{t(result.note)}</span>
        </p>
      )}
      {result.events.length === 0 ? (
        <div className="ob-empty">
          <BaybayFace mood="thinking" size={64} />
          <p>{t('这几天 BAYLINK 还没收录合适的活动。去日历看看更远的日子？', 'BAYLINK has nothing listed for these days yet. Check the calendar for later dates?')}</p>
          <LinkButton href={calendarUrl(locale)} tone="primary" icon={<CalendarDays size={17} aria-hidden />}>{t('打开 BAYLINK 日历', 'Open the BAYLINK calendar')}</LinkButton>
        </div>
      ) : (
        <ul className="ob-board">
          {result.events.map((item, i) => <Flyer key={item.event.id} item={item} index={i} saved={wishlist.some(w => w.kind === 'event' && w.id === item.event.id)} />)}
        </ul>
      )}
      {/* W9-R3: 免费就好 merges BAYLINK's free offers (the zoo's resident day, museum free days) with the free events;
          other answers get the 7-day strip's first two rows. (W9-R-review R-RP-4) below the answer, never above it: the
          strip is the whole city's and ignores the third question; on a phone it filled the sheet before any flyer */}
      {city && <Suspense fallback={null}>{week.vibe === 'free'
        ? <FreeWeekStrip limit={6} companions={week.companions} title={{ zh: '免费就好 · 全城这几天的免费福利和活动', en: 'Free across the city: offers and events this week' }} />
        : <FreeWeekStrip limit={2} companions={week.companions} />}</Suspense>}
      <div className="ob-link-grid">
        <LinkButton href={calendarUrl(locale, { region: calRegion })} icon={<CalendarDays size={17} aria-hidden />} tone="soft">{t('在 BAYLINK 看完整日历', 'Full calendar on BAYLINK')}</LinkButton>
        {saved.length > 0 && <LinkButton href={planUrl({ stops: saved }, catalog, locale)} icon={<CalendarPlus size={17} aria-hidden />} tone="primary">{t('把想去的带去安排', 'Plan my saved events')}</LinkButton>}
      </div>
      <p className="ob-muted ob-center">{t(`只显示${windowLabel(todayInBay(), result.windowDays, 'zh-Hans')}还没结束的活动`, `Only events ${windowLabel(todayInBay(), result.windowDays, 'en')} that haven’t ended`)} · {catalogUpdatedLabel(catalog?.checkedAt, locale)}</p>
    </div>
  );
}

const FLYER_TINTS = ['#f6e3c4', '#dcebe4', '#f3d6cc', '#e3e4f2', '#efe6c8'];

function Flyer({ item, index, saved }: { item: RankedEvent; index: number; saved: boolean }) {
  const { t, locale } = useT();
  const { event } = item;
  const day = shortDay(item.nextDate, locale);
  if (item.tonight) day.week = t('今晚', 'Tonight');
  const category = categoryLabel(event);
  const region = REGION_LABELS[event.region];
  const tilt = [-2.2, 1.6, -1, 2.4, -1.8][index % 5];
  // wave 5 (city mode): an event at a mapped San Francisco venue can be gone to (lane R's venue table, N's goTo)
  const spot = eventSpot(event);
  return (
    <li className={`ob-flyer${spot ? ' has-go' : ''}`} style={{ '--tilt': `${tilt}deg`, '--tint': FLYER_TINTS[index % FLYER_TINTS.length], animationDelay: `${index * 70}ms` } as CSSProperties}>
      <button type="button" onClick={() => openEvent(event.id)} aria-label={`${event.title} · ${day.top} ${day.big}`}>
        <span className="ob-flyer-pin" aria-hidden />
        <span className="ob-flyer-date"><small>{day.week}</small><strong>{day.big}</strong><small>{day.month}</small></span>
        <span className="ob-flyer-body">
          <span className="ob-flyer-title">{event.title}</span>
          <span className="ob-flyer-meta">{joinPlace([event.city, region ? t(region) : null])}</span>
          <span className="ob-flyer-tags">
            {event.cost === 'free' && <em className="is-free">{t('免费', 'Free')}</em>}
            {category && <em>{t(category)}</em>}
            {item.reasons.filter(reason => reason.en !== 'Free' && reason.en !== category?.en && reason.en !== region?.en).slice(0, 2).map((reason, i) => <em key={i} className="is-reason">{t(reason)}</em>)}
          </span>
        </span>
        {saved && <span className="ob-flyer-saved" aria-label={t('已加入想去', 'Saved')}><Heart size={14} aria-hidden /></span>}
      </button>
      {spot && <button type="button" className="ob-flyer-go" onClick={() => { goToEvent(event); }} aria-label={t(`带我去${spot.name.zh}`, `Take me to ${spot.name.en}`)}>{t('带我去', 'Go')}</button>}
    </li>
  );
}
