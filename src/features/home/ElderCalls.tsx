import { ArrowRight, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { ElderCall } from '../../lib/home-catalog';

/**
 * 长辈常用电话 (UI9-HOME, D2's 长辈也方便, D3's 简洁 calls): the 长辈与家属 guides that carry a cover phone, in the intent's
 * order. Each title opens its guide; each row has one 48 px 拨打 button that shows the number and dials it (tel:). The
 * numbers come only from the generated elderCalls projection (the guides' own cover phones). With none, nothing shows,
 * except 长辈与家属指南 → in 简洁.
 */
export function ElderCalls({ calls }: { calls: readonly ElderCall[] }) {
  const { t, pick } = useUiCopy();
  if (!calls.length) return <p className="home-elder" data-simple="only"><Link to="/guides?topic=elders" className="home-section-head__more">{t('长辈与家属指南', 'Guides for seniors & family')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link></p>;
  return <section className="home-elder" aria-labelledby="home-elder-title">
    <div className="home-section-head"><h2 id="home-elder-title">{t('长辈常用电话', 'Phone lines for seniors')}</h2></div>
    <ul>{calls.map(call => <li key={call.slug}>
      <Link to={`/guides/${call.slug}`}>{pick(call.title)}</Link>
      <span>{pick(call.label)}</span>
      <Button href={`tel:${call.tel}`} icon={<Phone aria-hidden="true" strokeWidth={1.75} />} aria-label={t(`拨打 ${pick(call.label)} ${call.number}`, `Call ${call.label.en} ${call.number}`)}>{t('拨打', 'Call')} {call.number}</Button>
    </li>)}</ul>
  </section>;
}
