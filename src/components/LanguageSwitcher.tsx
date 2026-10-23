import { useState } from 'react';
import { Check, Globe2 } from 'lucide-react';
import { useLocation, type Location } from 'react-router-dom';
import { setLocale, useLocale, localizedUrl, type Locale } from '../i18n/locale';
import { navigateSiteLanguage } from './LanguageRouter';
import { useDisclosure } from './useDisclosure';

// Each choice is named in its own script (the reader may not read the current one); `en` is the name an English page reads.
const LANGUAGES: ReadonlyArray<{ id: Locale; label: string; en: string }> = [
  { id: 'zh-Hans', label: '简体中文', en: 'Simplified Chinese' },
  { id: 'zh-Hant', label: '繁體中文', en: 'Traditional Chinese' },
  { id: 'en', label: 'English', en: 'English' },
];
const TITLES = { en: 'Language', zh: '语言 · 語言' };
const TITLE = `${TITLES.en} · ${TITLES.zh}`;

/**
 * The language control (design.md §4.17). From 768px the header's globe with 简体中文, opening three choices as a menu
 * that enters and leaves on the tokens' durations (site-chrome.css, ::details-content). On a phone (`inline`, UI9-R2 OD7)
 * the same three choices are the first row of the ••• sheet: the header keeps the lockup, search, Aa 字号 and •••.
 * Every choice is a <button> with its own `lang`, so screen readers say each name in its language, and the control is
 * `data-lang-switch` + translate="no": scripts/verify-release.mjs skips the header's switch when it checks that the /en
 * shell has no Chinese and that every link keeps its language (RC-7); the ••• row is rendered only while the sheet is open
 * (SiteNavigation), so the prerendered header holds that one switch. It has no links. The choice is remembered
 * (setLocale), and the URL keeps its path, filters and hash (E2E-07).
 */
export function LanguageSwitcher({ realLocation, inline }: { realLocation?: Location; inline?: boolean } = {}) {
  const locale = useLocale();
  const routedLocation = useLocation();
  const location = realLocation || routedLocation;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const { details, summary, close } = useDisclosure();
  const current = LANGUAGES.find(item => item.id === locale) || LANGUAGES[0];
  const choose = async (selected: Locale) => {
    if (busy) return;
    if (selected === locale) { close(); return; }
    setBusy(true); setError(false);
    try {
      if (await setLocale(selected, true, location.pathname)) {
        navigateSiteLanguage(localizedUrl(location.pathname + location.search + location.hash, selected));
      }
      close();
    } catch { setError(true); }
    finally { setBusy(false); }
  };
  const choices = LANGUAGES.map(item => <button key={item.id} type="button" lang={item.id} aria-pressed={item.id === locale} disabled={busy} onClick={() => void choose(item.id)}>
    <span>{item.label}</span>{!inline && item.id === locale && <Check size={20} aria-hidden="true" strokeWidth={1.75} />}
  </button>);
  const failed = error && <p role="alert" className="site-language-error">{locale === 'en' ? 'Could not load. Please try again.' : locale === 'zh-Hant' ? '載入失敗，請重試。' : '加载失败，请重试。'}</p>;
  if (inline) return <div className="site-language-row" data-lang-switch="" translate="no" role="group" aria-label={TITLE} aria-busy={busy || undefined}>
    <p className="site-language-title" aria-hidden="true"><Globe2 size={20} strokeWidth={1.75} />{TITLE}</p>
    <div className="site-language-options">{choices}</div>
    {failed}
  </div>;
  return <details className="site-language" data-lang-switch="" translate="no" ref={details}>
    <summary ref={summary} className="site-language-trigger site-tool" aria-label={`${TITLE}: ${locale === 'en' ? current.en : current.label}`}>
      <Globe2 size={20} aria-hidden="true" strokeWidth={1.75} />
      <span className="site-language-name" lang={current.id}>{current.label}</span>
    </summary>
    <div className="site-language-menu" role="group" aria-label={TITLE} aria-busy={busy || undefined}>
      <p className="site-language-title" aria-hidden="true">{TITLE}</p>
      {choices}
      {failed}
    </div>
  </details>;
}
