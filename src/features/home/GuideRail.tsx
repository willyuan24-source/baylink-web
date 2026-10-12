import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChipRow, Cover, FeedCard, FilterChip, TypeCover } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { FamilyLinkButton } from '../../components/FamilyLinkButton';
import { translateText } from '../../i18n/locale';
import { HOME_INTENTS, type HomeIntentId } from '../../data/home-pathways';
import type { ResolvedCover } from '../../lib/cover';
import type { HomeGuide } from '../../lib/home-catalog';
import { guideTitleHead, TOPIC_LABELS } from './home-model';

const RAIL_SIZES = '(max-width: 767px) 240px, 280px';

/** A guide's cover: its photo (provenance badge), or the topic's information card with the short title and source count. */
function GuideCard({ guide, cover }: { guide: HomeGuide; cover: ResolvedCover }) {
  const { t, pick, locale } = useUiCopy();
  const topic = TOPIC_LABELS[guide.topic];
  const sources = guide.sources ? t(`${guide.sources} 个官方来源`, `${guide.sources} official source${guide.sources === 1 ? '' : 's'}`) : '';
  const fallback = <TypeCover family="guide" tone={guide.tone} icon={guide.icon} label={pick(topic)} ratio="4:5"
    title={guideTitleHead(translateText(guide.title, locale))} place={sources || undefined} ariaHidden />;
  return <FeedCard title={guide.title} to={`/guides/${guide.slug}`} className="home-guide"
    cover={<Cover cover={cover} fallback={fallback} ratio="4:5" sizes={RAIL_SIZES} decorative />}
    meta={[sources, t(`约 ${guide.readMinutes} 分钟`, `${guide.readMinutes} min read`)].filter(Boolean).join(' · ')} />;
}

/**
 * ⑥ 办事与生活指南 (1007 §4.2 ⑥, HOMEIA-08): five intents with 长辈与家属 second, the reader's choice remembered, a rail of
 * 4:5 guide covers, the way into the whole topic and, on 长辈与家属, 发给家人（大字版） (HOMEIA-07).
 */
export function GuideRail({ intent, onIntent, guides, covers, guideCount }: { intent: HomeIntentId; onIntent: (intent: HomeIntentId) => void; guides: readonly HomeGuide[]; covers: readonly ResolvedCover[]; guideCount: number }) {
  const { t } = useUiCopy();
  const selected = HOME_INTENTS.find(item => item.id === intent)!;
  const topic = TOPIC_LABELS[selected.topic];
  return <section className="home-guides" aria-labelledby="home-guides-title">
    <div className="home-section-head">
      <h2 id="home-guides-title">{t('办事与生活指南', 'How-to guides')}</h2>
      <Link to="/guides" className="home-section-head__more">{t(`${guideCount} 篇指南`, `${guideCount} guides`)}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
    </div>
    <ChipRow label={t('你想办什么', 'What do you need?')} className="home-guides__intents">
      {HOME_INTENTS.map(item => <FilterChip key={item.id} selected={item.id === intent} aria-controls="home-guides-rail" onClick={() => onIntent(item.id)}>{t(item.label, item.en)}</FilterChip>)}
    </ChipRow>
    <ul id="home-guides-rail" className="home-guides__rail" aria-label={t(selected.label, selected.en)}>
      {guides.map((guide, index) => <li key={guide.slug}><GuideCard guide={guide} cover={covers[index]} /></li>)}
    </ul>
    <div className="home-guides__more">
      <Link to={`/guides?topic=${selected.topic}`}>{t(`看全部「${topic.zh}」指南`, `All ${topic.en} guides`)}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
      {intent === 'elders' && <FamilyLinkButton path="/guides?topic=elders" title={t('长辈与家属：湾区中文办事指南', 'Seniors & family: Bay Area guides')} variant="tonal" />}
    </div>
  </section>;
}
