import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { BookOpen, CalendarPlus, ChevronDown, Globe2, Heart, Phone, Volume2, Square } from 'lucide-react';
import './baybay-answer.css';
import { EventCover, OfferCover, OpeningCover, Cover, TypeCover } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { languagePrefix } from '../../lib/language-path';
import { plannerWebAnswerParts, type PlannerWebResult } from '../../lib/planner-web-search';
import { brandCase, eventDateChip, eventPlace, eventPriceChip, eventTimeLabel, formatDateChip, offerDeadline, openingChip } from '../../lib/event-facts';
import { bayBayAnswerView, bayBayReadableText, bayBayResumeLabel, BAYBAY_HELP_ACTIONS, type BayBayAnswerFields, type BayBayCallAction, type BayBayEmergencySafety, type BayBayNoticeKind, type BayBayPoint, type BayBayProfessionalSafety } from '../../lib/baybay-answer';
import { bayBayCardCitations, bayBayCardModels, bayBaySitePath, type BayBayCardModel } from './answer-cards';
import { useBayBaySaves } from './save-context';
import type { BayBayQuickCard } from '../../lib/baybay-stream';

type Navigate = (path: string) => void;
type Sources = PlannerWebResult['sources'];

/** A link that opens BAYLINK pages inside the app (closing the panel) and everything else in a new tab. */
function SmartLink({ href, onNavigate, className, children, title }: { href: string; onNavigate?: Navigate; className?: string; children: React.ReactNode; title?: string }) {
  const { locale } = useUiCopy();
  const path = href.startsWith('/') && !href.startsWith('//') ? href : bayBaySitePath(href);
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!path || !onNavigate || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate(path);
  };
  return path ? <a className={className} href={`${languagePrefix(locale)}${path}`} title={title} onClick={open}>{children}</a>
    : <a className={className} href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>;
}

/** Answer text with its `[n]` citations as small links to the cited source. */
export function BayBayCitedText({ text, sources, onNavigate }: { text: string; sources: Sources; onNavigate?: Navigate }) {
  return <>{plannerWebAnswerParts({ answer: text, sources }, true).map((part, index) => {
    const href = part.source?.url || part.href;
    if (!href) return <span key={index}>{part.text}</span>;
    return <SmartLink key={index} href={href} onNavigate={onNavigate} className={part.source ? 'bb-cite' : 'bb-inline-link'} title={part.source?.title}>{part.text}</SmartLink>;
  })}</>;
}

/** One 13px meta line: 日期 · 时段 · 费用 · 城市 (events), deadline · brand (offers), opening chip · city (openings). */
function cardMeta(model: BayBayCardModel, today: string, english: boolean, pick: (copy: { zh: string; en: string }) => string): string {
  if (model.kind === 'event') {
    const chip = eventDateChip(model.event, today, model.day ? [model.day] : []);
    const time = chip.kind === 'day' ? eventTimeLabel(model.event, chip.date, english) : undefined;
    const price = eventPriceChip(model.event);
    return [formatDateChip(chip, english).label, time, price ? pick(price.text) : undefined, eventPlace(model.event)].filter(Boolean).join(' · ');
  }
  if (model.kind === 'offer') {
    const deadline = offerDeadline(model.offer, today);
    return [deadline ? pick(deadline.text) : undefined, brandCase(model.offer.brand)].filter(Boolean).join(' · ');
  }
  if (model.kind === 'opening') return [pick(openingChip(model.shop, today)), model.shop.city].filter(Boolean).join(' · ');
  return pick({ zh: '办事指南', en: 'Guide' });
}

