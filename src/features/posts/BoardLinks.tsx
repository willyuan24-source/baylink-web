import { Link } from 'react-router-dom';
import { useUiCopy } from '../../components/ui/ui-copy';
import { getSlugFromCategory } from '../../routing';
import { BOARD_CATEGORIES, categoryName } from './community-copy';

/** Links to the other boards, as chips; the board on screen is `aria-current`. */
export function BoardLinks({ current }: { current?: string }) {
  const { pick } = useUiCopy();
  return <div className="ui-chip-row cm-board__board-links">
    {BOARD_CATEGORIES.map(category => {
      const slug = getSlugFromCategory(category);
      return slug ? <Link key={category} to={`/category/${slug}`} className="ui-chip" aria-current={current === category ? 'page' : undefined}>{pick(categoryName(category))}</Link> : null;
    })}
  </div>;
}
