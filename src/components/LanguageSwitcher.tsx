import { useState } from 'react';
import { Globe2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isLocale, setLocale, useLocale } from '../i18n/locale';

export function LanguageSwitcher() {
  const locale = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
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
        if (await setLocale(selected)) {
          const search = new URLSearchParams(location.search);
          if (selected === 'zh-Hans') search.delete('lang'); else search.set('lang', selected);
          navigate({ pathname: location.pathname, search: search.toString(), hash: location.hash }, { replace: true, state: location.state, preventScrollReset: true });
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