function CardCover({ model, today }: { model: BayBayCardModel; today: string }) {
  const { pick } = useUiCopy();
  const slot = { cover: model.cover, ratio: '16:10' as const, ratioLock: true, decorative: true, sizes: '264px' };
  if (model.kind === 'event') return <EventCover {...slot} event={model.event} today={today} days={model.day ? [model.day] : []} />;
  if (model.kind === 'offer') return <OfferCover {...slot} offer={model.offer} today={today} />;
  if (model.kind === 'opening') return <OpeningCover {...slot} opening={model.shop} today={today} />;
  return <Cover {...slot} fallback={<TypeCover tone="culture" label={pick({ zh: '办事指南', en: 'Guide' })} title={model.title} ratio="16:10" ratioLock ariaHidden />} />;
}

function CardActions({ model, onNavigate }: { model: BayBayCardModel; onNavigate: Navigate }) {
  const { t } = useUiCopy();
  const saves = useBayBaySaves();
  if (model.ended) return <p className="bb-card__ended">{t('已结束 · 仅供参考', 'Ended · reference only')}</p>;
  if (model.kind !== 'event') return null;
  const favorite = { kind: 'event' as const, id: model.event.id };
  const saved = !!saves?.ready && saves.saved(favorite);
  const plan = `/plan?${model.day ? `date=${model.day}&` : ''}stops=${encodeURIComponent(`event:${model.event.id}`)}`;
  return <div className="bb-card__actions">
    <button type="button" aria-pressed={saves?.ready ? saved : undefined} disabled={!saves?.ready || saves.busy} onClick={() => saves?.toggle(favorite)}
      aria-label={saved ? t(`已想去：${model.title}`, `Saved: ${model.title}`) : t(`想去：${model.title}`, `Want to go: ${model.title}`)}>
      <Heart aria-hidden="true" size={18} fill={saved ? 'currentColor' : 'none'} />{saved ? t('已想去', 'Saved') : t('想去', 'Want to go')}
    </button>
    <button type="button" onClick={() => onNavigate(plan)} aria-label={t(`加入行程：${model.title}`, `Add to a plan: ${model.title}`)}><CalendarPlus aria-hidden="true" size={18} />{t('加入行程', 'Add to plan')}</button>
  </div>;
}

/** Horizontal image cards (264 wide, 16:10, provenance badge, title 16/600, one meta line, ♡ 想去 / 加入行程). */
export function BayBayCardRail({ cards, sources = [], today, onNavigate, label }: { cards: readonly BayBayQuickCard[]; sources?: Sources; today: string; onNavigate: Navigate; label?: string }) {
  const { t, english, pick } = useUiCopy();
  const models = useMemo(() => bayBayCardModels(cards, today), [cards, today]);
  const citations = useMemo(() => bayBayCardCitations(models, sources), [models, sources]);
  if (!models.length) return null;
  return <ul className="bb-cards" data-count={models.length} aria-label={label || t('相关活动与去处', 'Related events and places')}>
    {models.map(model => {
      const cited = citations.get(model.key);
      return <li key={model.key} className="bb-card" data-kind={model.kind} data-card-key={model.key}>
        <h4 className="bb-card__title"><SmartLink className="bb-card__link" href={model.url} onNavigate={onNavigate}>{cited !== undefined && <span className="bb-card__n" aria-label={t(`来源 ${cited}`, `Source ${cited}`)}>[{cited}]</span>}{model.title}</SmartLink></h4>
        <div className="bb-card__media"><CardCover model={model} today={today} /></div>
        <p className="bb-card__meta">{cardMeta(model, today, english, pick)}</p>
        <CardActions model={model} onNavigate={onNavigate} />
      </li>;
    })}
  </ul>;
}

/** 朗读 (简洁显示): reads the lead and points aloud with the browser's own voice; nothing is sent anywhere. */
export function BayBayReadAloud({ text }: { text: string }) {
  const { t, locale } = useUiCopy();
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  useEffect(() => () => { if (supported && speaking) window.speechSynthesis.cancel(); }, [supported, speaking]);
  if (!supported || !text) return null;
  const toggle = () => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = locale === 'en' ? 'en-US' : locale === 'zh-Hant' ? 'zh-TW' : 'zh-CN';
    utterance.onend = utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };
  return <button type="button" className="bb-read-aloud" aria-pressed={speaking} onClick={toggle}>{speaking ? <Square aria-hidden="true" size={18} /> : <Volume2 aria-hidden="true" size={18} />}{speaking ? t('停止朗读', 'Stop reading') : t('朗读回答', 'Read aloud')}</button>;
}

