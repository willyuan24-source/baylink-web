import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { BookOpen, ChevronDown, Globe2, Phone } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Disclosure } from '../../components/ui/Disclosure';
import './baybay-answer.css';
import { useBayBayCopy } from './copy';
import { SmartLink } from './SmartLink';
import { useBayBayCardsModule } from './cards-loader';
import { plannerWebAnswerParts, type PlannerWebResult } from '../../lib/planner-web-search';
import { bayBayAnswerView, bayBayOrderCards, bayBayNoticeCalls, bayBayResumeLabel, bayBayResumeStyle, type BayBayAnswerFields, type BayBayCallAction, type BayBayEmergencySafety, type BayBayNoticeKind, type BayBayProfessionalSafety, type BayBayViewPoint } from '../../lib/baybay-answer';
import type { BayBayQuickCard } from '../../lib/baybay-stream';
import { linkifyPhones } from '../../lib/phone-links';
import { findPhoneNumbers } from '../../lib/phone-numbers';
import { translateText } from '../../i18n/locale';

type Navigate = (path: string) => void;
type Sources = PlannerWebResult['sources'];

/**
 * Reader text with every phone number tap-to-call (G27, ELDERS' chips): translated first, then split (RC-11 i), so a
 * zh-Hant reader gets the converted sentence and an English answer is left as it is. A number in `except` (one a big call
 * button beside the text already dials) stays plain text, but in one piece: never "1-" at a line end and "800-…" below.
 */
export function BayBayPhoneText({ text, except }: { text: string; except?: ReadonlySet<string> }) {
  const { locale } = useBayBayCopy();
  const translated = translateText(text, locale);
  const kept = except?.size ? findPhoneNumbers(translated).filter(match => except.has(match.tel)) : [];
  if (!kept.length) return <>{linkifyPhones(translated)}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  for (const match of kept) {
    if (match.start > at) parts.push(<Fragment key={`text-${at}`}>{linkifyPhones(translated.slice(at, match.start))}</Fragment>);
    parts.push(<span key={`number-${match.start}`} className="bb-phone-number">{match.text}</span>);
    at = match.end;
  }
  if (at < translated.length) parts.push(<Fragment key={`text-${at}`}>{linkifyPhones(translated.slice(at))}</Fragment>);
  return <>{parts}</>;
}

/** Answer text with its `[n]` citations as small links to the cited source and tap-to-call numbers. */
export function BayBayCitedText({ text, sources, onNavigate }: { text: string; sources: Sources; onNavigate?: Navigate }) {
  return <>{plannerWebAnswerParts({ answer: text, sources }, true).map((part, index) => {
    const href = part.source?.url || part.href;
    if (!href) return <span key={index}><BayBayPhoneText text={part.text} /></span>;
    // A citation is C's number plate (one line, tabular): its number shown, "[n]" kept for the reader's text.
    if (part.source) return <SmartLink key={index} href={href} onNavigate={onNavigate} className="bb-cite ui-plate" title={part.source.title}><span className="sr-only">[</span>{part.text.replace(/^\[|\]$/g, '')}<span className="sr-only">]</span></SmartLink>;
    return <SmartLink key={index} href={href} onNavigate={onNavigate} className="bb-inline-link">{part.text}</SmartLink>;
  })}</>;
}

/**
 * The image cards load as their own chunk (covers and the listing data), started when the panel opens, so the
 * site's entry does not list their dependencies; until then a fixed-height placeholder keeps the layout still. If the
 * chunk cannot load (offline, or a deploy renamed it), the same listings show as plain links, never an endless placeholder.
 */
export function BayBayCardRail(props: { cards: readonly BayBayQuickCard[]; sources?: Sources; today: string; onNavigate: Navigate; label?: string }) {
  const { t } = useBayBayCopy();
  const { module, failed } = useBayBayCardsModule(props.cards.length > 0);
  if (!props.cards.length) return null;
  if (module) { const Rail = module.BayBayCardRailView; return <Rail {...props} />; }
  if (!failed) return <div className="bb-cards bb-cards--loading" aria-hidden="true"><span /><span /></div>;
  const seen = new Set<string>();
  const links = props.cards.filter(card => !seen.has(card.url) && !!seen.add(card.url)).slice(0, 5);
  return <ul className="bb-card-links" data-fallback="" aria-label={props.label || t('相关活动与去处', 'Related events and places')}>
    {links.map(card => <li key={card.url}><SmartLink href={card.url} onNavigate={props.onNavigate}>{card.title}</SmartLink></li>)}
  </ul>;
}

/** The answer whose voice is playing, so one answer's 朗读 never stops another's. */
let voice: { utterance: SpeechSynthesisUtterance; release: () => void } | null = null;

