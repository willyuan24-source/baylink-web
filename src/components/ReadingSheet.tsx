import type { RefObject } from 'react';
import { Sheet } from './ui/Sheet';
import { ReadingPreferencesCard } from './ReadingPreferencesCard';
import { useLocale } from '../i18n/locale';

/** The header's Aa sheet (G7): F's Sheet (bottom sheet on phones, drawer on desktop, its enter and exit), loaded on first use. */
export function ReadingSheet({ open, onClose, restoreFocusRef }: { open: boolean; onClose: () => void; restoreFocusRef: RefObject<HTMLElement> }) {
  const english = useLocale() === 'en';
  return <Sheet open={open} onClose={onClose} title={english ? 'Text size' : '字号'} className="reading-sheet" restoreFocusRef={restoreFocusRef}>
    <ReadingPreferencesCard />
  </Sheet>;
}
