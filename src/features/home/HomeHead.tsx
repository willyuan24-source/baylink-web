import { useId, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUiCopy } from '../../components/ui/ui-copy';
import { isHomeQuestion } from '../../lib/home-query';
import { longDate, monthDay } from './home-model';

export type HomeHeadProps = {
  today: string;
  /** Events this weekend (the remaining days; null when unknown), guides in the library and the edition's check date: the
   * live subtitle (D21). */
  weekendTotal: number | null;
  guideCount: number;
  checkedAt: string;
  onAskBayBay: (question?: string) => void;
  onSearch?: (query: string) => void;
};

/**
 * ① The question H1 "这个周末，湾区去哪？" (D21, display 28/36), a dateline instead of the English eyebrow, the live
 * subtitle that carries the 怎么办 half (HOMEIA-01), and one ask box: keywords search, full questions go to BayBay. Its
 * button is the page's only solid button.
 */
export function HomeHead({ today, weekendTotal, guideCount, checkedAt, onAskBayBay, onSearch }: HomeHeadProps) {
  const { t, english } = useUiCopy();
  const navigate = useNavigate();
  const id = useId();
  const [query, setQuery] = useState('');
  const asking = isHomeQuestion(query);
  const submit = () => {
    const value = query.trim();
    if (!value) return;
    if (isHomeQuestion(value)) onAskBayBay(value);
    else if (onSearch) onSearch(value);
    else navigate(`/guides?q=${encodeURIComponent(value)}`);
  };
  const facts = [
    ...(weekendTotal ? [t(`本周末 ${weekendTotal} 场活动`, `${weekendTotal} events this weekend`)] : []),
    t(`${guideCount} 篇办事指南`, `${guideCount} guides`),
    t(`每条附官方来源，${monthDay(checkedAt)} 核对`, `official sources, checked ${monthDay(checkedAt)}`),
  ];
  return <header className="home-head">
    <p className="home-head__dateline"><span>{t('湾区', 'Bay Area')}</span> · <time dateTime={today}>{longDate(today, english)}</time></p>
    <h1 className="home-head__title">{t('这个周末，湾区去哪？', 'Where to go in the Bay this weekend?')}</h1>
    <p className="home-head__lede">{facts.join(' · ')}</p>
    <form className="home-ask" role="search" onSubmit={event => { event.preventDefault(); submit(); }}>
      <label htmlFor={`${id}-ask`} className="sr-only">{t('搜索活动、指南，或问 BayBay', 'Search events and guides, or ask BayBay')}</label>
      <img className="home-ask__otter" src="/brand/otter.svg" alt="" width={28} height={28} decoding="async" />
      <input id={`${id}-ask`} value={query} maxLength={500} enterKeyHint={asking ? 'send' : 'search'}
        placeholder={t('比如：这周末带爸妈去哪？', 'e.g. Free things to do with kids?')}
        onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} />
      <button type="submit" disabled={!query.trim()}>{asking ? t('问 BayBay', 'Ask BayBay') : <><Search aria-hidden="true" strokeWidth={1.75} />{t('搜索', 'Search')}</>}</button>
    </form>
  </header>;
}
