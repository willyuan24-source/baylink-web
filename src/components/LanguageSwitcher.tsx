import { useState } from 'react';
import { Globe2 } from 'lucide-react';
import { useLocation, type Location } from 'react-router-dom';
import { isLocale, setLocale, useLocale, localizedUrl } from '../i18n/locale';
import { navigateSiteLanguage } from './LanguageRouter';

export function LanguageSwitcher({ realLocation }: { realLocation?: Location } = {}) {
  const locale = useLocale();
  const routedLocation = useLocation();
  const location = realLocation || routedLocation;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <div className="site-language" translate="no">
    <Globe2 size={17} aria-hidden="true" />
    <label className="sr-only" htmlFor="site-language-select">Language / 语言 / 語言</label>
    <select id="site-language-select" value={locale} disabled={busy} aria-busy={busy} onChange={async (event) => {
      const selected = event.target.value;
      if (!isLocale(selected)) return;
      setBusy(true); setError(false);
      try {
        if (await setLocale(selected, true, location.pathname)) {
          navigateSiteLanguage(localizedUrl(location.pathname + location.search + location.hash, selected));
        }
      } catch { setError(true); }
      finally { setBusy(false); }
    }}>
      <option value="zh-Hans" lang="zh-Hans">简体</option>
      <option value="zh-Hant" lang="zh-Hant">繁體</option>
      <option value="en" lang="en">English</option>
    </select>
    {error && <span role="alert" className="site-language-error">{locale === 'en' ? 'Could not load. Please try again.' : locale === 'zh-Hant' ? '載入失敗，請重試。' : '加载失败，请重试。'}</span>}
  </div>;
}
