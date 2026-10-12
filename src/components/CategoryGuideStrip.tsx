import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import '../features/posts/community.css';
import { useUiCopy } from './ui/ui-copy';
import { translateText } from '../i18n/locale';
// The guides corpus is large: only its type here (erased at compile time); the data is imported in the effect.
import type { Guide } from '../data/guides';

/** "Read this first" for a board: what each board's readers usually need (WEB-COMMUNITY, T15). */
const STRIP_TITLES: Record<string, { zh: string; en: string }> = {
  service: { zh: '找本地服务先看', en: 'Before you hire someone' },
  rent: { zh: '租房前先看', en: 'Before you rent' },
  used: { zh: '二手交易先看', en: 'Before you buy or sell' },
  moving: { zh: '找本地服务先看', en: 'Before you hire someone' },
  cleaning: { zh: '预约清洁先看', en: 'Before you book a cleaner' },
  ride: { zh: '接送通勤先看', en: 'Rides and commuting' },
  repair: { zh: '安排维修先看', en: 'Before you book a repair' },
  translation: { zh: '找翻译先看', en: 'Before you hire a translator' },
  'part-time': { zh: '联系招聘方之前', en: 'Before you contact an employer' },
};

export const CategoryGuideStrip = ({ categorySlug }: { categorySlug: string }) => {
  const { t, pick, locale } = useUiCopy();
  const [items, setItems] = useState<Guide[]>([]);
  useEffect(() => {
    let cancelled = false;
    import('../data/guides').then((m) => { if (!cancelled) setItems(m.getGuidesForCategorySlug(categorySlug, 3)); })
      .catch(() => { /* No guides when the corpus does not load. */ });
    return () => { cancelled = true; };
  }, [categorySlug]);
  if (items.length === 0) return null;
  return <section className="cm-guides" aria-labelledby="cm-guides-title">
    <h2 className="cm-guides__title" id="cm-guides-title">{STRIP_TITLES[categorySlug] ? pick(STRIP_TITLES[categorySlug]) : t('相关生活指南', 'Related guides')}</h2>
    <ul className="cm-guides__list">
      {items.map(guide => <li key={guide.slug}><Link to={`/guides/${guide.slug}`}><span>{translateText(guide.title, locale)}</span><ChevronRight aria-hidden="true" strokeWidth={1.75} /></Link></li>)}
    </ul>
  </section>;
};