function PointList({ points, sources, onNavigate, className }: { points: BayBayPoint[]; sources: Sources; onNavigate: Navigate; className?: string }) {
  return <ul className={className || 'bb-points'}>{points.map((point, index) => <li key={index}><BayBayCitedText text={point.text} sources={sources} onNavigate={onNavigate} /></li>)}</ul>;
}

/**
 * The v2 answer (1007 §6.5): lead 17/600 → image cards → 2–3 points with [n] → the rest behind "更多". Returns null
 * for a response without `lead`/`points` (v1, clarifications, guard rewrites), which keep the legacy text.
 */
export function BayBayAnswerBody({ fields, cards, sources, today, onNavigate }: { fields: BayBayAnswerFields; cards: readonly BayBayQuickCard[]; sources: Sources; today: string; onNavigate: Navigate }) {
  const { t, english } = useUiCopy();
  const view = bayBayAnswerView(fields, english);
  const [expanded, setExpanded] = useState(false);
  if (!view) return null;
  const rest = view.more.length + (view.gap ? 1 : 0);
  const spoken = [view.lead, ...view.visible.map(point => point.text)].map(bayBayReadableText).join(english ? ' ' : '');
  return <div className="bb-answer" data-answer-layout="v2">
    <p className="bb-lead"><BayBayCitedText text={view.lead} sources={sources} onNavigate={onNavigate} /></p>
    <BayBayCardRail cards={cards} sources={sources} today={today} onNavigate={onNavigate} />
    {view.visible.length > 0 && <PointList points={view.visible} sources={sources} onNavigate={onNavigate} />}
    {rest > 0 && (expanded ? <>
      {view.more.length > 0 && <PointList points={view.more} sources={sources} onNavigate={onNavigate} className="bb-points bb-points--more" />}
      {view.gap && <p className="bb-gap"><BayBayCitedText text={view.gap} sources={sources} onNavigate={onNavigate} /></p>}
    </> : <button type="button" className="bb-more" aria-expanded="false" onClick={() => setExpanded(true)}><ChevronDown aria-hidden="true" size={18} />{t(`更多（${rest} 条）`, `${rest} more`)}</button>)}
    {fields.corrected && <p className="bb-corrected">{t('已按站内资料更正', 'Corrected from site information')}</p>}
    <BayBayReadAloud text={spoken} />
  </div>;
}

/** The pending bubble while drafts stream: the lead, then each point as it arrives. Unvalidated text, never live. */
export function BayBayDraftPreview({ lead, points }: { lead: string; points: readonly string[] }) {
  const shown = points.filter(Boolean);
  if (!lead && !shown.length) return null;
  return <div className="bb-answer bb-answer--draft" data-draft="">
    {lead && <p className="bb-lead baybay-stream-answer">{lead}</p>}
    {shown.length > 0 && <ul className="bb-points">{shown.map((point, index) => <li key={index}>{point}</li>)}</ul>}
  </div>;
}

/** 911 / 211 / Poison Control / 988 as large call buttons; the primary one first. */
export function BayBayCallActions({ actions, className }: { actions: readonly BayBayCallAction[]; className?: string }) {
  const { t } = useUiCopy();
  if (!actions.length) return null;
  const ordered = [...actions].sort((a, b) => Number(!!b.primary || b.href === 'tel:911') - Number(!!a.primary || a.href === 'tel:911'));
  return <div className={className || 'bb-call-actions'}>{ordered.map(action => <a key={action.id} href={action.href} className="bb-call" data-primary={action.primary || action.href === 'tel:911' ? '' : undefined}
    aria-label={/^\d+$/.test(action.label) ? t(`拨打 ${action.label}`, `Call ${action.label}`) : undefined}><Phone aria-hidden="true" size={18} />{action.label}</a>)}</div>;
}