/** 朗读 (the head row of each v2 answer): reads the lead and points aloud with the browser's own voice; nothing is sent anywhere. */
export function BayBayReadAloud({ text }: { text: string }) {
  const { t, locale } = useBayBayCopy();
  const [speaking, setSpeaking] = useState(false);
  const mine = useRef<SpeechSynthesisUtterance | null>(null);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  // Stop on unmount only, and only this answer's own voice (an effect on `speaking` would cancel a newer answer's).
  useEffect(() => () => { const own = mine.current; mine.current = null; if (own && voice?.utterance === own) { voice = null; window.speechSynthesis.cancel(); } }, []);
  if (!supported || !text) return null;
  const toggle = () => {
    if (speaking) {
      const own = mine.current;
      mine.current = null;
      setSpeaking(false);
      if (own && voice?.utterance === own) { voice = null; window.speechSynthesis.cancel(); }
      return;
    }
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = locale === 'en' ? 'en-US' : locale === 'zh-Hant' ? 'zh-TW' : 'zh-CN';
    // An end, an error (an interrupted voice reports one) or a newer answer taking over only ever resets this answer.
    const release = () => { if (voice?.utterance === utterance) voice = null; if (mine.current === utterance) { mine.current = null; setSpeaking(false); } };
    utterance.onend = utterance.onerror = release;
    const previous = voice;
    voice = null;
    previous?.release();
    window.speechSynthesis.cancel();
    mine.current = utterance;
    voice = { utterance, release };
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };
  return <Button variant="quiet" className="bb-read-aloud" aria-pressed={speaking} onClick={toggle}>{speaking ? t('停止朗读', 'Stop reading') : t('朗读回答', 'Read aloud')}</Button>;
}

function PointList({ points, sources, onNavigate, className }: { points: BayBayViewPoint[]; sources: Sources; onNavigate: Navigate; className?: string }) {
  return <ul className={className || 'bb-points'}>{points.map((point, index) => <li key={index} data-continued={point.continued ? '' : undefined}><BayBayCitedText text={point.text} sources={sources} onNavigate={onNavigate} /></li>)}</ul>;
}

/**
 * The v2 answer (content arrangement 10-19): the lead (reading size, 400) → ≤3 points with [n] → the image cards → the rest
 * behind "更多". With a plan (`plan`: the safety calls or resource card, then the plan card) the plan follows the lead and the
 * points fold into 更多说明 after it; `cards` are then only the places that are not a stop. Returns null for a response
 * without `lead`/`points` (v1, clarifications, guard rewrites), which keep the legacy text. 朗读 is in the turn's head row.
 */
export function BayBayAnswerBody({ fields, cards, sources, today, onNavigate, before, plan }: { fields: BayBayAnswerFields; cards: readonly BayBayQuickCard[]; sources: Sources; today: string; onNavigate: Navigate; before?: ReactNode; plan?: ReactNode }) {
  const { t, english } = useBayBayCopy();
  const view = bayBayAnswerView(fields, english);
  const [expanded, setExpanded] = useState(false);
  // Card [n] ↔ point: the rail follows the points that name each card, then the server's order.
  const ordered = useMemo(() => bayBayOrderCards(cards, fields.points || []), [cards, fields.points]);
  if (!view) return null;
  const rest = view.more.length + (view.gap ? 1 : 0);
  // Keyed lists, not fragments: the locale host rebuilds a fragment's children as an unkeyed array.
  const more = [
    view.more.length > 0 && <PointList key="more" points={view.more} sources={sources} onNavigate={onNavigate} className="bb-points bb-points--more" />,
    view.gap && <p key="gap" className="bb-gap"><BayBayCitedText text={view.gap} sources={sources} onNavigate={onNavigate} /></p>,
  ];
  const lead = <p className="bb-lead"><BayBayCitedText text={view.lead} sources={sources} onNavigate={onNavigate} /></p>;
  const visible = view.visible.length > 0 && <PointList points={view.visible} sources={sources} onNavigate={onNavigate} />;
  const rail = <BayBayCardRail cards={ordered} sources={sources} today={today} onNavigate={onNavigate} />;
  const corrected = fields.corrected && <p className="bb-corrected">{t('已按站内资料更正', 'Corrected from site information')}</p>;
  if (plan) return <div className="bb-answer" data-answer-layout="v2" data-plan="">
    {lead}{before}{plan}
    {view.visible.length + rest > 0 && <Disclosure className="bb-more-details" summary={t('更多说明', 'More details')}>{visible}{more}</Disclosure>}
    {rail}{corrected}
  </div>;
  return <div className="bb-answer" data-answer-layout="v2">
    {lead}{visible}{rail}
    {rest > 0 && (expanded ? more : <Button variant="quiet" className="bb-more" aria-expanded="false" onClick={() => setExpanded(true)} icon={<ChevronDown aria-hidden="true" size={20} />}>{t(`更多（${rest} 条）`, `${rest} more`)}</Button>)}
    {corrected}
  </div>;
}

