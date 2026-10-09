import { Link } from 'react-router-dom';
import { ChevronRight, Heart } from 'lucide-react';
import { useSavedCount } from '../lib/saves';
import { translateText, useLocale } from '../i18n/locale';
import '../features/saves/saves.css';

/**
 * The /me "我的收藏 N" row. N is the one save list (src/lib/saves.ts): the same items, and so the same number, as the
 * saved list in My Week, where they are shown and managed. (Kept under this name for ProfileView; WEB-ACCOUNT
 * replaces the mount with its own tile reading `useSavedCount`.)
 */
export function SavedPostsPanel({ userId }: { userId?: string }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const count = useSavedCount(userId ?? null);
  return <Link className="saves-summary" to="/my-week#saved" data-testid="saved-count-link">
    <Heart aria-hidden="true" strokeWidth={1.75} />
    <span className="saves-summary__text">
      <span className="saves-summary__title">{t('我的收藏', 'Saved items')}<span className="saves-summary__count" aria-label={count === null ? t('数量暂时未知', 'count not available yet') : undefined}>{count ?? '—'}</span></span>
      <span className="saves-summary__note">{t('活动、优惠、新店、指南和邻里信息，都在「我的这周」', 'Events, offers, new shops, guides and listings, all in My Week')}</span>
    </span>
    <ChevronRight aria-hidden="true" strokeWidth={1.75} />
  </Link>;
}
