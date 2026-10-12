import { lazy, Suspense } from 'react';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Favorite } from '../lib/planner';
import { translateText, useLocale } from '../i18n/locale';
import { saveButtonName } from '../features/saves/save-name';

export type SaveToWeekProps = {
  favorite: Favorite;
  /** On a list card: the button only (no "我的这周" link), with the item's title in its accessible name. */
  compact?: boolean;
  /** The item's title (catalog source text), read with the button: "收藏：…". */
  title?: string;
};

// The control and the save store behind it load on their own (route JS budgets, plan §3.0 rule 8): list pages that
// show a ♡ on every card do not carry them in their route bundle.
const SaveControl = lazy(() => import('../features/saves/SaveControl'));

/**
 * ♡ 收藏 for one event, place, offer or opening: the one save model (src/lib/saves.ts). Signed-in saves go to the
 * account, guests keep them in this browser, and a save the account cannot accept yet stays saved here (RC-15).
 */
export function SaveToWeek(props: SaveToWeekProps) {
  // On a guide page the reader actions beside this mount carry the same ♡ (GuideReaderActions); two buttons for one
  // save would confuse. WEB-GUIDES removes this mount from GuideDetail.
  if (props.favorite.kind === 'guide' && !props.compact) return null;
  return <Suspense fallback={<SavePlaceholder {...props} />}><SaveControl {...props} /></Suspense>;
}

/** The same box as the control while it loads (and in prerendered HTML): a disabled ♡, so nothing moves when it arrives. */
function SavePlaceholder({ compact, title }: SaveToWeekProps) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  return <div className="saves-control" data-compact={compact ? '' : undefined}>
    <button type="button" className="saves-toggle" data-compact={compact ? '' : undefined} aria-label={saveButtonName(false, title, locale)} disabled>
      <Heart aria-hidden="true" strokeWidth={1.75} />{t('收藏', 'Save')}
    </button>
    {!compact && <Link className="saves-control__link" to="/my-week#saved">{t('我的这周', 'My Week')}</Link>}
  </div>;
}
