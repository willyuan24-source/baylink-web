import { Fragment, useId, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUiCopy } from '../../components/ui/ui-copy';
import { isHomeQuestion } from '../../lib/home-query';
import { longDate } from './home-model';
import { dateScope } from '../../lib/date-guard';
import { checkLine, type CheckSummary } from '../../lib/check-dates';
import { useReadingSize, useSimpleDisplay } from '../../lib/reading-preferences';

export type HomeHeadProps = {
  today: string;
  /** Events this weekend (the remaining days; null when unknown), guides in the library and when this weekend's events were
   * checked (H02: most of them, and the latest; null when unknown): the live subtitle (D21). */
  weekendTotal: number | null;
  guideCount: number;
  checked: CheckSummary | null;
  onAskBayBay: (question?: string) => void;
  onSearch?: (query: string) => void;
};

/**
 * ① The question H1 "这个周末，湾区去哪？" (D21, display 28/36), a dateline instead of the English eyebrow, the live
 * subtitle that carries the 怎么办 half (HOMEIA-01), and one ask box: keywords search, full questions go to BayBay. Its
 * button is the page's only solid button.
 */
export function HomeHead({ today, weekendTotal, guideCount, checked, onAskBayBay, onSearch }: HomeHeadProps) {
  const { t, english } = useUiCopy();
  const navigate = useNavigate();
  const id = useId();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const asking = isHomeQuestion(query);
  // At 大 / 特大 and in 简洁显示 the box holds about eight characters next to the button: a shorter example, so it is never
  // cut mid-glyph ("比如：这周末带爸妈" with half a 妈). The first render is the standard one, as prerendered.
  const readingSize = useReadingSize(), simple = useSimpleDisplay();
  const roomy = readingSize !== 'standard' || simple;
  const submit = () => {
    const value = query.trim();
    // The button is never disabled (N09): an empty submit focuses the box and offers the example question to send (the
    // short one at 大 / 特大 and in 简洁显示, where the box holds about eight characters).
    if (!value) { setQuery(roomy ? t('周末带爸妈去哪？', 'Free fun with kids?') : t('这周末带爸妈去哪？', 'Free fun with kids this weekend?')); inputRef.current?.focus(); return; }
    if (isHomeQuestion(value)) onAskBayBay(value);
    else if (onSearch) onSearch(value);
    else navigate(`/guides?q=${encodeURIComponent(value)}`);
  };
  const facts = [
    ...(weekendTotal ? [t(`本周末 ${weekendTotal} 场活动`, `${weekendTotal} events this weekend`)] : []),
    t(`${guideCount} 篇办事指南`, `${guideCount} guides`),
    checked ? `${t('每条附官方来源，', 'official sources, ')}${checkLine(checked, t).replace(' · ', t('，', ', '))}` : t('每条附官方来源', 'official sources'),
  ];
  // Each phrase keeps its line ("多数核对于 9/29，" never breaks as 多 / 数): units end after their own punctuation, and the
  // breaks fall between them (the separators and, in English, the spaces stay outside the units).
  const units = facts.flatMap((fact, index) => {
    // No lookbehind: iOS Safari before 16.4 cannot parse it, and the home must load on a parent's older iPhone.
    const mark = english ? ',' : '，';
    const parts = fact.split(mark).map((part, at, all) => at < all.length - 1 ? part + mark : part).map(part => part.trim()).filter(Boolean);
    return parts.map((part, at) => ({ part, before: at ? (english ? ' ' : '') : index ? ' · ' : '' }));
  });
  return <header className="home-head">
    <p className="home-head__dateline" {...dateScope('day')}><span>{t('湾区', 'Bay Area')}</span> · <time dateTime={today}>{longDate(today, english)}</time></p>
    <h1 className="home-head__title">{t('这个周末，湾区去哪？', 'Where to go in the Bay this weekend?')}</h1>
    <p className="home-head__lede" {...dateScope('weekend')}>{units.map(({ part, before }, index) => <Fragment key={index}>{before}<span className="home-head__unit">{part}</span></Fragment>)}</p>
    <form className="home-ask" role="search" onSubmit={event => { event.preventDefault(); submit(); }}>
      <label htmlFor={`${id}-ask`} className="sr-only">{t('搜索活动、指南，或问 BayBay', 'Search events and guides, or ask BayBay')}</label>
      <img className="home-ask__otter" src="/brand/otter.svg" alt="" width={28} height={28} decoding="async" />
      <input ref={inputRef} id={`${id}-ask`} value={query} maxLength={500} enterKeyHint={asking ? 'send' : 'search'}
        placeholder={roomy ? t('周末带爸妈去哪？', 'Free fun with kids?') : t('比如：这周末带爸妈去哪？', 'e.g. Free fun with kids?')}
        onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} />
      <button type="submit">{asking ? t('问 BayBay', 'Ask BayBay') : <><Search aria-hidden="true" strokeWidth={1.75} />{t('搜索', 'Search')}</>}</button>
    </form>
  </header>;
}
