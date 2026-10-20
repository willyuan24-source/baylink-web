import { Suspense, useEffect, useRef, useState } from 'react';
import { initializeReadingSize, useExit } from '../lib/reading-preferences';
import { lazyChunk } from '../lib/chunk-recovery';
import { ChunkBoundary } from './ChunkBoundary';
import { useLocale } from '../i18n/locale';

// The Aa sheet is its own chunk (F's Sheet and the card stay out of the shell every page downloads); a pointer or the
// keyboard reaching Aa starts loading it before the tap (a finger's pointerenter too). One that cannot load closes the
// sheet and `onUnavailable` says so (AppLayout's toast), instead of taking the page down.
const loadReadingSheet = () => import('./ReadingSheet');
const ReadingSheet = lazyChunk(loadReadingSheet, m => m.ReadingSheet);
const warm = () => { void loadReadingSheet().catch(() => {}); };

export function ReadingPreferencesButton({ onUnavailable }: { onUnavailable?: (lostChunk: boolean) => void }) {
  const [open, setOpen] = useState(false);
  // Mounted through the sheet's exit (useExit: 200ms, 0 under reduced motion and in 简洁显示).
  const shown = useExit(open);
  const trigger = useRef<HTMLButtonElement>(null);
  const english = useLocale() === 'en';
  useEffect(initializeReadingSize, []);
  return <>
    {/* "Aa 字号" in every reading mode (G7): the visible 字号 is the accessible name in Chinese; English phones show
        "Aa Size" and the button keeps the name "Text size". */}
    <button ref={trigger} type="button" className="site-reading-button site-tool" aria-haspopup="dialog" aria-label={english ? 'Text size' : undefined} onClick={() => setOpen(true)} onPointerEnter={warm} onFocus={warm}>
      <span className="site-reading-glyph" aria-hidden="true">Aa</span><span className="site-reading-label">{english ? 'Text size' : '字号'}</span>{english && <span className="site-reading-label-short" aria-hidden="true">Size</span>}
    </button>
    {shown && <ChunkBoundary onFail={lostChunk => { setOpen(false); onUnavailable?.(lostChunk); }}><Suspense fallback={null}><ReadingSheet open={open} onClose={() => setOpen(false)} restoreFocusRef={trigger} /></Suspense></ChunkBoundary>}
  </>;
}
