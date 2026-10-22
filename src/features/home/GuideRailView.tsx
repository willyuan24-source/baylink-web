import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChipRow, Cover, FeedCard, FilterChip } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { FamilyLinkButton } from '../../components/FamilyLinkButton';
import type { HomeIntentId } from '../../data/home-pathways';
import type { ResolvedCover } from '../../lib/cover';
import type { Copy } from '../../lib/event-facts';
import type { HomeGuide } from '../../lib/home-catalog';

/** One of the home's reader intents (src/data/home-pathways.ts). */
export type HomeIntent = { readonly id: HomeIntentId; readonly label: string; readonly en: string; readonly topic: string | null };
type TopicLabels = Readonly<Record<string, Copy>>;

const GRID_SIZES = '(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 290px';

/**
 * A guide's cover: its picture with its badge (its own photo, else a ③ 示意图 of its topic; UI9-IMAGES DECISIONS 21: never
 * a title plate); the caption prints the whole title.
 */
function GuideCard({ guide, cover }: { guide: HomeGuide; cover: ResolvedCover }) {
  const { t } = useUiCopy();
  const sources = guide.sources ? t(`${guide.sources} 个官方来源`, `${guide.sources} official source${guide.sources === 1 ? '' : 's'}`) : '';
  return <FeedCard title={guide.title} to={`/guides/${guide.slug}`} className="home-guide"
    cover={<Cover cover={cover} kind="guide" ratio="3:2" sizes={GRID_SIZES} decorative />}
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
      {guides.map((guide, index) => <li key={guide.slug}><GuideCard guide={guide} cover={covers[index]} /></li>)}
    </ul>
    <div className="home-guides__more">
      {topic ? <Link to={`/guides?topic=${selected.topic}`} className="home-section-head__more">{t(`看全部「${topic.zh}」指南`, `All ${topic.en} guides`)}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
        : <Link to="/guides" className="home-section-head__more">{t('看全部办事指南', 'All how-to guides')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>}
      {intent === 'elders' && <FamilyLinkButton path="/guides?topic=elders" title={t('长辈与家属：湾区中文办事指南', 'Seniors & family: Bay Area guides')} variant="secondary" />}
    </div>
  </section>;
}
