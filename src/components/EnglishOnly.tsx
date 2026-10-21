import type { ReactNode } from 'react';
import { useLocale } from '../i18n/locale';

/**
 * Decorative English eyebrows ("Make yourself at home") are an English-edition flourish only: the Simplified and
 * Traditional editions omit them (SYS-09). Added by scripts/codemods/eyebrows.mjs. G6 (UI-9): sentence case, never
 * all-caps English (tests/ui9-int-g6-caps.test.ts).
 */
export function EnglishOnly({ children }: { children: ReactNode }) {
  return useLocale() === 'en' ? <>{children}</> : null;
}
