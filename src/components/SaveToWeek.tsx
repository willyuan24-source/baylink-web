import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../app/context';
import { usePlannerLibrary } from '../lib/planner-library';
import type { Favorite } from '../lib/planner';

export function SaveToWeek({ favorite }: { favorite: Favorite }) {
  const app = useApp();
  const library = usePlannerLibrary(app?.user?.id);
  const saved = library.data.favorites.some(f => f.kind === favorite.kind && f.id === favorite.id);
  return <div className="planner-launch-links"><button type="button" className="planner-primary" aria-pressed={saved} disabled={library.loading || library.busy} onClick={() => void library.toggleFavorite(favorite)}><Heart size={15} fill={saved ? 'currentColor' : 'none'} />{saved ? '已加入我的这周' : '收藏到我的这周'}</button><Link to="/my-week">我的这周 ↗</Link>{library.error && <p role="alert">{library.error}</p>}</div>;
}
