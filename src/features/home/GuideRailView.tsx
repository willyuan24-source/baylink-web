import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChipRow, Cover, FeedCard, FilterChip } from '../../components/ui';
import { DeferredGuideTypeCover } from '../../components/ui/cover-defer';
import { useUiCopy } from '../../components/ui/ui-copy';
import { FamilyLinkButton } from '../../components/FamilyLinkButton';
import { translateText } from '../../i18n/locale';
import type { HomeIntentId } from '../../data/home-pathways';
import type { ResolvedCover } from '../../lib/cover';
import type { Copy } from '../../lib/event-facts';
import type { HomeGuide } from '../../lib/home-catalog';

/** One of the home's reader intents (src/data/home-pathways.ts). */
export type HomeIntent = { readonly id: HomeIntentId; readonly label: string; readonly en: string; readonly topic: string | null };
type TopicLabels = Readonly<Record<string, Copy>>;

const GRID_SIZES = '(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 290px';

/**
 * A guide title's head before its first colon (≥4 characters), from the already-translated title — the same rule as the
 * guide pages' splitGuideTitle (features/guides/guide-facts.ts, which loads the guide catalog, so it is not imported here).
 * It lives in this view (UI9-C put it in home-model.ts): the view imports nothing from the home's own modules.
 */
const guideTitleHead = (title: string): string => /^(.{4,}?)\s*[：:｜|]\s*.+$/su.exec(title.trim())?.[1] ?? title.trim();

/**
 * A guide's cover: its photo (provenance chip), or the headline / number cover (UI9-C, G19) with the title after its colon
 * (the whole title when it has none); the caption then shows the head only (or nothing), so the cover never repeats it.
 * The family loads after the page (cover-defer.tsx): the rail is below the home's first screen.
 */
function GuideCard({ guide, cover, topicLabels }: { guide: HomeGuide; cover: ResolvedCover; topicLabels: TopicLabels }) {
  const { t, pick, locale } = useUiCopy();
  const sources = guide.sources ? t(`${guide.sources} 个官方来源`, `${guide.sources} official source${guide.sources === 1 ? '' : 's'}`) : '';
  const title = translateText(guide.title, locale), head = guideTitleHead(title);
  const caption = head === title ? '' : head, hook = caption ? title.slice(head.length).replace(/^\s*[：:｜|]\s*/u, '') : title;
  const fallback = <DeferredGuideTypeCover slug={guide.slug} topic={guide.topic} topicLabel={pick(topicLabels[guide.topic])} hook={hook} ratio="3:2" ariaHidden />;
  return <FeedCard title={guide.title} titleShown={cover.tier === 'type' ? caption : undefined} to={`/guides/${guide.slug}`} className="home-guide"
    cover={<Cover cover={cover} kind="guide" fallback={fallback} ratio="3:2" sizes={GRID_SIZES} decorative />}
    meta={[sources, t(`约 ${guide.readMinutes} 分钟`, `${guide.readMinutes} min read`)].filter(Boolean).join(' · ')} />;
}

/**
 * ⑥ 办事与生活指南 (1007 §4.2 ⑥, HOMEIA-08): five intents with 长辈与家属 second (wrapped chips), the reader's choice
 * remembered, four 3:2 guide covers in a grid (2 × 2 on a phone, four across on a desktop, three rows at 大 / 特大; UI9-HOME),
 * the way into the whole topic and, on 长辈与家属, 发给家人（大字版） (HOMEIA-07). Hidden in 简洁.
 *
 * The intents and the topic names come in as props (GuideRail.tsx passes the home's own): the home loads this view after
 * the page in production, and a view that imported them would make the home's chunk export them, which drops its
 * manifest entry (scripts/verify-release.mjs reads src/pages/HomePage.tsx).
 */
export type GuideRailProps = { intent: HomeIntentId; onIntent: (intent: HomeIntentId) => void; guides: readonly HomeGuide[]; covers: readonly ResolvedCover[]; guideCount: number };

export function GuideRailView({ intents, topicLabels, intent, onIntent, guides, covers, guideCount }: GuideRailProps & { intents: readonly HomeIntent[]; topicLabels: TopicLabels }) {
  const { t } = useUiCopy();
  const selected = intents.find(item => item.id === intent)!;
  const topic = selected.topic && topicLabels[selected.topic];
  return <section className="home-guides" aria-labelledby="home-guides-title" data-simple="hide">
    <div className="home-section-head">
      <h2 id="home-guides-title">{t('办事与生活指南', 'How-to guides')}</h2>
      <Link to="/guides" className="home-section-head__more">{t(`${guideCount} 篇指南`, `${guideCount} guides`)}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
    </div>
    <ChipRow label={t('你想办什么', 'What do you need?')} className="home-guides__intents">
      {intents.map(item => <FilterChip key={item.id} selected={item.id === intent} aria-controls="home-guides-rail" onClick={() => onIntent(item.id)}>{t(item.label, item.en)}</FilterChip>)}
    </ChipRow>
    <ul id="home-guides-rail" className="home-guides__rail" aria-label={t(selected.label, selected.en)}>
      {guides.map((guide, index) => <li key={guide.slug}><GuideCard guide={guide} cover={covers[index]} topicLabels={topicLabels} /></li>)}
    </ul>
    <div className="home-guides__more">
      {topic ? <Link to={`/guides?topic=${selected.topic}`} className="home-section-head__more">{t(`看全部「${topic.zh}」指南`, `All ${topic.en} guides`)}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
        : <Link to="/guides" className="home-section-head__more">{t('看全部办事指南', 'All how-to guides')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>}
      {intent === 'elders' && <FamilyLinkButton path="/guides?topic=elders" title={t('长辈与家属：湾区中文办事指南', 'Seniors & family: Bay Area guides')} variant="secondary" />}
    </div>
  </section>;
}
