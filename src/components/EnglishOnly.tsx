import type { ReactNode } from 'react';
import { useLocale } from '../i18n/locale';

/**
 * Decorative English all-caps eyebrows ("MAKE YOURSELF AT HOME") are an English-edition flourish only: the
 * Simplified and Traditional editions omit them (SYS-09). Added by scripts/codemods/eyebrows.mjs.
 */
export function EnglishOnly({ children }: { children: ReactNode }) {
  return useLocale() === 'en' ? <>{children}</> : null;
}