/**
 * The pending bubble in the final answer's order, so nothing jumps when the result replaces it: the streamed lead (or
 * the legacy answer's validated text, in the legacy text style), each point as it arrives, then the verified cards.
 * Draft text is unvalidated and never live.
 */
export function BayBayDraftPreview({ lead, legacy = '', points, cards = [], today, onNavigate }: { lead: string; legacy?: string; points: readonly string[]; cards?: readonly BayBayQuickCard[]; today: string; onNavigate: Navigate }) {
  const text = legacy || lead;
  const shown = legacy ? [] : points.filter(Boolean);
  if (!text && !shown.length && !cards.length) return null;
  return <div className="bb-answer bb-answer--draft" data-draft="">
    {text && <p className={legacy ? 'member-baybay-answer-text baybay-stream-answer' : 'bb-lead baybay-stream-answer'}>{text}</p>}
    {shown.length > 0 && <ul className="bb-points">{shown.map((point, index) => <li key={index}>{point}</li>)}</ul>}
    <BayBayCardRail cards={cards} today={today} onNavigate={onNavigate} />
  </div>;
}

/** "Poison Control 1-800-222-1222": the words may wrap, the number at the end stays on one line. */
function CallLabel({ label }: { label: string }) {
  const match = /^(.*?\S)\s+(\+?[\d(][\d\s().-]*\d)$/.exec(label);
  if (!match) return <span className={/^\+?[\d(][\d\s().-]*\d$/.test(label) ? 'bb-call__number' : undefined}>{label}</span>;
  return <span>{match[1]} <span className="bb-call__number">{match[2]}</span></span>;
}

/** 911 / 211 / Poison Control / 988 as large call buttons; the primary one first. */
export function BayBayCallActions({ actions, className }: { actions: readonly BayBayCallAction[]; className?: string }) {
  const { t } = useBayBayCopy();
  if (!actions.length) return null;
  const ordered = [...actions].sort((a, b) => Number(!!b.primary || b.href === 'tel:911') - Number(!!a.primary || a.href === 'tel:911'));
  return <div className={className || 'bb-call-actions'}>{ordered.map(action => <a key={action.id} href={action.href} className="bb-call" data-primary={action.primary || action.href === 'tel:911' ? '' : undefined}
    aria-label={/^\d+$/.test(action.label) ? t(`拨打 ${action.label}`, `Call ${action.label}`) : undefined}><Phone aria-hidden="true" size={20} /><CallLabel label={action.label} /></a>)}</div>;
}

/** The red emergency card (BBLIVE-09): first in the answer, a 56px tel:911 button, no feedback or follow-ups. */
export function BayBayEmergencyCard({ safety, answer }: { safety: BayBayEmergencySafety; answer?: string }) {
  const { t } = useBayBayCopy();
  const primary = safety.actions.find(action => action.href === 'tel:911')!;
  const others = safety.actions.filter(action => action !== primary);
  // One id per card: a second emergency question in the same conversation gets its own label.
  const titleId = useId();
  // The card's own buttons already call 911, Poison Control and 988: the instructions link only the numbers they lack.
  const buttons = new Set(safety.actions.map(action => action.href.slice('tel:'.length)));
  return <section className="bb-emergency" role="alert" aria-labelledby={titleId} data-safety="emergency">
    <h3 id={titleId} className="bb-emergency__title">{safety.title || t('现在就打 911', 'Call 911 now')}</h3>
    <a className="bb-emergency__call" href={primary.href}><Phone aria-hidden="true" size={24} /><CallLabel label={primary.label} /></a>
    {answer && <p className="bb-emergency__text"><BayBayPhoneText text={answer} except={buttons} /></p>}
    {others.length > 0 && <BayBayCallActions actions={others} className="bb-call-actions bb-call-actions--emergency" />}
  </section>;
}

/** Official help for a professional topic (医疗、保险、税务、移民、法律): numbers to call and the pillar guide. */
export function BayBayResourceCard({ safety, onNavigate }: { safety: BayBayProfessionalSafety; onNavigate: Navigate }) {
  const { t } = useBayBayCopy();
  return <section className="bb-resources" aria-label={t('官方求助渠道', 'Official help')} data-safety="professional">
    <h4>{t('官方求助渠道', 'Official help')}</h4>
    <p className="bb-resources__note">{t('BayBay 只讲一般规则，不判断个人资格；个人情况请问下面的官方或免费咨询服务。', 'BayBay explains general rules only and does not decide personal eligibility. Ask the official or free counseling services below.')}</p>
    <ul>
      {safety.resources.map(resource => <li key={resource.id}>
        <SmartLink href={resource.url} className="bb-resources__name"><Globe2 aria-hidden="true" size={16} />{resource.title}</SmartLink>
        {resource.href && resource.phone && <a className="bb-call" href={resource.href} aria-label={t(`拨打 ${resource.title} ${resource.phone}`, `Call ${resource.title} ${resource.phone}`)}><Phone aria-hidden="true" size={20} /><CallLabel label={resource.phone} /></a>}
      </li>)}
      {safety.guides.map(guide => <li key={guide.slug}><SmartLink href={guide.url} onNavigate={onNavigate} className="bb-resources__name"><BookOpen aria-hidden="true" size={16} />{guide.title}</SmartLink></li>)}
    </ul>
  </section>;
}

/**
 * Pause / daily-limit / reduced-mode banner; never a dollar amount. Its call buttons follow bayBayNoticeCalls (H37): a
 * provider pause and a health-worry answer's floor lead with them; a used-up daily share is one calm line with the site's
 * own 看本周末活动 · 查办事指南 instead. `actions` are the pause's own (capabilities), `healthFloor` the answer's
 * `fallbackHelp`. `compact` is the same notice on an earlier answer: its text only, because the full banner shows once.
 */
export function BayBayNoticeBanner({ kind, text, resumesAt, actions, healthFloor, compact, onNavigate }: {
  kind: BayBayNoticeKind; text: string; resumesAt?: string; actions?: readonly BayBayCallAction[]; healthFloor?: readonly BayBayCallAction[]; compact?: boolean; onNavigate?: Navigate;
}) {
  const { t, english } = useBayBayCopy();
  // The server writes notices in the reader's language (translate="no"); only their numbers become tap-to-call.
  if (compact) return <p className="bb-notice-label" data-notice={kind} translate="no">{linkifyPhones(text)}</p>;
  const calls = bayBayNoticeCalls(kind, { actions, healthFloor });
  // The resume time once: nothing when the server text already gives a time; "即 …" after its own "明天会恢复".
  const style = bayBayResumeStyle(text);
  const resume = resumesAt && style !== 'none' ? bayBayResumeLabel(resumesAt, english) : '';
  return <div className="bb-notice" data-notice={kind} role="status">
    {calls.length > 0 && <BayBayCallActions actions={calls} />}
    <p translate="no">{linkifyPhones(text)}{resume && <span className="bb-notice__resume">{style === 'time' ? t(`即 ${resume}（湾区时间）`, ` That is ${resume} (Bay Area time).`) : t(`预计 ${resume}（湾区时间）恢复`, ` Back around ${resume} (Bay Area time).`)}</span>}</p>
    {kind === 'ai_daily_budget' && !calls.length && onNavigate && <p className="bb-notice__links">
      <Button variant="secondary" onClick={() => onNavigate('/events')}>{t('看本周末活动', 'This weekend’s events')}</Button>
      <Button variant="secondary" onClick={() => onNavigate('/guides')}>{t('查办事指南', 'Browse guides')}</Button>
    </p>}
  </div>;
}

/** The panel shows the day's remaining AI queries in a visible line once this few are left (else only in 检索、额度与对话说明). */
export const BAYBAY_QUOTA_VISIBLE = 5;

/**
 * The day's remaining AI queries above the question box once few are left (≤ BAYBAY_QUOTA_VISIBLE, from `/ai/usage`), so
 * the count is not only inside the collapsed 检索、额度与对话说明. At 0 it is the calm daily-limit line (H37): no call
 * buttons; site information and emergency help keep working (an emergency question is answered without the model).
 */
export function BayBayQuotaLine({ remaining }: { remaining: number }) {
  const { t } = useBayBayCopy();
  if (remaining > BAYBAY_QUOTA_VISIBLE) return null;
  return <p className="bb-quota" data-remaining={remaining} role="status" translate="no">{remaining > 0
    ? t(`今日 AI 查询还剩 ${remaining} 次，湾区午夜重置。`, `${remaining} AI ${remaining === 1 ? 'query' : 'queries'} left today; resets at Bay Area midnight.`)
    : t('今日 AI 额度已用完，湾区午夜重置；站内资料和紧急求助仍可用。', 'Today’s AI answers are used up and reset at Bay Area midnight. Site information and emergency help still work.')}</p>;
}
