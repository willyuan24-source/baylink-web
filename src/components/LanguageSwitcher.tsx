import { useState } from 'react';
import { Check, Globe2 } from 'lucide-react';
import { useLocation, type Location } from 'react-router-dom';
import { setLocale, useLocale, localizedUrl, type Locale } from '../i18n/locale';
import { navigateSiteLanguage } from './LanguageRouter';
import { useDisclosure } from './useDisclosure';

// Each choice is named in its own script (the reader may not read the current one); `en` is the name an English page reads.
// The phone trigger (A4) reads `short / other`: the current script and the way out of it, 简 / EN, 繁 / EN, EN / 中文.
const LANGUAGES: ReadonlyArray<{ id: Locale; short: string; label: string; en: string; other: readonly [text: string, lang: string] }> = [
  { id: 'zh-Hans', short: '简', label: '简体中文', en: 'Simplified Chinese', other: ['EN', 'en'] },
  { id: 'zh-Hant', short: '繁', label: '繁體中文', en: 'Traditional Chinese', other: ['EN', 'en'] },
  { id: 'en', short: 'EN', label: 'English', en: 'English', other: ['中文', 'zh'] },
];
const TITLES = { en: 'Language', zh: '语言 · 語言' };
const TITLE = `${TITLES.en} · ${TITLES.zh}`;

/**
 * The header's language control (design.md §4.17): a globe with 简体中文 on desktop and 简 / EN on phones (A4; the current
 * script alone at 特大, in 简洁显示 and below 375 px, site-chrome.css), opening three choices, as a bottom sheet on phones
 * and a menu on desktop; the open menu enters and leaves on the tokens' durations (site-chrome.css, ::details-content). Every choice is a <button> with its own `lang`, so screen readers say each name in
 * its language, and the whole control is `data-lang-switch` + translate="no": scripts/verify-release.mjs skips this subtree
 * when it checks that the /en shell has no Chinese and that every link keeps its language (RC-7). It has no links.
 * The choice is remembered (setLocale), and the URL keeps its path, filters and hash (E2E-07).
 */
export function LanguageSwitcher({ realLocation }: { realLocation?: Location } = {}) {
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
  return <details className="site-language" data-lang-switch="" translate="no" ref={details}>
    <summary ref={summary} className="site-language-trigger site-tool" aria-label={`${TITLE}: ${locale === 'en' ? current.en : current.label}`}>
      <Globe2 size={20} aria-hidden="true" strokeWidth={1.75} />
      <span className="site-language-short" lang={current.id}>{current.short}</span>
      <span className="site-language-pair" aria-hidden="true"><span lang={current.id}>{current.short}</span> / <span lang={current.other[1]}>{current.other[0]}</span></span>
      <span className="site-language-name" lang={current.id}>{current.label}</span>
    </summary>
    <div className="site-language-menu" role="group" aria-label={TITLE} aria-busy={busy || undefined}>
      <p className="site-language-title" aria-hidden="true">{TITLE}</p>
      {LANGUAGES.map(item => <button key={item.id} type="button" lang={item.id} aria-pressed={item.id === locale} disabled={busy} onClick={() => void choose(item.id)}>
        <span>{item.label}</span>{item.id === locale && <Check size={20} aria-hidden="true" strokeWidth={1.75} />}
      </button>)}
      {error && <p role="alert" className="site-language-error">{locale === 'en' ? 'Could not load. Please try again.' : locale === 'zh-Hant' ? '載入失敗，請重試。' : '加载失败，请重试。'}</p>}
    </div>
  </details>;
}
