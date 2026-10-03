import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../app/context';
import { usePlannerLibrary } from '../lib/planner-library';
import { favoriteKey, type Favorite } from '../lib/planner';
import { translateText, useLocale } from '../i18n/locale';

export function SaveToWeek({ favorite }: { favorite: Favorite }) {
  const app = useApp();
  const locale = useLocale();
  const library = usePlannerLibrary(app?.user?.id);
  const saved = library.data.favorites.some(f => favoriteKey(f) === favoriteKey(favorite));
  return <div className="planner-launch-links"><button type="button" className="planner-primary" aria-pressed={library.ready ? saved : undefined} disabled={library.loading || library.busy || !library.ready} onClick={() => void library.toggleFavorite(favorite)}><Heart size={15} fill={saved ? 'currentColor' : 'none'} />{saved ? '已加入我的这周' : '收藏到我的这周'}</button><Link to="/my-week">我的这周 ↗</Link>{library.error && <p role="alert">{library.error}{!library.ready && <button type="button" disabled={library.loading || library.busy} onClick={() => void library.refresh()} translate="no">{locale === 'en' ? 'Reload saved items' : translateText('重新读取收藏', locale)}</button>}</p>}</div>;
}