/** The red emergency card (BBLIVE-09): first in the answer, a 56px tel:911 button, no feedback or follow-ups. */
export function BayBayEmergencyCard({ safety, answer }: { safety: BayBayEmergencySafety; answer?: string }) {
  const { t } = useUiCopy();
  const primary = safety.actions.find(action => action.href === 'tel:911')!;
  const others = safety.actions.filter(action => action !== primary);
  return <section className="bb-emergency" role="alert" aria-labelledby="bb-emergency-title" data-safety="emergency">
    <h3 id="bb-emergency-title" className="bb-emergency__title">{safety.title || t('现在就打 911', 'Call 911 now')}</h3>
    <a className="bb-emergency__call" href={primary.href}><Phone aria-hidden="true" size={24} />{primary.label}</a>
    {answer && <p className="bb-emergency__text">{answer}</p>}
    {others.length > 0 && <BayBayCallActions actions={others} className="bb-call-actions bb-call-actions--emergency" />}
  </section>;
}

/** Official help for a professional topic (医疗、保险、税务、移民、法律): numbers to call and the pillar guide. */
export function BayBayResourceCard({ safety, onNavigate }: { safety: BayBayProfessionalSafety; onNavigate: Navigate }) {
  const { t } = useUiCopy();
  return <section className="bb-resources" aria-label={t('官方求助渠道', 'Official help')} data-safety="professional">
    <h4>{t('官方求助渠道', 'Official help')}</h4>
    <p className="bb-resources__note">{t('BayBay 只讲一般规则，不判断个人资格；个人情况请问下面的官方或免费咨询服务。', 'BayBay explains general rules only and does not decide personal eligibility. Ask the official or free counseling services below.')}</p>
    <ul>
      {safety.resources.map(resource => <li key={resource.id}>
        <SmartLink href={resource.url} className="bb-resources__name"><Globe2 aria-hidden="true" size={16} />{resource.title}</SmartLink>
        {resource.href && resource.phone && <a className="bb-call" href={resource.href} aria-label={t(`拨打 ${resource.title} ${resource.phone}`, `Call ${resource.title} ${resource.phone}`)}><Phone aria-hidden="true" size={18} />{resource.phone}</a>}
      </li>)}
      {safety.guides.map(guide => <li key={guide.slug}><SmartLink href={guide.url} onNavigate={onNavigate} className="bb-resources__name"><BookOpen aria-hidden="true" size={16} />{guide.title}</SmartLink></li>)}
    </ul>
  </section>;
}

const PAUSE_KINDS: readonly BayBayNoticeKind[] = ['ai_daily_budget', 'ai_paused'];
/** Pause / daily-limit / reduced-mode banner. Paused kinds lead with 911 / 211; never a dollar amount. */
export function BayBayNoticeBanner({ kind, text, resumesAt, actions }: { kind: BayBayNoticeKind; text: string; resumesAt?: string; actions?: readonly BayBayCallAction[] }) {
  const { t, english } = useUiCopy();
  const paused = PAUSE_KINDS.includes(kind);
  const resume = resumesAt ? bayBayResumeLabel(resumesAt, english) : '';
  return <div className="bb-notice" data-notice={kind} role="status">
    {paused && <BayBayCallActions actions={actions?.length ? actions : BAYBAY_HELP_ACTIONS} />}
    <p translate="no">{text}{resume && <span className="bb-notice__resume">{t(`预计 ${resume}（湾区时间）恢复`, ` Back around ${resume} (Bay Area time).`)}</span>}</p>
  </div>;
}
