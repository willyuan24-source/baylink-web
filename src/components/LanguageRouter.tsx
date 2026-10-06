import { startTransition, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { languagePrefix, pathLanguage } from '../lib/language-path';
import { isLocale, setLocale } from '../i18n/locale';

/** Updating a language prefix keeps mounted forms, focus and overlay drafts intact. */
export function LanguageRouter({ children }: { children: ReactNode }) {
  const [basename, setBasename] = useState(() => languagePrefix(pathLanguage(window.location.pathname)));
  const [languageError, setLanguageError] = useState<'en' | 'zh-Hant' | 'zh-Hans' | null>(null);
  const generation = useRef(0);
  const updateLanguage = useCallback(() => {
    const attempt = ++generation.current;
    const path = window.location.pathname;
    const query = new URLSearchParams(window.location.search).get('lang');
    const target = /^\/(en|zh-Hant)(?:\/|$)/.test(path) ? pathLanguage(path) : isLocale(query) ? query : 'zh-Hans';
    startTransition(() => setBasename(languagePrefix(pathLanguage(path))));
    setLanguageError(null);
    // Even an unchanged edition must cancel an older pending language request on Back.
    void setLocale(target, false, path).catch(() => {
      if (attempt === generation.current) setLanguageError(target);
    });
  }, []);
  useEffect(() => {
    const update = () => updateLanguage();
    window.addEventListener('popstate', update);
    return () => { ++generation.current; window.removeEventListener('popstate', update); };
  }, [updateLanguage]);
  return <BrowserRouter basename={basename || undefined}>{languageError && <div role="alert" className="p-4"><p>{languageError === 'en' ? 'Could not load this language. Your current content is preserved.' : languageError === 'zh-Hant' ? '語言載入失敗，目前內容已保留。' : '语言加载失败，当前内容已保留。'}</p><button type="button" className="min-h-11 underline" onClick={updateLanguage}>{languageError === 'en' ? 'Retry' : languageError === 'zh-Hant' ? '重試' : '重试'}</button></div>}{children}</BrowserRouter>;
}

export function navigateSiteLanguage(url: string): void {
  const destination = new URL(url, window.location.href);
  if (destination.origin !== window.location.origin) {
    // Tests and portable previews may use another origin; keep navigation on this site instance.
    destination.protocol = window.location.protocol;
    destination.host = window.location.host;
  }
  window.history.replaceState(window.history.state, '', destination.pathname + destination.search + destination.hash);
  window.dispatchEvent(new window.PopStateEvent('popstate', { state: window.history.state }));
}
