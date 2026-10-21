import { useId, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUiCopy } from '../../components/ui/ui-copy';
import { isHomeQuestion } from '../../lib/home-query';
import { longDate, weekendRange } from './home-model';
import { dateScope } from '../../lib/date-guard';
import { FREE_NO_SIGN_IN, SITE_IDENTITY } from '../../lib/check-dates';
import { useReadingSize, useSimpleDisplay } from '../../lib/reading-preferences';

export type HomeHeadProps = {
  today: string;
  /** This weekend's Saturday and Sunday; `known` is false when the home cannot count the weekend (then today's date). */
  start: string;
  end: string;
  known: boolean;
  onAskBayBay: (question?: string) => void;
  onSearch?: (query: string) => void;
};

/**
 * ① The masthead (UI9-HOME, G11): the dateline "湾区本周末 · 10/24–25" (today's date when the weekend is unknown), the
 * question H1, one identity line, the ask box (keywords search, full questions go to BayBay; its button is the page's
 * solid one) and, from 768 px, 问 BayBay · AI 助手. On a desktop it fills columns 1–5 beside the picks.
 */
export function HomeHead({ today, start, end, known, onAskBayBay, onSearch }: HomeHeadProps) {
  const { t, english, pick } = useUiCopy();
  const navigate = useNavigate();
  const id = useId();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const asking = isHomeQuestion(query);
  // At 大 / 特大 and in 简洁显示 the box holds about eight characters next to the button: a shorter example, so it is never
  // cut mid-glyph ("比如：这周末带爸妈" with half a 妈). The first render is the standard one, as prerendered.
  const readingSize = useReadingSize(), simple = useSimpleDisplay();
  const roomy = readingSize !== 'standard' || simple;
  const example = roomy ? t('周末带爸妈去哪？', 'Free fun with kids?') : t('这周末带爸妈去哪？', 'Free fun with kids this weekend?');
  const submit = () => {
    const value = query.trim();
    // The button is never disabled (N09): an empty submit focuses the box and offers the example question to send.
    if (!value) { setQuery(example); inputRef.current?.focus(); return; }
    if (isHomeQuestion(value)) onAskBayBay(value);
    else if (onSearch) onSearch(value);
    else navigate(`/guides?q=${encodeURIComponent(value)}`);
  };
  return <header className="home-head">
    {known ? <p className="home-head__dateline" data-simple="hide" {...dateScope('weekend')}>{t('湾区本周末', 'Bay Area weekend')} · <time dateTime={start}>{weekendRange(start, end, english)}</time></p>
      : <p className="home-head__dateline" data-simple="hide" {...dateScope('day')}>{t('湾区', 'Bay Area')} · <time dateTime={today}>{longDate(today, english)}</time></p>}
    <h1 className="home-head__title">{t('这个周末，湾区去哪？', 'Where to go in the Bay this weekend?')}</h1>
    <p className="home-head__identity">{pick(SITE_IDENTITY)} · {pick(FREE_NO_SIGN_IN)}</p>
    <form className="home-ask" role="search" onSubmit={event => { event.preventDefault(); submit(); }}>
      <label htmlFor={`${id}-ask`} className="sr-only">{t('搜索活动、指南，或问 BayBay', 'Search events and guides, or ask BayBay')}</label>
      <img className="home-ask__otter" src="/brand/otter.svg" alt="" width={28} height={28} decoding="async" />
      <input ref={inputRef} id={`${id}-ask`} value={query} maxLength={500} enterKeyHint={asking ? 'send' : 'search'}
        placeholder={roomy ? example : t('比如：这周末带爸妈去哪？', 'e.g. Free fun with kids?')}
        onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} />
      <button type="submit" className="ui-button" data-variant="primary">{asking ? t('问 BayBay', 'Ask BayBay') : <><Search aria-hidden="true" strokeWidth={1.75} />{t('搜索', 'Search')}</>}</button>
    </form>
    <button type="button" className="ui-button home-ask-baybay" data-variant="secondary" data-simple="hide" onClick={() => onAskBayBay()}>
      <img src="/brand/otter.svg" alt="" width={24} height={24} decoding="async" />{t('问 BayBay', 'Ask BayBay')} <span className="ui-status" data-tone="free">{t('AI 助手', 'AI assistant')}</span>
    </button>
  </header>;
}
