import { useState } from 'react';
import { Languages } from 'lucide-react';
import type { Locale } from '../../i18n/locale';
import { emit } from '../core/events';
import { useT } from '../i18n';
import { GAME_LANGS, chooseGameLocale } from './langChoice';

/**
 * 简体 · 繁體 · English: the game's language choice, on the title screen (before Start) and in Settings. A tap switches
 * at once (ui/langChoice chooseGameLocale: the site's setLocale, saved for the whole BAYLINK site); the pill being loaded
 * shows busy (English and Traditional fetch their text the first time). Each name is written in its own script and is
 * never converted (translate="no"); the group's label is the same two words in every edition.
 * `variant`: 'title' = a cream capsule with the 文A glyph (the title card); 'seg' = Settings' segmented row (ob-seg).
 * `onSwitch`: told just before a switch starts (the title keeps the pills under the pointer: ui/TitleScreen).
 * Title-chunk safe (React, lucide, the site locale, core/events and the game's i18n helper only).
 */
export function LangPills({ variant = 'title', onSwitch }: { variant?: 'title' | 'seg'; onSwitch?: () => void }) {
  const { t, locale } = useT();
  const [busy, setBusy] = useState<Locale | null>(null);
  const [failed, setFailed] = useState(false);
  const choose = (next: Locale) => {
    if (next === locale && !busy) return;
    onSwitch?.();
    setBusy(next);
    setFailed(false);
    emit({ type: 'ui', action: 'select' });
    chooseGameLocale(next).then(
      () => setBusy(b => (b === next ? null : b)),
      () => { setBusy(b => (b === next ? null : b)); setFailed(true); },
    );
  };
  // the label names itself in both scripts, so it can be found from any edition
  const label = t('语言 · Language', 'Language · 语言');
  return (
    <div className={`ob-lang is-${variant}`}>
      <div className={variant === 'seg' ? 'ob-seg ob-lang-pills' : 'ob-lang-pills'} role="radiogroup" aria-label={label} translate="no">
        {variant === 'title' && <span className="ob-lang-icon" aria-hidden><Languages size={18} /></span>}
        {GAME_LANGS.map(o => {
          const on = (busy ?? locale) === o.value;
          return (
            <button key={o.value} type="button" role="radio" lang={o.value} aria-checked={on} aria-busy={busy === o.value || undefined}
              className={`${on ? 'is-on' : ''} ${busy === o.value ? 'is-busy' : ''}`} onClick={() => choose(o.value)}>
              {o.label}
            </button>
          );
        })}
      </div>
      {failed && <p className="ob-lang-error" role="alert">{t('没能切换语言，请再试一次', 'Could not switch the language. Please try again.')}</p>}
    </div>
  );
}
