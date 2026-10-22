import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Cover, RowCard } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { COVER_SIZES } from '../../components/ui/cover-sizes';
import type { ElderCall } from '../../lib/home-catalog';
import type { ResolvedCover } from '../../lib/cover';

/**
 * 长辈常用电话 (UI9-HOME, D2's 长辈也方便, D3's 简洁 calls): the 长辈与家属 guides that carry a cover phone, in the intent's
 * order, as F's RowCard rows with the guide's picture (UI9-IMG-A1b, DECISIONS 21: its own, else its ③ stock picture). Each row opens its guide; its one 48 px 拨打 button shows the number and
 * dials it (tel:). The
 * numbers come only from the generated elderCalls projection (the guides' own cover phones). With none, nothing shows,
 * except 长辈与家属指南 → in 简洁.
 */
export function ElderCalls({ calls, covers = [] }: { calls: readonly ElderCall[]; covers?: readonly ResolvedCover[] }) {
  const { t, pick } = useUiCopy();
  if (!calls.length) return <p className="home-elder" data-simple="only"><Link to="/guides?topic=elders" className="home-section-head__more">{t('长辈与家属指南', 'Guides for seniors & family')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link></p>;
  return <section className="home-elder" aria-labelledby="home-elder-title">
    <div className="home-section-head"><h2 id="home-elder-title">{t('长辈常用电话', 'Phone lines for seniors')}</h2></div>
    {calls.map((call, index) => <RowCard key={call.slug} title={pick(call.title)} to={`/guides/${call.slug}`} meta={pick(call.label)}
      thumb={covers[index] && covers[index].tier !== 'type' ? <Cover cover={covers[index]} ratio="1:1" sizes={COVER_SIZES.thumb} decorative /> : null}
      trailing={<Button href={`tel:${call.tel}`} aria-label={t(`拨打 ${pick(call.label)} ${call.number}`, `Call ${call.label.en} ${call.number}`)}>{t('拨打', 'Call')} {call.number}</Button>} />)}
  </section>;
}
